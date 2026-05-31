import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, username: true, role: true, approved: true, brand: true, createdAt: true,
        _count: { select: { keywords: true } },
      },
    });
    return res.status(200).json({ users });
  }

  if (req.method === "POST") {
    const { name, username, password, role, brand } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: "이름, 아이디, 비밀번호는 필수입니다." });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
    }
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, username, password: hashed, approved: true, role: role === "admin" ? "admin" : "user", brand: brand || null },
    });
    return res.status(201).json({ user: { id: user.id, name: user.name, username: user.username } });
  }

  return res.status(405).end();
});
