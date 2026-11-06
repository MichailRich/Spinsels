"use client";
import { useState } from "react";
import Link from "next/link";
import type { CaseAnalysis } from "@/lib/ai/claude";
import { OUTCOME_LABEL, fmtNum, fmtDays } from "@/lib/labels";

type Resp = {
  features: { categories: string[] }; missing: string[]; ai: CaseAnalysis | null; aiError?: string; model: string | null;
  similar: { ecli: string; score: number; sentence_summary: string | null; outcome: string; court_name: string }[];
  observation: { sufficient: boolean; n: number; taakstraf: { share: number; median: number | null }; onvw: { share: number; median: number | null } };
};

export function AiAnalyse({ initial, labels, enabled }: { initial: string; labels: Record<string, string>; enabled: boolean }) {
  const [text, setText] = useState(initial);
  const [r, setR] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const res = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    setR(await res.json());
    setLoading(false);
  };
  return (
    <div className="space-y-6">
      <div className="card card-pad">
        <textarea className="input min-h-[140px] font-serif text-[15px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Beschrijf de feiten, de omstandigheden van de verdachte en wat er over letsel, strafblad en proceshouding bekend is…" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={loading || text.length < 20} onClick={run}>{loading ? "Analyse loopt… (dit kan even duren)" : "Analyseer casus"}</button>
          {!enabled && <span className="text-xs text-[var(--ink-3)]">AI is niet geconfigureerd: u krijgt de regelgebaseerde analyse.</span>}
        </div>
      </div>
      {r && (
        <div className="grid gap-6 lg:grid-cols-3 fade-in">
          <div className="space-y-6 lg:col-span-2">
            {r.ai ? (
              <section className="card card-pad">
                <div className="flex flex-wrap items-center gap-2"><span className="badge-ai">AI-interpretatie</span><span className="text-[11px] text-[var(--ink-3)]">{r.model} · uitsluitend gebaseerd op de getoonde uitspraken; niet-aangeleverde ECLI’s worden automatisch verwijderd</span></div>
                <h2 className="mt-3 font-serif text-xl text-navy">Mogelijke strafbare feiten</h2>
                <ul className="mt-2 space-y-2 text-sm">{r.ai.mogelijke_feiten.map((f, i) => <li key={i}><b className="text-navy">{f.delict}</b> <span className="badge-fact">{f.wetsartikel}</span><div className="text-[var(--ink-2)]">{f.toelichting}</div></li>)}</ul>
                <h2 className="mt-5 font-serif text-xl text-navy">Vergelijking met gepubliceerde uitspraken</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink-2)]">{r.ai.vergelijking}</p>
                <h2 className="mt-5 font-serif text-xl text-navy">Strafindicatie</h2>
                <div className="mt-2 flex items-center gap-2"><span className="badge-est">Juridische inschatting</span></div>
                {r.ai.strafindicatie.mogelijk ? (
                  <>
                    <p className="mt-2 font-serif text-lg text-navy">{r.ai.strafindicatie.indicatie}</p>
                    <p className="mt-1 text-sm text-[var(--ink-2)]">{r.ai.strafindicatie.onderbouwing}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{r.ai.strafindicatie.ecli_verwijzingen.map((e) => <Link key={e} href={`/uitspraak/${encodeURIComponent(e)}`} className="badge-fact font-mono underline">{e}</Link>)}</div>
                  </>
                ) : <p className="mt-2 text-sm text-[var(--ink-2)]">{r.ai.strafindicatie.onderbouwing || "De beschikbare gegevens laten geen verantwoorde strafindicatie toe."}</p>}
                <p className="mt-4 rounded-lg bg-mist p-3 text-xs text-[var(--ink-2)]">{r.ai.voorbehoud}</p>
              </section>
            ) : (
              <section className="card card-pad">
                {r.aiError && <p className="mb-3 text-sm text-amber-800">{r.aiError}</p>}
                <h2 className="font-serif text-xl text-navy">Regelgebaseerde analyse</h2>
                <p className="mt-2 text-sm text-[var(--ink-2)]">Herkende delicten: {r.features.categories.map((c) => labels[c] ?? c).join(", ") || "geen"}.</p>
                {r.observation.sufficient ? <p className="mt-2 text-sm text-[var(--ink-2)]"><span className="badge-stat mr-1">Statistische observatie</span>In {r.observation.n} sterk vergelijkbare veroordelingen werd in {r.observation.taakstraf.share}% een taakstraf opgelegd (mediaan {fmtNum(r.observation.taakstraf.median)} uur) en in {r.observation.onvw.share}% een onvoorwaardelijke gevangenisstraf (mediaan {fmtDays(r.observation.onvw.median)}).</p> : <p className="mt-2 text-sm text-[var(--ink-2)]">Onvoldoende sterk vergelijkbare gepubliceerde uitspraken voor een strafindicatie.</p>}
                <Link href="/vergelijker" className="mt-3 inline-block text-sm text-gold-600 underline">Verfijn in de strafvergelijker →</Link>
              </section>
            )}
          </div>
          <aside className="space-y-6">
            <section className="card card-pad">
              <div className="label">Ontbrekende gegevens</div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[var(--ink-2)]">{(r.ai?.ontbrekende_gegevens.length ? r.ai.ontbrekende_gegevens : r.missing).map((m) => <li key={m}>{m}</li>)}</ul>
            </section>
            <section className="card card-pad">
              <div className="label">Gebruikte bronnen</div>
              <ul className="mt-2 space-y-2 text-sm">{r.similar.map((s) => <li key={s.ecli}><Link href={`/uitspraak/${encodeURIComponent(s.ecli)}`} className="font-mono text-xs text-navy underline">{s.ecli}</Link> <span className="badge-est">{s.score}%</span><div className="text-xs text-[var(--ink-2)]">{s.outcome === "veroordeling" ? s.sentence_summary : OUTCOME_LABEL[s.outcome]}</div></li>)}</ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
