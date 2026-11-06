import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { adminOrNull } from "@/lib/admin";
import { audit } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const u = await adminOrNull();
  if (!u) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  const { code, enabled, rate_limit_ms } = await req.json();
  const before = await q1("SELECT * FROM sources WHERE code=$1", [code]);
  await q("UPDATE sources SET enabled=COALESCE($2, enabled), rate_limit_ms=COALESCE($3, rate_limit_ms) WHERE code=$1", [code, enabled ?? null, rate_limit_ms ?? null]);
  await audit(u.id, "update", "source", code, before, await q1("SELECT * FROM sources WHERE code=$1", [code]));
  return NextResponse.json({ ok: true });
}
