import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { adminOrNull } from "@/lib/admin";
import { audit } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const u = await adminOrNull();
  if (!u) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  const { id, patch, reason } = await req.json();
  const before = await q1("SELECT * FROM circumstances WHERE id=$1", [id]);
  if (!before) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const sets: string[] = []; const vals: unknown[] = [id];
  for (const k of ["status", "polarity", "review_status"]) if (k in patch) { vals.push(patch[k]); sets.push(`${k}=$${vals.length}`); }
  vals.push(u.id); sets.push(`reviewed_by=$${vals.length}`, "reviewed_at=now()");
  if (!("review_status" in patch)) sets.push("review_status='gecorrigeerd'");
  await q(`UPDATE circumstances SET ${sets.join(", ")} WHERE id=$1`, vals);
  await audit(u.id, "update", "circumstance", String(id), before, await q1("SELECT * FROM circumstances WHERE id=$1", [id]), reason);
  return NextResponse.json({ ok: true });
}
