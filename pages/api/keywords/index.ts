import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export default withAuth(async (req, res, user) => {
  if (req.method === "GET") {
    const { brand, cafeName, status, manager, sort, deleted } = req.query;

    const where: any = {
      deletedAt: deleted === "true" ? { not: null } : null,
    };

    if (user.role !== "admin") where.userId = user.id;
    if (brand && brand !== "전체") where.brand = brand;
    if (cafeName && cafeName !== "전체") where.cafeName = cafeName;
    if (manager && manager !== "전체") where.userId = parseInt(manager as string);

    const keywords = await prisma.keyword.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true } },
        rankings: { orderBy: { checkedAt: "desc" }, take: 1 },
      },
      orderBy:
        sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" },
    });

    // Apply status filter after join
    let result = keywords;
    if (status && status !== "전체") {
      result = keywords.filter((k) => {
        const latestRanking = k.rankings[0];
        if (!latestRanking) return status === "not_checked";
        return latestRanking.status === status;
      });
    }

    // Get unique values for filter dropdowns
    const allKeywords = await prisma.keyword.findMany({
      where: user.role === "admin" ? { deletedAt: null } : { userId: user.id, deletedAt: null },
      select: { brand: true, cafeName: true, userId: true, user: { select: { id: true, name: true } } },
    });

    const brands = [...new Set(allKeywords.map((k) => k.brand).filter(Boolean))];
    const cafeNames = [...new Set(allKeywords.map((k) => k.cafeName).filter(Boolean))];
    const managers = [
      ...new Map(
        allKeywords.map((k) => [k.userId, { id: k.user.id, name: k.user.name }])
      ).values(),
    ];

    return res.status(200).json({ keywords: result, brands, cafeNames, managers });
  }

  if (req.method === "POST") {
    const { link, keyword, brand, productName, cafeName, manager, group } = req.body;
    if (!link || !keyword) {
      return res.status(400).json({ error: "카페 링크와 키워드는 필수입니다." });
    }

    const created = await prisma.keyword.create({
      data: {
        userId: user.id,
        link, keyword,
        brand: brand || null,
        productName: productName || null,
        cafeName: cafeName || null,
        manager: manager || null,
        group: group || null,
      },
    });

    return res.status(201).json({ keyword: created });
  }

  return res.status(405).end();
});
