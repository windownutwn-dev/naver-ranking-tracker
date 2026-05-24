import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "인증이 필요합니다." });
  return res.status(200).json({
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
}
