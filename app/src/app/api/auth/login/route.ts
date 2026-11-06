import { NextRequest, NextResponse } from "next/server";
import { q1 } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!rateLimit(req, "login", 30)) return NextResponse.json({ error: "Te veel pogingen; probeer het later opnieuw." }, { status: 429 });
  const { email, password } = await req.json();
  const u = await q1<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email=$1", [String(email ?? "").toLowerCase()]);
  if (!u || !verifyPassword(String(password ?? ""), u.password_hash)) return NextResponse.json({ error: "Onjuiste combinatie van e-mailadres en wachtwoord." }, { status: 401 });
  await createSession(Number(u.id));
  return NextResponse.json({ ok: true });
}
