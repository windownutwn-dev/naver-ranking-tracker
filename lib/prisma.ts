import { PrismaClient } from "@prisma/client";

function createClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || "";

  if (dbUrl.startsWith("file:") || dbUrl === "") {
    // Local SQLite
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, "") || "./prisma/dev.db");
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    return new PrismaClient({ adapter } as any);
  } else {
    // PostgreSQL (Railway / cloud)
    const { PrismaPg } = require("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: dbUrl });
    return new PrismaClient({ adapter } as any);
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
