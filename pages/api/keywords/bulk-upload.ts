import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "인증이 필요합니다." });

  const { action, strategy, rows } = req.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "데이터가 없습니다." });
  }

  const validRows = rows.filter((r: any) => r.link && r.keyword);
  if (!validRows.length) return res.status(400).json({ error: "유효한 데이터가 없습니다." });

  const allExisting = await prisma.keyword.findMany({
    where: user.role === "admin" ? { deletedAt: null } : { userId: user.id, deletedAt: null },
    select: {
      id: true,
      keyword: true,
      rankings: { orderBy: { checkedAt: "desc" }, take: 1, select: { status: true } },
    },
  });

  const duplicates: Array<{ row: any; existing: { id: number; keyword: string; latestStatus: string | null } }> = [];
  const nonDuplicates: any[] = [];

  for (const row of validRows) {
    const normalized = String(row.keyword).replace(/\s/g, "");
    const existing = allExisting.find((k) => k.keyword.replace(/\s/g, "") === normalized);
    if (existing) {
      duplicates.push({
        row,
        existing: { id: existing.id, keyword: existing.keyword, latestStatus: existing.rankings[0]?.status || null },
      });
    } else {
      nonDuplicates.push(row);
    }
  }

  if (action === "preview") {
    return res.status(200).json({
      total: validRows.length,
      newCount: nonDuplicates.length,
      duplicateCount: duplicates.length,
      exposedDuplicateCount: duplicates.filter((d) => d.existing.latestStatus === "exposed").length,
      duplicates: duplicates.map((d) => ({ keyword: d.row.keyword, existing: d.existing })),
    });
  }

  if (action === "create") {
    const toAdd: any[] = [...nonDuplicates];

    if (strategy === "all") {
      toAdd.push(...duplicates.map((d) => d.row));
    } else if (strategy === "exposed_only") {
      toAdd.push(...duplicates.filter((d) => d.existing.latestStatus === "exposed").map((d) => d.row));
    }

    let added = 0;
    for (const row of toAdd) {
      await prisma.keyword.create({
        data: {
          userId: user.id,
          link: String(row.link).trim(),
          keyword: String(row.keyword).trim(),
          brand: String(row.brand || "").trim() || null,
          productName: String(row.productName || "").trim() || null,
          cafeName: String(row.cafeName || "").trim() || null,
          manager: String(row.manager || "").trim() || null,
          group: String(row.group || "").trim() || null,
        },
      });
      added++;
    }

    const skipped = validRows.length - added;
    return res.status(200).json({
      added,
      skipped,
      message: `${added}개가 등록되었습니다.${skipped > 0 ? ` (중복 ${skipped}개 건너뜀)` : ""}`,
    });
  }

  return res.status(400).json({ error: "잘못된 요청입니다." });
}
