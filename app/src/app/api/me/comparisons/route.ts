import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { name, caseText, eclis, result } = await req.json();
  await q("INSERT INTO saved_comparisons (user_id, name, case_text, eclis, result) VALUES ($1,$2,$3,$4,$5)", [u.id, String(name ?? "Vergelijking").slice(0, 120), caseText ?? null, Array.isArray(eclis) ? eclis.slice(0, 50) : [], result ? JSON.stringify(result) : null]);
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { id } = await req.json();
  await q("DELETE FROM saved_comparisons WHERE user_id=$1 AND id=$2", [u.id, id]);
  return NextResponse.json({ ok: true });
}
