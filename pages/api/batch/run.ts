import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { batchCheckRankings } from "@/lib/scraper";
import { getAuthUser } from "@/lib/auth";
import { sendTelegram, getTelegramSetting } from "@/lib/telegram";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== (process.env.CRON_SECRET || "batch-cron-secret-key")) {
    const user = await getAuthUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "권한이 없습니다." });
    }
  }

  const keywords = await prisma.keyword.findMany({
    where: { deletedAt: null },
    select: {
      id: true, keyword: true, link: true, brand: true,
      rankings: { orderBy: { checkedAt: "desc" }, take: 1, select: { status: true, rank: true } },
    },
  });

  if (!keywords.length) {
    return res.status(200).json({ message: "처리할 키워드가 없습니다.", count: 0 });
  }

  // Snapshot previous statuses
  const prevStatus = new Map<number, string>();
  for (const kw of keywords) {
    prevStatus.set(kw.id, kw.rankings[0]?.status ?? "not_checked");
  }

  const results = await batchCheckRankings(keywords.map((k) => ({ id: k.id, keyword: k.keyword, link: k.link })));

  for (const { id, result } of results) {
    await prisma.ranking.create({
      data: { keywordId: id, rank: result.rank, status: result.status, postStats: result.postStats },
    });
  }

  const now = new Date();
  const setting = await prisma.batchSetting.findUnique({ where: { id: 1 } });
  const intervalHours = setting?.intervalHours || 4;
  await prisma.batchSetting.upsert({
    where: { id: 1 },
    update: { lastRunAt: now, nextRunAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000) },
    create: { id: 1, enabled: true, intervalHours, lastRunAt: now, nextRunAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000) },
  });

  // Telegram: notify newly exposed keywords
  const tg = await getTelegramSetting();
  if (tg) {
    const newlyExposed: string[] = [];
    for (const { id, result } of results) {
      const prev = prevStatus.get(id);
      if (prev !== "exposed" && result.status === "exposed") {
        const kw = keywords.find((k) => k.id === id);
        if (kw) {
          const brandTag = kw.brand ? ` [${kw.brand}]` : "";
          newlyExposed.push(`✅ <b>${kw.keyword}</b>${brandTag} → ${result.rank}위`);
        }
      }
    }
    if (newlyExposed.length > 0) {
      await sendTelegram(tg.token, tg.chatId,
        `🔔 <b>[자동 체크] 신규 노출 키워드</b>\n\n${newlyExposed.join("\n")}`
      );
    }
  }

  return res.status(200).json({ message: "배치 작업 완료", count: results.length });
}
