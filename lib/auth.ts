import { SignJWT, jwtVerify } from "jose";
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "./prisma";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "naver-ranking-tracker-secret"
);

export async function signToken(payload: { id: number; username: string; role: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { id: number; username: string; role: string };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextApiRequest): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

export async function getAuthUser(req: NextApiRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.approved) return null;
  return user;
}

type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;
type AuthHandler = (req: NextApiRequest, res: NextApiResponse, user: AuthUser) => Promise<unknown>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "인증이 필요합니다." });
    return handler(req, res, user);
  };
}

export function withAdmin(handler: AuthHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "인증이 필요합니다." });
    if (user.role !== "admin") return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    return handler(req, res, user);
  };
}
