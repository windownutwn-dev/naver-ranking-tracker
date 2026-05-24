import type { NextApiRequest, NextApiResponse } from "next";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "인증이 필요합니다." });

    if (req.query.template === "true") {
      // Download template
      const ws = XLSX.utils.aoa_to_sheet([
        ["카페링크", "키워드", "브랜드", "제품명", "카페명", "담당자", "그룹"],
        ["https://cafe.naver.com/example/123", "예시 키워드", "브랜드명", "제품명", "카페명", "담당자", "그룹A"],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "키워드목록");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Disposition", `attachment; filename="ranking_tracker_template.xlsx"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(buffer);
    }

    // Export current keywords
    const keywords = await prisma.keyword.findMany({
      where: user.role === "admin" ? { deletedAt: null } : { userId: user.id, deletedAt: null },
      include: {
        user: { select: { name: true } },
        rankings: { orderBy: { checkedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = keywords.map((k) => {
      const latest = k.rankings[0];
      return {
        "카페링크": k.link,
        "키워드": k.keyword,
        "브랜드": k.brand || "",
        "제품명": k.productName || "",
        "카페명": k.cafeName || "",
        "담당자": k.manager || user.name,
        "그룹": k.group || "",
        "랭킹": latest?.rank ?? "비노출",
        "상태": latest?.status === "exposed" ? `${latest.rank}위` : latest?.status === "deleted" ? "삭제" : "비노출",
        "확인일시": latest?.checkedAt ? new Date(latest.checkedAt).toLocaleString("ko-KR") : "",
        "메모": k.memo || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "키워드목록");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="ranking_tracker_${Date.now()}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  }

  return res.status(405).end();
}
