import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const DB_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";
const dbPath = path.resolve(process.cwd(), DB_URL.replace(/^file:/, ""));

const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const hashed = await bcrypt.hash("admin1234", 10);
    await prisma.user.create({
      data: { name: "관리자", username: "admin", password: hashed, role: "admin", approved: true },
    });
    console.log("✅ 관리자 계정 생성 완료");
    console.log("   아이디: admin");
    console.log("   비밀번호: admin1234");
    console.log("   ⚠️  로그인 후 반드시 비밀번호를 변경하세요!");
  } else {
    console.log("ℹ️  관리자 계정이 이미 존재합니다.");
  }

  await prisma.batchSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, enabled: true, intervalHours: 4, nextRunAt: new Date(Date.now() + 4 * 60 * 60 * 1000) },
  });
  console.log("✅ 배치 설정 초기화됨");
  console.log("\n🚀 서버 시작: npm run dev");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
