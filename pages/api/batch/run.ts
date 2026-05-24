import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { batchCheckRankings } from "@/lib/scraper";
import { getAuthUser } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Allow cron secret or admin user
  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== process.env.CRON_SECRET) {
    const user = await getAuthUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "권한이 없습니다." });
    }
  }

  const keywords = await prisma.keyword.findMany({
    where: { deletedAt: null },
    select: { id: true, keyword: true, link: true },
  });

  if (!keywords.length) {
    return res.status(200).json({ message: "처리할 키워드가 없습니다.", count: 0 });
  }

  const results = await batchCheckRankings(keywords);

  for (const { id, result } of results) {
    await prisma.ranking.create({
      data: {
        keywordId: id,
        rank: result.rank,
        status: result.status,
        postStats: result.postStats,
      },
    });
  }

  const now = new Date();
  const setting = await prisma.batchSetting.findUnique({ where: { id: 1 } });
  const intervalHours = setting?.intervalHours || 4;
  await prisma.batchSetting.upsert({
    where: { id: 1 },
    update: {
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000),
    },
    create: {
      id: 1,
      enabled: true,
      intervalHours,
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000),
    },
  });

  return res.status(200).json({ message: "배치 작업 완료", count: results.length });
}
