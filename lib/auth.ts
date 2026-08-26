import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

const COOKIE = "terracusto_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "development-secret-change-me");

export type Session = { userId: string; name: string; email: string };

export async function createSession(user: Session) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("8h").sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 8,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch { return null; }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getPermissions(userId: string) {
  const rows = await db.permission.findMany({
    where: { roles: { some: { role: { users: { some: { userId } } } } } },
    select: { code: true },
  });
  return new Set(rows.map((row) => row.code));
}

export async function requirePermission(code: string) {
  const user = await requireUser();
  const permissions = await getPermissions(user.userId);
  if (!permissions.has(code)) redirect("/sem-permissao");
  return user;
}
