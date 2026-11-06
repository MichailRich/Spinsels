import { NextRequest, NextResponse } from "next/server";
import { compareCase, detectFeatures } from "@/lib/case/compare";
import { loadCase } from "@/lib/case/load";
import type { CaseFeatures } from "@/lib/search/similar";

export async function POST(req: NextRequest) {
  const body = await req.json();
  let f: CaseFeatures & { notes?: string[] };
  if (body.features) f = body.features;
  else if (body.ecli) {
    const c = await loadCase(String(body.ecli));
    if (!c?.profile) return NextResponse.json({ error: "Uitspraak niet gevonden" }, { status: 404 });
    const p = c.profile;
    f = { categories: p.categories, recidive: p.recidive, letsel: p.letsel, bekentenis: p.bekentenis, wapen: p.wapen, hulpverlener: p.hulpverlener, huiselijk: p.huiselijk, multi: p.multi_offense, text: c.doc.inhoudsindicatie ?? "" };
  } else {
    const text = String(body.text ?? "").slice(0, 4000);
    if (text.trim().length < 15) return NextResponse.json({ error: "Beschrijf de casus in minimaal één zin." }, { status: 400 });
    f = detectFeatures(text);
  }
  return NextResponse.json(await compareCase(f, body.ecli));
}
