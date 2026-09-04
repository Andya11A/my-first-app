import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { hashPassword } from '../src/lib/auth';

const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 创建角色
  const roles = [
    {
      roleName: '超级管理员',
      roleCode: 'super_admin',
      description: '系统最高权限，管理所有用户和系统配置',
      isSystem: true,
      menus: JSON.stringify(['dashboard', 'projects', 'templates', 'users', 'roles', 'approvals', 'messages', 'settings']),
      dataScope: 'all',
    },
    {
      roleName: '管理员',
      roleCode: 'admin',
      description: '管理项目、模板和数据看板',
      isSystem: true,
      menus: JSON.stringify(['dashboard', 'projects', 'templates', 'approvals', 'messages']),
      dataScope: 'all',
    },
    {
      roleName: '设计师',
      roleCode: 'designer',
      description: '核心角色，负责方案设计、报价生成、图纸管理',
      isSystem: true,
      menus: JSON.stringify(['projects', 'templates', 'approvals', 'messages']),
      dataScope: 'self',
    },
    {
      roleName: '销售',
      roleCode: 'sales',
      description: '创建项目、生成报价、提交审批',
      isSystem: true,
      menus: JSON.stringify(['projects', 'messages']),
      dataScope: 'self',
    },
    {
      roleName: '管理层',
      roleCode: 'management',
      description: '审批方案、查看统计报表',
      isSystem: true,
      menus: JSON.stringify(['dashboard', 'projects', 'approvals', 'messages']),
      dataScope: 'all',
    },
    {
      roleName: '财务',
      roleCode: 'finance',
      description: '查看项目报价和成本数据',
      isSystem: true,
      menus: JSON.stringify(['dashboard', 'projects']),
      dataScope: 'all',
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleCode: role.roleCode },
      update: role,
      create: role,
    });
  }

  // 创建默认管理员账号
  const adminRole = await prisma.role.findUnique({ where: { roleCode: 'super_admin' } });
  if (adminRole) {
    const passwordHash = await hashPassword('admin123');
    await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        passwordHash,
        realName: '系统管理员',
        roleId: adminRole.id,
      },
    });
  }

  console.log('角色和默认管理员创建完成');
  console.log('默认管理员: admin / admin123');
}

main()
  .catch((e) => {
    console.error('角色初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
