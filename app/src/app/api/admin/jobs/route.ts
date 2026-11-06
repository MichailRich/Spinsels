import { NextRequest, NextResponse } from "next/server";
import { adminOrNull, enqueue } from "@/lib/admin";
import { audit } from "@/lib/auth";

const TYPES = ["discover", "fetch", "extract", "extract_all", "alerts"];
export async function POST(req: NextRequest) {
  const u = await adminOrNull();
  if (!u) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  const { type } = await req.json();
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Onbekend proces" }, { status: 400 });
  await enqueue(type, {}, `manual:${type}`);
  await audit(u.id, "enqueue", "job", type, null, { type });
  return NextResponse.json({ ok: true, message: "In de wachtrij geplaatst; de worker (npm run worker) voert het uit." });
}
