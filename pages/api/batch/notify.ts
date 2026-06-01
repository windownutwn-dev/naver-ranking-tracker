import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendTelegram, getTelegramSetting } from "@/lib/telegram";

// Called at 09:00 and 18:00 KST daily
// Compares current rankings with same time yesterday
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== (process.env.CRON_SECRET || "batch-cron-secret-key")) {
    return res.status(401).json({ error: "권한이 없습니다." });
  }

  const tg = await getTelegramSetting();
  if (!tg) return res.status(200).json({ message: "텔레그램 미설정" });

  const now = new Date();
  // Same time yesterday window: 23h ~ 25h ago
  const from = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const to = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  const keywords = await prisma.keyword.findMany({
    where: { deletedAt: null },
    select: {
      id: true, keyword: true, brand: true,
      rankings: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });

  // Yesterday's rankings (same time ±1h)
  const yesterdayRankings = await prisma.ranking.findMany({
    where: { checkedAt: { gte: from, lte: to } },
    orderBy: { checkedAt: "desc" },
    select: { keywordId: true, status: true, rank: true, checkedAt: true },
  });

  // Keep only the latest per keyword within the window
  const yesterdayMap = new Map<number, { status: string; rank: number | null }>();
  for (const r of yesterdayRankings) {
    if (!yesterdayMap.has(r.keywordId)) yesterdayMap.set(r.keywordId, { status: r.status, rank: r.rank });
  }

  const newlyExposed: string[] = [];
  const newlyHidden: string[] = [];

  for (const kw of keywords) {
    const current = kw.rankings[0];
    const yesterday = yesterdayMap.get(kw.id);
    if (!current || !yesterday) continue;

    const brandTag = kw.brand ? ` [${kw.brand}]` : "";

    if (yesterday.status !== "exposed" && current.status === "exposed") {
      newlyExposed.push(`✅ <b>${kw.keyword}</b>${brandTag} → ${current.rank}위`);
    } else if (yesterday.status === "exposed" && current.status !== "exposed") {
      const prevRank = yesterday.rank ? ` (전일 ${yesterday.rank}위)` : "";
      newlyHidden.push(`❌ <b>${kw.keyword}</b>${brandTag}${prevRank} → 비노출`);
    }
  }

  const timeLabel = now.getHours() < 12 ? "오전 9시" : "오후 6시";
  const messages: string[] = [];

  if (newlyExposed.length > 0) {
    messages.push(`📈 <b>[${timeLabel} 알림] 신규 노출 키워드</b>\n전일 동시간 대비 비노출→노출\n\n${newlyExposed.join("\n")}`);
  }
  if (newlyHidden.length > 0) {
    messages.push(`📉 <b>[${timeLabel} 알림] 비노출 키워드</b>\n전일 동시간 대비 노출→비노출\n\n${newlyHidden.join("\n")}`);
  }

  if (messages.length === 0) {
    await sendTelegram(tg.token, tg.chatId, `ℹ️ <b>[${timeLabel} 알림]</b>\n전일 대비 변동된 키워드가 없습니다.`);
  } else {
    for (const msg of messages) {
      await sendTelegram(tg.token, tg.chatId, msg);
    }
  }

  return res.status(200).json({ exposed: newlyExposed.length, hidden: newlyHidden.length });
}
