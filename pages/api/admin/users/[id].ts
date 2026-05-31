import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";

export default withAdmin(async (req, res) => {
  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });

  if (req.method === "PATCH") {
    const { approved, role, brands } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(approved !== undefined ? { approved } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(brands !== undefined ? { brands: Array.isArray(brands) ? brands : [] } : {}),
      },
      select: { id: true, name: true, username: true, role: true, approved: true, brands: true },
    });
    return res.status(200).json({ user: updated });
  }

  if (req.method === "DELETE") {
    await prisma.ranking.deleteMany({ where: { keyword: { userId: id } } });
    await prisma.keyword.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    return res.status(200).json({ message: "삭제되었습니다." });
  }

  return res.status(405).end();
});
