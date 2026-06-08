import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { normalizeNaverCafeUrl } from "@/lib/scraper";

export default withAuth(async (req, res, user) => {
  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });

  const keyword = await prisma.keyword.findUnique({ where: { id } });
  if (!keyword) return res.status(404).json({ error: "키워드를 찾을 수 없습니다." });
  if (keyword.userId !== user.id && user.role !== "admin") {
    return res.status(403).json({ error: "권한이 없습니다." });
  }

  if (req.method === "PUT") {
    const { link, keyword: kw, brand, productName, cafeName, manager, group, memo, notificationEnabled, pinned } = req.body;
    const updated = await prisma.keyword.update({
      where: { id },
      data: {
        link: link !== undefined ? normalizeNaverCafeUrl(link) : keyword.link,
        keyword: kw ?? keyword.keyword,
        brand: brand !== undefined ? brand : keyword.brand,
        productName: productName !== undefined ? productName : keyword.productName,
        cafeName: cafeName !== undefined ? cafeName : keyword.cafeName,
        manager: manager !== undefined ? manager : keyword.manager,
        group: group !== undefined ? group : keyword.group,
        memo: memo !== undefined ? memo : keyword.memo,
        notificationEnabled: notificationEnabled !== undefined ? notificationEnabled : keyword.notificationEnabled,
        pinned: pinned !== undefined ? pinned : keyword.pinned,
      },
    });
    return res.status(200).json({ keyword: updated });
  }

  if (req.method === "DELETE") {
    const { permanent } = req.query;
    if (permanent === "true") {
      await prisma.ranking.deleteMany({ where: { keywordId: id } });
      await prisma.keyword.delete({ where: { id } });
    } else {
      await prisma.keyword.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    return res.status(200).json({ message: "삭제되었습니다." });
  }

  if (req.method === "PATCH" && req.query.restore === "true") {
    await prisma.keyword.update({ where: { id }, data: { deletedAt: null } });
    return res.status(200).json({ message: "복구되었습니다." });
  }

  return res.status(405).end();
});
