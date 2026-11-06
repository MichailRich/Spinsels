import { NextRequest, NextResponse } from "next/server";
import { aiEnabled, analyzeCase, AI_MODEL } from "@/lib/ai/claude";
import { compareCase, detectFeatures } from "@/lib/case/compare";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  const t = String(text ?? "").slice(0, 4000);
  if (t.trim().length < 20) return NextResponse.json({ error: "Beschrijf de casus uitgebreider." }, { status: 400 });
  const f = detectFeatures(t);
  const cmp = await compareCase(f);
  const top = cmp.similar.filter((s) => s.score >= 50).slice(0, 8);
  const base = { features: cmp.features, missing: cmp.missing, observation: cmp.observation, similar: top, lovs: cmp.lovs, ai: null as unknown, model: null as string | null };
  if (!aiEnabled()) return NextResponse.json({ ...base, aiError: "AI-analyse is op deze installatie niet geconfigureerd; hieronder de regelgebaseerde analyse." });
  if (!rateLimit(req, "ai", 20)) return NextResponse.json({ ...base, aiError: "Limiet voor AI-analyses bereikt; probeer het later opnieuw." });
  const motivations = await q<{ ecli: string; motivation: string | null; facts_summary: string | null }>("SELECT ecli, motivation, facts_summary FROM case_profiles WHERE ecli = ANY($1)", [top.map((s) => s.ecli)]);
  const o = cmp.observation;
  const stats = o.sufficient ? `Van ${o.n} sterk vergelijkbare veroordelingen: taakstraf in ${o.taakstraf.share}% (mediaan ${o.taakstraf.median ?? "–"} uur), onvoorwaardelijke gevangenisstraf in ${o.onvw.share}% (mediaan ${o.onvw.median ?? "–"} dagen), voorwaardelijke gevangenisstraf in ${o.vw.share}%, geldboete in ${o.boete.share}%.` : "Onvoldoende sterk vergelijkbare uitspraken voor statistiek.";
  try {
    const ai = await analyzeCase(t, top.map((s) => {
      const m = motivations.find((x) => x.ecli === s.ecli);
      return { ecli: s.ecli, summary: m?.facts_summary ?? "", sentence: s.outcome === "veroordeling" ? s.sentence_summary ?? "" : s.outcome, motivation: m?.motivation ?? "" };
    }), stats + (cmp.lovs[0] ? `\nLOVS-oriëntatiepunt (letterlijk):\n${cmp.lovs[0].text}` : ""));
    return NextResponse.json({ ...base, ai, model: AI_MODEL });
  } catch (e) {
    return NextResponse.json({ ...base, aiError: `AI-analyse mislukt: ${(e as Error).message}` });
  }
}
