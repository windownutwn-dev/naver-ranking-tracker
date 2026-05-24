import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { checkNaverRanking } from "@/lib/scraper";

export default withAuth(async (req, res, user) => {
  if (req.method !== "POST") return res.status(405).end();

  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });

  const keyword = await prisma.keyword.findUnique({ where: { id } });
  if (!keyword) return res.status(404).json({ error: "키워드를 찾을 수 없습니다." });
  if (keyword.userId !== user.id && user.role !== "admin") {
    return res.status(403).json({ error: "권한이 없습니다." });
  }

  const result = await checkNaverRanking(keyword.keyword, keyword.link);

  const ranking = await prisma.ranking.create({
    data: {
      keywordId: id,
      rank: result.rank,
      status: result.status,
      postStats: result.postStats,
    },
  });

  return res.status(200).json({ ranking, result });
});
