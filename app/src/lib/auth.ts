import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { q, q1 } from "./db";

export type User = { id: number; email: string; name: string | null; role: "user" | "admin" };
const COOKIE = "pr_session";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  await q("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2, now() + interval '30 days')", [token, userId]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function destroySession() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (t) await q("DELETE FROM sessions WHERE token=$1", [t]);
  c.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
  const u = await q1<{ id: string; email: string; name: string | null; role: "user" | "admin" }>(
    "SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=$1 AND s.expires_at > now()",
    [t],
  );
  return u ? { ...u, id: Number(u.id) } : null;
}

export async function requireAdmin(): Promise<User> {
  const u = await currentUser();
  if (!u || u.role !== "admin") throw new Response("Geen toegang", { status: 403 });
  return u;
}

export async function audit(userId: number | null, action: string, entity: string, entityId: string, before: unknown, after: unknown, reason?: string) {
  await q("INSERT INTO audit_log (user_id, action, entity, entity_id, before, after, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)", [
    userId, action, entity, entityId, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), reason ?? null,
  ]);
}
