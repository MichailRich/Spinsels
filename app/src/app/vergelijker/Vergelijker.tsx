"use client";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FilterOptions } from "@/lib/options";
import type { Similar, CaseFeatures } from "@/lib/search/similar";
import { RECIDIVE_LABEL, RECIDIVE_ORDER, LETSEL_LABEL, LETSEL_ORDER, BEKENTENIS_LABEL, OUTCOME_LABEL, fmtDate, fmtDays, fmtNum } from "@/lib/labels";

type Result = {
  features: CaseFeatures & { notes?: string[] };
  missing: string[];
  similar: Similar[];
  observation: { n: number; sufficient: boolean; taakstraf: Obs; onvw: Obs; vw: { share: number }; boete: Obs; acquitShare: number };
  lovs: { heading: string; page: number; text: string; url: string; note: string }[];
};
type Obs = { share: number; p25: number | null; median: number | null; p75: number | null; n: number };

const EXAMPLE = "Een verdachte van 28 jaar heeft tijdens een caféruzie een ander geslagen. Het slachtoffer heeft een gebroken neus. Verdachte heeft geen strafblad, heeft bekend en heeft excuses aangeboden.";

export function Vergelijker({ options, initialEcli }: { options: FilterOptions; initialEcli?: string }) {
  const [text, setText] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();

  const run = async (body: object) => {
    setLoading(true); setErr("");
    const r = await fetch("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) return setErr(d.error ?? "Er ging iets mis.");
    setRes(d);
  };
  useEffect(() => { if (initialEcli) run({ ecli: initialEcli }); }, [initialEcli]);

  const f = res?.features;
  const setF = (patch: Partial<CaseFeatures>) => f && run({ features: { ...f, ...patch } });
  const save = async () => {
    const name = prompt("Naam voor deze vergelijking:", "Mijn casus");
    if (!name || !res) return;
    const r = await fetch("/api/me/comparisons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, caseText: text, eclis: res.similar.slice(0, 20).map((s) => s.ecli), result: { features: res.features, observation: res.observation } }) });
    alert(r.status === 401 ? "Log in om vergelijkingen op te slaan." : r.ok ? "Vergelijking opgeslagen in uw onderzoeksomgeving." : "Opslaan mislukt.");
  };
  const o = res?.observation;

  return (
    <div>
      <div className="card card-pad">
        <label htmlFor="casus" className="label">Beschrijf de casus</label>
        <textarea id="casus" className="input mt-2 min-h-[130px] font-serif text-[15px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={loading} onClick={() => run({ text: text || EXAMPLE })}>{loading ? "Bezig…" : "Vergelijk mijn zaak"}</button>
          {!text && <button className="btn-ghost" onClick={() => setText(EXAMPLE)}>Voorbeeld invullen</button>}
          <span className="text-xs text-[var(--ink-3)]">Deel geen namen of andere persoonsgegevens. De tekst wordt niet opgeslagen tenzij u de vergelijking bewaart.</span>
        </div>
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      </div>

      {res && f && (
        <div className={`mt-6 space-y-6 fade-in ${loading ? "opacity-60" : ""}`}>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card card-pad">
              <h2 className="font-serif text-xl text-navy">1. Herkende kenmerken</h2>
              <p className="mt-1 text-xs text-[var(--ink-3)]">Automatisch herkend — pas aan waar nodig; de vergelijking wordt direct opnieuw berekend.</p>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="label mb-1">Mogelijke strafbare feiten</div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.categories.map((c) => <button key={c} className="chip-on" onClick={() => setF({ categories: f.categories.filter((x) => x !== c) })}>{options.categories.find((x) => x.code === c)?.label} ✕</button>)}
                    <select className="input !w-auto !py-1 text-xs" value="" onChange={(e) => e.target.value && setF({ categories: [...f.categories, e.target.value] })}>
                      <option value="">+ toevoegen</option>
                      {options.categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Sel label="Documentatie" value={f.recidive ?? "onbekend"} opts={RECIDIVE_ORDER.map((k) => [k, RECIDIVE_LABEL[k]])} onChange={(v) => setF({ recidive: v })} />
                  <Sel label="Letsel" value={f.letsel ?? "onbekend"} opts={[...LETSEL_ORDER, "nvt"].map((k) => [k, LETSEL_LABEL[k]])} onChange={(v) => setF({ letsel: v })} />
                  <Sel label="Proceshouding" value={f.bekentenis ?? "onbekend"} opts={Object.entries(BEKENTENIS_LABEL)} onChange={(v) => setF({ bekentenis: v })} />
                </div>
                <div className="flex flex-wrap gap-4">
                  {(["wapen", "hulpverlener", "huiselijk"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-1.5"><input type="checkbox" className="accent-[#14263D]" checked={!!f[k]} onChange={(e) => setF({ [k]: e.target.checked || null })} />{k === "wapen" ? "Wapen" : k === "hulpverlener" ? "Tegen hulpverlener" : "Huiselijke kring"}</label>
                  ))}
                </div>
                {!!f.notes?.length && <p className="text-xs text-[var(--ink-3)]">Ook herkend: {f.notes.join(", ")} (meegenomen in de tekstuele vergelijking).</p>}
              </div>
            </section>
            <section className="card card-pad">
              <h2 className="font-serif text-xl text-navy">2. Ontbrekende juridisch relevante gegevens</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--ink-2)]">{res.missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </section>
          </div>

          <section className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl text-navy">3. Wat legden politierechters op in vergelijkbare zaken?</h2>
              <span className="badge-stat">Statistische observatie</span>
            </div>
            {o?.sufficient ? (
              <>
                <p className="mt-2 text-sm text-[var(--ink-2)]">Gebaseerd op de {o.n} meest vergelijkbare gepubliceerde veroordelingen (vergelijkbaarheid ≥ 60% en ten minste drie bekende kenmerken).</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Tile k="Taakstraf opgelegd" v={`${o.taakstraf.share}%`} sub={o.taakstraf.n ? `mediaan ${fmtNum(o.taakstraf.median)} uur (${fmtNum(o.taakstraf.p25)}–${fmtNum(o.taakstraf.p75)})` : undefined} />
                  <Tile k="Onvoorw. gevangenisstraf" v={`${o.onvw.share}%`} sub={o.onvw.n ? `mediaan ${fmtDays(o.onvw.median)} (${fmtDays(o.onvw.p25)}–${fmtDays(o.onvw.p75)})` : undefined} />
                  <Tile k="Voorw. gevangenisstraf" v={`${o.vw.share}%`} />
                  <Tile k="Geldboete" v={`${o.boete.share}%`} sub={o.boete.n ? `mediaan € ${fmtNum(o.boete.median)}` : undefined} />
                </dl>
                <p className="mt-3 text-xs text-[var(--ink-3)]"><strong>Strafindicatie met voorbehoud:</strong> dit beschrijft uitsluitend gepubliceerde uitspraken die op de herkende kenmerken lijken. Het is geen voorspelling: niet alle zaken worden gepubliceerd, en de rechter weegt alle omstandigheden van het concrete geval. Tussen haakjes: 25e–75e percentiel.</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--ink-2)]">Er zijn onvoldoende sterk vergelijkbare gepubliceerde veroordelingen ({o?.n ?? 0}) om een verantwoorde strafindicatie te geven. Vul ontbrekende gegevens aan of bekijk de afzonderlijke uitspraken hieronder.</p>
            )}
          </section>

          {res.lovs.map((l) => (
            <section key={l.heading} className="card card-pad">
              <h2 className="font-serif text-xl text-navy">LOVS-oriëntatiepunt: {l.heading}</h2>
              <p className="mt-1 text-xs text-[var(--ink-3)]">{l.note}</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre font-mono text-[11.5px] leading-snug text-navy">{l.text}</pre>
              <a className="mt-2 inline-block text-sm text-gold-600 underline" href={l.url} target="_blank" rel="noopener">Officieel document ↗</a>
            </section>
          ))}

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5">
              <h2 className="font-serif text-xl text-navy">4. Vergelijkbare politierechteruitspraken</h2>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={save}>Vergelijking bewaren</button>
                <Link className="btn-ghost" href={`/ai-analyse?text=${encodeURIComponent(text || EXAMPLE)}`}>AI-casusanalyse →</Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-x">
                <thead><tr><th>ECLI</th><th>Rechtbank</th><th>Datum</th><th>Strafbaar feit</th><th>Letsel</th><th>Recidive</th><th>Bekentenis</th><th>Opgelegde straf</th><th>Vergelijkbaarheid</th></tr></thead>
                <tbody>
                  {res.similar.slice(0, 25).map((s) => (
                    <Fragment key={s.ecli}>
                      <tr className="cursor-pointer hover:bg-mist" onClick={() => router.push(`/uitspraak/${encodeURIComponent(s.ecli)}`)}>
                        <td className="whitespace-nowrap font-mono text-xs text-navy">{s.ecli}</td>
                        <td className="text-xs">{s.court_name.replace("Rechtbank ", "")}</td>
                        <td className="whitespace-nowrap text-xs">{fmtDate(s.decision_date)}</td>
                        <td className="text-xs">{s.categories.map((c) => options.categories.find((x) => x.code === c)?.label ?? c).join(", ")}{s.multi_offense && <span className="ml-1 badge bg-amber-50 text-amber-800">meerdere feiten</span>}</td>
                        <td className="text-xs">{LETSEL_LABEL[s.letsel]}</td>
                        <td className="text-xs">{RECIDIVE_LABEL[s.recidive]}</td>
                        <td className="text-xs">{BEKENTENIS_LABEL[s.bekentenis]}</td>
                        <td className="max-w-[240px] text-[13px] font-medium text-navy">{s.outcome === "veroordeling" ? s.sentence_summary : OUTCOME_LABEL[s.outcome]}</td>
                        <td onClick={(e) => { e.stopPropagation(); setOpen(open === s.ecli ? null : s.ecli); }}>
                          <div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-mist"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${s.score}%` }} /></div><span className="text-xs tabular-nums">{s.score}%</span></div>
                          <button className="text-[11px] text-gold-600 underline">waarom?</button>
                        </td>
                      </tr>
                      {open === s.ecli && (
                        <tr><td colSpan={9} className="bg-mist/60">
                          <div className="text-xs text-[var(--ink-2)]">Score = behaalde punten / maximaal haalbare punten. Kenmerken die in uw casus bekend zijn maar in de uitspraak niet worden vermeld, tellen voor 30% ({s.known} kenmerken in beide bekend):</div>
                          <ul className="mt-1 grid gap-x-6 text-xs sm:grid-cols-2">{s.parts.map((p) => <li key={p.label}>{p.label}: <b>{p.got}</b> / {p.max} — {p.detail}</li>)}</ul>
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {!res.similar.length && <p className="p-6 text-sm text-[var(--ink-3)]">Geen vergelijkbare uitspraken gevonden. Voeg een strafbaar feit toe.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function Sel({ label, value, opts, onChange }: { label: string; value: string; opts: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="block"><span className="label">{label}</span>
      <select className="input mt-1 !py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    </label>
  );
}
function Tile({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return <div className="rounded-lg bg-mist p-3"><dt className="text-[10.5px] uppercase tracking-wider text-[var(--ink-3)]">{k}</dt><dd className="font-serif text-2xl text-navy">{v}</dd>{sub && <div className="text-[11.5px] text-[var(--ink-2)]">{sub}</div>}</div>;
}
