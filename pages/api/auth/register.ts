import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, username, password, brands } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, username, password: hashed, approved: false, role: "user", brands: Array.isArray(brands) ? brands : [] },
  });

  return res.status(201).json({ message: "회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다." });
}
