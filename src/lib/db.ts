import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma 7 必须通过 driver adapter 连接 SQLite（dev.db 位于项目根目录）
    // 本地 file:./dev.db；生产 Turso libsql://... + DATABASE_AUTH_TOKEN
    adapter: new PrismaLibSql({
      url: process.env.DATABASE_URL ?? 'file:./dev.db',
      authToken: process.env.DATABASE_AUTH_TOKEN,
    }),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
