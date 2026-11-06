import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const ecli = req.nextUrl.searchParams.get("ecli");
  if (ecli) return NextResponse.json({ favorite: (await q("SELECT 1 FROM favorites WHERE user_id=$1 AND ecli=$2", [u.id, ecli])).length > 0 });
  return NextResponse.json(await q("SELECT ecli, note, created_at FROM favorites WHERE user_id=$1 ORDER BY created_at DESC", [u.id]));
}
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { ecli, note } = await req.json();
  await q("INSERT INTO favorites (user_id, ecli, note) VALUES ($1,$2,$3) ON CONFLICT (user_id, ecli) DO UPDATE SET note=EXCLUDED.note", [u.id, ecli, note ?? null]);
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { ecli } = await req.json();
  await q("DELETE FROM favorites WHERE user_id=$1 AND ecli=$2", [u.id, ecli]);
  return NextResponse.json({ ok: true });
}
