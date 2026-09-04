// 一键迁移：本地按 schema 生成建表 SQL，直接推送到 Turso（LibSQL 云端）
// 用法：
//   1. 注册 Turso（https://turso.tech）→ turso db create <name>
//   2. 设置环境变量：
//      TURSO_DATABASE_URL=libsql://your-db.turso.io
//      TURSO_AUTH_TOKEN=eyJ...（turso db tokens create <name> 生成）
//   3. npx tsx scripts/migrate-turso.ts
//   4. Vercel 环境变量设置 DATABASE_URL=TURSO_DATABASE_URL 的值 + DATABASE_AUTH_TOKEN（见 README 部署说明）
import { execSync } from 'child_process';
import { createClient } from '@libsql/client';

async function main() {
  const TURSO_URL = process.env.TURSO_DATABASE_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
  if (!TURSO_URL) {
    console.error('❌ 缺少 TURSO_DATABASE_URL 环境变量（libsql://...）');
    process.exit(1);
  }

  // 1. 按 schema.prisma 生成建表 SQL（不连本地库，纯 datamodel → DDL）
  console.log('① 生成建表 SQL...');
  const sql = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf8' }
  );
  console.log(`   生成 ${sql.split('\n').length} 行 SQL`);

  // 2. 推送到 Turso（executeMultiple 支持多语句，跨平台无 shell 重定向问题）
  console.log('② 推送到 Turso...');
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  await client.executeMultiple(sql);

  console.log('✅ 迁移完成！Vercel 部署时设置 DATABASE_URL=' + TURSO_URL + ' 以及 DATABASE_AUTH_TOKEN');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 迁移失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});
