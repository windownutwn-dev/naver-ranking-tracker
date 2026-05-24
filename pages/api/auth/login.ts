import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { username, password, rememberMe } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });

  if (!user.approved) {
    return res.status(403).json({ error: "관리자 승인 대기 중입니다. 승인 후 이용 가능합니다." });
  }

  const token = await signToken({ id: user.id, username: user.username, role: user.role });

  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
  res.setHeader(
    "Set-Cookie",
    `token=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  );

  return res.status(200).json({
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
}
