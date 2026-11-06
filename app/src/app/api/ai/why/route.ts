import { NextRequest, NextResponse } from "next/server";
import { loadCase } from "@/lib/case/load";
import { aiEnabled, whyThisSentence } from "@/lib/ai/claude";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!aiEnabled()) return NextResponse.json({ error: "AI-analyse is niet geconfigureerd." }, { status: 503 });
  if (!rateLimit(req, "ai", 20)) return NextResponse.json({ error: "Te veel verzoeken; probeer het later opnieuw." }, { status: 429 });
  const ecli = req.nextUrl.searchParams.get("ecli") ?? "";
  const c = await loadCase(ecli);
  if (!c?.profile?.motivation) return NextResponse.json({ error: "Geen strafmotivering beschikbaar voor deze uitspraak." }, { status: 404 });
  try {
    const r = await whyThisSentence({ ecli, fullText: c.doc.full_text, motivation: c.profile.motivation, sentence: c.profile.sentence_summary ?? "", eis: c.profile.eis_summary });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: `AI-analyse mislukt: ${(e as Error).message}` }, { status: 502 });
  }
}
