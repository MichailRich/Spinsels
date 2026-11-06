import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { adminOrNull, recomputeProfile } from "@/lib/admin";
import { audit } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const u = await adminOrNull();
  if (!u) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  const { ecli, origin, kind, amount, unit, conditional, probation_months, description, evidence, reason } = await req.json();
  const row = await q1("INSERT INTO sentence_components (ecli, origin, kind, amount, unit, conditional, probation_months, description, evidence, extractor, confidence, review_status, reviewed_by, reviewed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'handmatig',1,'gecorrigeerd',$10,now()) RETURNING *",
    [ecli, origin, kind, amount ?? null, unit ?? null, !!conditional, probation_months ?? null, description || kind, evidence || "Handmatig toegevoegd door redactie", u.id]);
  await recomputeProfile(ecli);
  await audit(u.id, "create", "sentence_component", ecli, null, row, reason);
  return NextResponse.json({ ok: true });
}
export async function PATCH(req: NextRequest) {
  const u = await adminOrNull();
  if (!u) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  const { id, patch, reason } = await req.json();
  const before = await q1<{ ecli: string }>("SELECT * FROM sentence_components WHERE id=$1", [id]);
  if (!before) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const allowed = ["kind", "amount", "unit", "conditional", "probation_months", "substitute_days", "description", "origin", "review_status"];
  const sets: string[] = []; const vals: unknown[] = [id];
  for (const k of allowed) if (k in patch) { vals.push(patch[k]); sets.push(`${k}=$${vals.length}`); }
  vals.push(u.id);
  sets.push(`reviewed_by=$${vals.length}`, "reviewed_at=now()");
  if (!("review_status" in patch)) sets.push("review_status='gecorrigeerd'");
  await q(`UPDATE sentence_components SET ${sets.join(", ")} WHERE id=$1`, vals);
  await recomputeProfile(before.ecli);
  await audit(u.id, "update", "sentence_component", String(id), before, await q1("SELECT * FROM sentence_components WHERE id=$1", [id]), reason);
  return NextResponse.json({ ok: true });
}
