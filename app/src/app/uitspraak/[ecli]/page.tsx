import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadCase, type ComponentRow } from "@/lib/case/load";
import { ruleBasedWhy } from "@/lib/case/why";
import { findSimilar, scoreLabel } from "@/lib/search/similar";
import { offenseLabel } from "@/lib/reference/offenses";
import { articleLabel, articleUrl, ARTICLE_BY_CODE } from "@/lib/reference/articles";
import { CIRCUMSTANCES } from "@/lib/extract/circumstances";
import { KIND_LABEL } from "@/lib/extract/sanctions";
import { roleSpans } from "@/lib/extract/text";
import { HighlightedText } from "@/components/HighlightedText";
import { CaseActions } from "@/components/CaseActions";
import { AiWhy } from "@/components/AiWhy";
import { aiEnabled } from "@/lib/ai/claude";
import { RECIDIVE_LABEL, LETSEL_LABEL, BEKENTENIS_LABEL, OUTCOME_LABEL, REVIEW_LABEL, fmtDate, fmtDays, fmtNum } from "@/lib/labels";

type P = { params: Promise<{ ecli: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const ecli = decodeURIComponent((await params).ecli);
  return { title: ecli };
}

function amount(c: ComponentRow) {
  if (c.amount == null) return "–";
  if (c.unit === "dagen") return fmtDays(c.amount);
  if (c.unit === "euro") return `€ ${fmtNum(c.amount, 2)}`;
  if (c.unit === "uren") return `${fmtNum(c.amount)} uur`;
  if (c.unit === "maanden") return `${fmtNum(c.amount, 1)} maanden`;
  return String(c.amount);
}

export default async function CasePage({ params }: P) {
  const ecli = decodeURIComponent((await params).ecli).toUpperCase();
  const c = await loadCase(ecli);
  if (!c) notFound();
  const { doc, profile: p } = c;
  const imposed = c.components.filter((x) => x.origin === "opgelegd" && x.kind !== "tul_eerder");
  const tul = c.components.filter((x) => x.kind === "tul_eerder");
  const eis = c.components.filter((x) => x.origin === "eis_om");
  const quals = c.offenses.filter((o) => o.role === "kwalificatie");
  const tll = c.offenses.filter((o) => o.role !== "kwalificatie");
  const why = ruleBasedWhy(c);
  const similar = p?.categories.length
    ? await findSimilar({ categories: p.categories, recidive: p.recidive, letsel: p.letsel, bekentenis: p.bekentenis, wapen: p.wapen, hulpverlener: p.hulpverlener, huiselijk: p.huiselijk, multi: p.multi_offense }, { excludeEcli: ecli, limit: 8 })
    : [];
  const roles = roleSpans(doc.full_text, doc.sections);
  const bew = roles.get("bewezenverklaring")?.at(-1);
  const weighed = c.circumstances.filter((x) => x.status === "meegewogen");
  const mentioned = c.circumstances.filter((x) => x.status === "genoemd");
  const unknown = ["recidive", "letsel", "bekentenis"].filter((k) => (k === "recidive" ? p?.recidive === "onbekend" : k === "letsel" ? p?.letsel === "onbekend" : p?.bekentenis === "onbekend"));
  const marks = [
    ...c.components.filter((x) => x.evidence_start != null).map((x) => ({ start: x.evidence_start!, end: x.evidence_end!, label: `${x.origin === "eis_om" ? "Eis OM" : "Opgelegd"}: ${x.description}` })),
    ...c.circumstances.filter((x) => x.evidence_start != null).map((x) => ({ start: x.evidence_start!, end: x.evidence_end!, label: CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label ?? x.code })),
    ...c.offenses.filter((x) => x.evidence_start != null).map((x) => ({ start: x.evidence_start!, end: x.evidence_end!, label: `Feit: ${offenseLabel(x.category_code)}` })),
  ];

  return (
    <div className="container-x py-8">
      <nav className="text-xs text-[var(--ink-3)]"><Link href="/zoeken" className="hover:underline">Zoeken</Link> / {p?.primary_category && <><Link href={`/delicten/${p.primary_category}`} className="hover:underline">{offenseLabel(p.primary_category)}</Link> / </>}{ecli}</nav>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-sm text-gold-600">{ecli}</div>
          <h1 className="h-display mt-1 text-3xl">{p?.categories.length ? p.categories.map(offenseLabel).join(" · ") : "Politierechtervonnis"}</h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">{doc.court_name} · uitspraak {fmtDate(doc.decision_date)} · gepubliceerd {fmtDate(doc.publication_date)}{doc.zaaknummer && <> · parketnummer {doc.zaaknummer}</>}</p>
        </div>
        <CaseActions ecli={ecli} />
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <a href={doc.deeplink} target="_blank" rel="noopener" className="badge-fact underline">Oorspronkelijke uitspraak op Rechtspraak.nl ↗</a>
        <span className="badge-fact">Bronversie {doc.version} · opgehaald {doc.fetched_at}</span>
        <span className={p?.review_status === "auto" ? "badge bg-amber-50 text-amber-800" : "badge-stat"}>{REVIEW_LABEL[p?.review_status ?? "auto"]}</span>
        {doc.politierechter_evidence && <span className="badge-fact" title="Herkend als politierechtervonnis op basis van deze passage">“{doc.politierechter_evidence.slice(0, 70)}”</span>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* kern */}
          <section className="card card-pad">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="label flex items-center gap-2">Opgelegde straf <span className="badge-fact normal-case tracking-normal">uit de uitspraak</span></div>
                <div className="mt-1 font-serif text-xl text-navy">{p?.outcome === "veroordeling" ? p.sentence_summary : OUTCOME_LABEL[p?.outcome ?? "onbekend"]}</div>
                {p?.acquittal === "gedeeltelijk" && <div className="mt-1 text-xs text-[var(--ink-3)]">Gedeeltelijke vrijspraak</div>}
              </div>
              <div>
                <div className="label flex items-center gap-2">Eis officier van justitie <span className="badge-fact normal-case tracking-normal">uit de uitspraak</span></div>
                <div className="mt-1 font-serif text-xl text-[var(--ink-2)]">{p?.eis_summary ?? "Niet vermeld"}</div>
              </div>
            </div>
            {imposed.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="table-x">
                  <thead><tr><th>Strafcomponent</th><th>Hoogte</th><th>Voorwaardelijk</th><th>Proeftijd</th><th>Vervangende hechtenis</th><th>Bron</th></tr></thead>
                  <tbody>
                    {imposed.map((x) => (
                      <tr key={x.id}>
                        <td>{x.description}</td><td className="font-medium text-navy">{amount(x)}</td><td>{x.conditional ? "ja" : "nee"}</td>
                        <td>{x.probation_months ? `${fmtNum(x.probation_months)} mnd` : "–"}</td><td>{x.substitute_days ? `${fmtNum(x.substitute_days)} dagen` : "–"}</td>
                        <td>{x.evidence_start != null ? <a className="text-gold-600 underline" href={`#pos-${x.evidence_start}`}>passage</a> : <span className="text-xs text-[var(--ink-3)]">inhoudsindicatie</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {eis.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-[var(--ink-2)]">Eis OM per component vergelijken</summary>
                <table className="table-x mt-2">
                  <thead><tr><th>Component</th><th>Eis OM</th><th>Opgelegd</th></tr></thead>
                  <tbody>{eis.map((e) => {
                    const match = imposed.filter((x) => (x.kind === e.kind || (["gevangenisstraf", "hechtenis"].includes(x.kind) && ["gevangenisstraf", "hechtenis"].includes(e.kind))) && x.conditional === e.conditional);
                    const sum = match.reduce((a, x) => a + (x.amount ?? 0), 0);
                    return <tr key={e.id}><td>{KIND_LABEL[e.kind as keyof typeof KIND_LABEL] ?? e.kind}{e.conditional ? " (voorwaardelijk)" : ""}</td><td>{amount(e)}</td><td>{match.length ? amount({ ...e, amount: sum }) : <span className="text-[var(--ink-3)]">niet opgelegd</span>}</td></tr>;
                  })}</tbody>
                </table>
                <p className="mt-1 text-xs text-[var(--ink-3)]">Alleen gelijksoortige componenten worden naast elkaar gezet (onvoorwaardelijk met onvoorwaardelijk).</p>
              </details>
            )}
            {tul.length > 0 && <p className="mt-3 text-xs text-[var(--ink-3)]">Daarnaast is de tenuitvoerlegging van een eerder opgelegde straf gelast; dit telt niet mee als straf in deze zaak.</p>}
          </section>

          {/* waarom */}
          <section className="card card-pad">
            <h2 className="h-display text-2xl">Waarom deze straf?</h2>
            <div className="mt-2 flex items-center gap-2"><span className="badge-fact">Vaststaande gegevens</span><span className="text-xs text-[var(--ink-3)]">automatisch samengesteld uit geëxtraheerde gegevens</span></div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-navy">{why.map((w, i) => <li key={i}>{w}</li>)}</ul>
            {p?.motivation && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gold-600">Strafmotivering van de politierechter (oorspronkelijke tekst)</summary>
                <div className="passage mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap">{p.motivation}</div>
              </details>
            )}
            <div className="mt-4"><AiWhy ecli={ecli} enabled={aiEnabled() && !!p?.motivation} /></div>
          </section>

          {/* omstandigheden */}
          <section className="card card-pad">
            <h2 className="h-display text-2xl">Omstandigheden</h2>
            <p className="mt-1 text-sm text-[var(--ink-3)]">Onderscheid tussen omstandigheden die de politierechter uitdrukkelijk meeweegt, die alleen in de uitspraak worden genoemd, en waarover geen informatie is.</p>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {(["verzwarend", "verminderend"] as const).map((pol) => (
                <div key={pol}>
                  <div className="label mb-2">{pol === "verzwarend" ? "Strafverzwarend — meegewogen" : "Strafverminderend — meegewogen"}</div>
                  {weighed.filter((x) => x.polarity === pol).length ? (
                    <ul className="space-y-3">
                      {weighed.filter((x) => x.polarity === pol).map((x) => (
                        <li key={x.id}>
                          <div className="text-sm font-medium text-navy">{CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label}</div>
                          <blockquote className="passage mt-1 text-[13px]">“{x.evidence}” {x.evidence_start != null && <a href={`#pos-${x.evidence_start}`} className="ml-1 font-sans text-[11px] text-gold-600 underline">in uitspraak</a>}</blockquote>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-[var(--ink-3)]">Geen herkend in de strafmotivering.</p>}
                </div>
              ))}
            </div>
            {mentioned.length > 0 && (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-[var(--ink-2)]">Alleen genoemd in de uitspraak ({mentioned.length}) — niet (herkenbaar) door de politierechter meegewogen</summary>
                <ul className="mt-2 space-y-2">{mentioned.map((x) => (
                  <li key={x.id} className="text-[13px]"><span className="font-medium text-navy">{CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label}:</span> <span className="text-[var(--ink-2)]">“{x.evidence.slice(0, 260)}{x.evidence.length > 260 ? "…" : ""}”</span></li>
                ))}</ul>
              </details>
            )}
            {unknown.length > 0 && <p className="mt-4 rounded-lg bg-mist p-3 text-[13px] text-[var(--ink-2)]"><strong>Geen informatie in de uitspraak over:</strong> {unknown.map((k) => (k === "recidive" ? "eerdere veroordelingen (dit betekent niet dat er een blanco strafblad is)" : k === "letsel" ? "letsel" : "bekennen/ontkennen")).join("; ")}.</p>}
          </section>

          {/* feiten */}
          <section className="card card-pad">
            <h2 className="h-display text-2xl">Feiten en kwalificatie</h2>
            {doc.inhoudsindicatie && <><div className="label mt-3">Inhoudsindicatie (Rechtspraak)</div><p className="mt-1 text-sm text-navy">{doc.inhoudsindicatie}</p></>}
            {bew && <><div className="label mt-4">Bewezenverklaring</div><div className="passage mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap">{doc.full_text.slice(bew.start, Math.min(bew.end, bew.start + 4000))}</div></>}
            <div className="label mt-4">Juridische kwalificatie</div>
            {quals.length ? (
              <ul className="mt-1 space-y-1.5 text-sm">{quals.map((o) => (
                <li key={o.id}><span className="font-medium text-navy">{offenseLabel(o.category_code)}</span>{o.feit_nr && <span className="text-[var(--ink-3)]"> (feit {o.feit_nr})</span>} — <span className="text-[var(--ink-2)]">{o.qualification}</span></li>
              ))}</ul>
            ) : <p className="text-sm text-[var(--ink-3)]">Geen kwalificatie herkend (bijvoorbeeld bij vrijspraak).</p>}
            {tll.length > 0 && <><div className="label mt-4">Ten laste gelegd{p?.outcome === "vrijspraak" ? " (vrijgesproken)" : ""}</div><ul className="mt-1 space-y-1 text-sm">{tll.map((o) => <li key={o.id}><span className="font-medium text-navy">{offenseLabel(o.category_code)}</span> — <span className="text-[var(--ink-2)]">{o.qualification.slice(0, 220)}</span></li>)}</ul></>}
            {!!p?.articles.length && (
              <>
                <div className="label mt-4">Toegepaste wetsartikelen</div>
                <ul className="mt-1 flex flex-wrap gap-2 text-sm">{p.articles.map((a) => (
                  <li key={a}><a className="chip" href={articleUrl(a, doc.decision_date) ?? "#"} target="_blank" rel="noopener" title={`${ARTICLE_BY_CODE.get(a)?.title ?? ""} — wettekst zoals geldend op ${doc.decision_date}`}>{articleLabel(a)} ↗</a></li>
                ))}</ul>
                <p className="mt-1 text-[11px] text-[var(--ink-3)]">Links openen de wetsversie die gold op de uitspraakdatum (wetten.overheid.nl).</p>
              </>
            )}
          </section>

          <details className="card card-pad" id="tekst">
            <summary className="cursor-pointer font-serif text-xl text-navy">Volledige tekst van de uitspraak</summary>
            <p className="mt-2 text-xs text-[var(--ink-3)]">Gemarkeerde passages liggen ten grondslag aan de geëxtraheerde gegevens. Bron: Open Data van de Rechtspraak (geanonimiseerd door de Rechtspraak).</p>
            <div className="mt-4"><HighlightedText text={doc.full_text} marks={marks} /></div>
          </details>
        </div>

        <aside className="space-y-6">
          <section className="card card-pad">
            <div className="label">Kenmerken</div>
            <dl className="mt-2 space-y-2 text-sm">
              {[["Justitiële documentatie", RECIDIVE_LABEL[p?.recidive ?? "onbekend"]], ["Letsel", LETSEL_LABEL[p?.letsel ?? "onbekend"]], ["Proceshouding", BEKENTENIS_LABEL[p?.bekentenis ?? "onbekend"]],
                ["Wapen", p?.wapen ? "ja (vermeld)" : "niet vermeld"], ["Tegen hulpverlener/ambtenaar", p?.hulpverlener ? "ja" : "niet vermeld"], ["Aantal bewezen feiten", p?.offense_count ? String(p.offense_count) : "–"],
                ...(p?.alcohol_ugl ? [["Ademalcoholgehalte", `${p.alcohol_ugl} µg/l`]] : [])].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-0"><dt className="text-[var(--ink-3)]">{k}</dt><dd className="text-right text-navy">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-[var(--ink-3)]">Extractie: {p?.extractor} · kwaliteitsscore {Math.round((p?.extraction_quality ?? 0) * 100)}%</p>
          </section>
          <section className="card card-pad">
            <div className="label">Vergelijkbare uitspraken</div>
            {similar.length ? (
              <ul className="mt-3 space-y-3">{similar.map((s) => (
                <li key={s.ecli}>
                  <Link href={`/uitspraak/${encodeURIComponent(s.ecli)}`} className="group block">
                    <div className="flex justify-between gap-2"><span className="font-mono text-[11.5px] text-navy group-hover:underline">{s.ecli}</span><span className="badge-est" title={s.parts.map((x) => `${x.label}: ${x.got}/${x.max} (${x.detail})`).join("\n")}>{s.score}%</span></div>
                    <div className="text-[13px] font-medium text-navy">{s.outcome === "veroordeling" ? s.sentence_summary : OUTCOME_LABEL[s.outcome]}</div>
                    <div className="text-[11px] text-[var(--ink-3)]">{s.court_name.replace("Rechtbank ", "Rb. ")} · {fmtDate(s.decision_date)} · {scoreLabel(s.score, s.known)}</div>
                  </Link>
                </li>
              ))}</ul>
            ) : <p className="mt-2 text-sm text-[var(--ink-3)]">Geen vergelijkbare uitspraken gevonden.</p>}
            <Link href={`/vergelijker?ecli=${encodeURIComponent(ecli)}`} className="mt-4 inline-block text-sm font-medium text-gold-600 hover:underline">Uitgebreide vergelijking →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
