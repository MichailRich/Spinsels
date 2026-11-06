import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!rateLimit(req, "register", 10)) return NextResponse.json({ error: "Te veel pogingen." }, { status: 429 });
  const { email, password, name } = await req.json();
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Ongeldig e-mailadres." }, { status: 400 });
  if (typeof password !== "string" || password.length < 10) return NextResponse.json({ error: "Wachtwoord moet minimaal 10 tekens bevatten." }, { status: 400 });
  if (await q1("SELECT 1 FROM users WHERE email=$1", [email.toLowerCase()])) return NextResponse.json({ error: "Er bestaat al een account met dit e-mailadres." }, { status: 409 });
  const [u] = await q<{ id: string }>("INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id", [email.toLowerCase(), typeof name === "string" ? name.slice(0, 100) : null, hashPassword(password)]);
  await createSession(Number(u.id));
  return NextResponse.json({ ok: true });
}
