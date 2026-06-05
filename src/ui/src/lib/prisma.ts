import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

// const globalForPrisma = globalThis as unknown as {
//   prisma: PrismaClient | undefined;
// };

// const adapter = new PrismaBetterSqlite3({
//   url: process.env.DATABASE_URL ?? "file:./dev.db",
// });

// export const prisma: PrismaClient =
//   globalForPrisma.prisma ?? new PrismaClient({ adapter });

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const dbPath = path.resolve(process.cwd(), "prisma/dev.db");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;