import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, username: true, role: true, approved: true, createdAt: true,
        _count: { select: { keywords: true } },
      },
    });
    return res.status(200).json({ users });
  }
  return res.status(405).end();
});
