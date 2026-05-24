/**
 * Railway 첫 배포 시 자동 실행: DB 마이그레이션 + 관리자 계정 생성
 * railway.toml buildCommand에 포함되어 있음
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || dbUrl.startsWith("file:")) {
  console.log("SQLite 환경 - deploy-init 건너뜀");
  process.exit(0);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!existing) {
    const hashed = await bcrypt.hash("admin1234", 10);
    await prisma.user.create({
      data: { name: "관리자", username: "admin", password: hashed, role: "admin", approved: true },
    });
    console.log("✅ 관리자 계정 생성 (admin / admin1234)");
  }
  await prisma.batchSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, enabled: true, intervalHours: 4, nextRunAt: new Date(Date.now() + 4 * 60 * 60 * 1000) },
  });
  console.log("✅ 초기화 완료");
}

main().catch(console.error).finally(() => prisma.$disconnect());
