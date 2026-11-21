import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "ws_session";
export type Role = "admin" | "financeiro" | "funcionario";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  funcionario: "Funcionário",
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        active: users.active,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row || !row.active) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: (row.role as Role) ?? "funcionario",
      phone: row.phone,
    };
  } catch {
    return null;
  }
}

export function canWrite(role: Role | undefined, resource: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  const financeiro = new Set([
    "clients",
    "budgets",
    "budgetItems",
    "contracts",
    "receipts",
    "payables",
    "receivables",
    "payments",
    "tithes",
    "expenses",
    "appointments",
  ]);
  if (role === "financeiro") return financeiro.has(resource);
  if (role === "funcionario") return resource === "appointments";
  return false;
}
