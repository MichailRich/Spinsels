import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
export async function POST() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  await q("UPDATE notifications SET read=true WHERE user_id=$1", [u.id]);
  return NextResponse.json({ ok: true });
}
