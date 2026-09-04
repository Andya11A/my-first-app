import { prisma } from './db';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'lab-quote-tool-secret-key-2024'
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateToken(userId: number, username: string, roleCode: string): Promise<string> {
  return new SignJWT({ userId, username, roleCode })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: number; username: string; roleCode: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      roleCode: payload.roleCode as string,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(request: Request): Promise<{ id: number; username: string; realName: string; roleId: number; roleCode: string; roleName: string; dataScope: string } | null> {
  let token: string | undefined;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  // fallback: window.open 场景无法带 header，支持从 query 传 token
  if (!token) {
    token = new URL(request.url).searchParams.get('token') || undefined;
  }
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true },
  });

  if (!user || user.status !== 'active') return null;

  return {
    id: user.id,
    username: user.username,
    realName: user.realName,
    roleId: user.roleId,
    roleCode: user.role.roleCode,
    roleName: user.role.roleName,
    dataScope: user.role.dataScope,
  };
}
