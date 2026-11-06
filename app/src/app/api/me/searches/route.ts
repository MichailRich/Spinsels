import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  return NextResponse.json(await q("SELECT id, name, query, alert, created_at FROM saved_searches WHERE user_id=$1 ORDER BY created_at DESC", [u.id]));
}
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { name, query, alert } = await req.json();
  await q("INSERT INTO saved_searches (user_id, name, query, alert) VALUES ($1,$2,$3,$4)", [u.id, String(name).slice(0, 120), JSON.stringify(query ?? {}), !!alert]);
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { id } = await req.json();
  await q("DELETE FROM saved_searches WHERE user_id=$1 AND id=$2", [u.id, id]);
  return NextResponse.json({ ok: true });
}
