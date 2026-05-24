require("dotenv").config();
const { PrismaClient } = require("../generated/prisma/index.js");
const bcrypt = require("bcryptjs");

async function main() {
  const prisma = new PrismaClient();

  try {
    // Create default admin
    const existing = await prisma.user.findUnique({ where: { username: "admin" } });
    if (!existing) {
      const hashed = await bcrypt.hash("admin1234", 10);
      await prisma.user.create({
        data: {
          name: "관리자",
          username: "admin",
          password: hashed,
          role: "admin",
          approved: true,
        },
      });
      console.log("✅ 관리자 계정 생성됨");
      console.log("   아이디: admin");
      console.log("   비밀번호: admin1234");
      console.log("   ⚠️  로그인 후 반드시 비밀번호를 변경하세요!");
    } else {
      console.log("ℹ️  관리자 계정이 이미 존재합니다.");
    }

    // Create default batch setting
    const settingExists = await prisma.batchSetting.findUnique({ where: { id: 1 } });
    if (!settingExists) {
      const now = new Date();
      await prisma.batchSetting.create({
        data: {
          id: 1,
          enabled: true,
          intervalHours: 4,
          nextRunAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        },
      });
      console.log("✅ 배치 설정 초기화됨 (4시간 간격)");
    }

    console.log("\n🚀 초기화 완료! 서버를 시작하세요: npm run dev");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
