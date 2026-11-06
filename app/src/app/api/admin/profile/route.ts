import { NextRequest, NextResponse } from "next/server";
import { q1, q } from "@/lib/db";
import { adminOrNull } from "@/lib/admin";
import { audit } from "@/lib/auth";

const FIELDS = ["primary_category", "categories", "outcome", "acquittal", "recidive", "letsel", "bekentenis", "wapen", "hulpverlener", "huiselijk", "multi_offense", "review_status"] as const;

export async function PATCH(req: NextRequest) {
  const u = await adminOrNull();
  if (!u) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  const { ecli, patch, reason } = await req.json();
  const before = await q1("SELECT * FROM case_profiles WHERE ecli=$1", [ecli]);
  if (!before) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const sets: string[] = [];
  const vals: unknown[] = [ecli];
  for (const f of FIELDS) if (f in patch) { vals.push(patch[f]); sets.push(`${f}=$${vals.length}`); }
  if (!("review_status" in patch)) sets.push("review_status='gecorrigeerd'");
  if (!sets.length) return NextResponse.json({ ok: true });
  await q(`UPDATE case_profiles SET ${sets.join(", ")} WHERE ecli=$1`, vals);
  if (patch.review_status === "geverifieerd") {
    await q("UPDATE case_offenses SET review_status='geverifieerd', reviewed_by=$2, reviewed_at=now() WHERE ecli=$1 AND review_status='auto'", [ecli, u.id]);
    await q("UPDATE sentence_components SET review_status='geverifieerd', reviewed_by=$2, reviewed_at=now() WHERE ecli=$1 AND review_status='auto'", [ecli, u.id]);
    await q("UPDATE circumstances SET review_status='geverifieerd', reviewed_by=$2, reviewed_at=now() WHERE ecli=$1 AND review_status='auto'", [ecli, u.id]);
  }
  const after = await q1("SELECT * FROM case_profiles WHERE ecli=$1", [ecli]);
  await audit(u.id, "update", "case_profile", ecli, pick(before), pick(after), reason);
  return NextResponse.json({ ok: true });
}
function pick(r: Record<string, unknown> | undefined) {
  return r ? Object.fromEntries(FIELDS.map((f) => [f, r[f]])) : null;
}
