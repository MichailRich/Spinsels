"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FilterPanel } from "@/components/FilterPanel";
import { SearchBar } from "@/components/SearchBar";
import type { Filters } from "@/lib/filters";
import { filtersToParams } from "@/lib/filters";
import type { FilterOptions } from "@/lib/options";
import type { CaseRow } from "@/lib/search/query";
import { offenseLabel } from "@/lib/reference/offenses";
import { RECIDIVE_LABEL, LETSEL_LABEL, OUTCOME_LABEL, fmtDate, fmtNum } from "@/lib/labels";
import { SaveSearchButton } from "@/components/SaveSearchButton";

export function SearchClient({ initialFilters, notes, question, options }: { initialFilters: Filters; notes: string[]; question: string; options: FilterOptions }) {
  const [f, setF] = useState<Filters>(initialFilters);
  const [sort, setSort] = useState("datum");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: CaseRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const params = useMemo(() => filtersToParams(f).toString(), [f]);

  useEffect(() => {
    router.replace(`/zoeken${params ? `?${params}` : ""}`, { scroll: false });
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/search?${params}&page=${page}&sort=${sort}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [params, page, sort, router]);

  const update = (nf: Filters) => { setF(nf); setPage(1); };
  const pages = data ? Math.ceil(data.total / 25) : 0;

  return (
    <div className="container-x py-8">
      <div className="max-w-3xl"><SearchBar initial={question} /></div>
      {notes.length > 0 && (
        <div className="mt-4 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-navy fade-in">
          <span className="font-medium">Zo is uw vraag geïnterpreteerd:</span> {notes.join(" · ")}.
          <span className="ml-1 text-[var(--ink-3)]">Pas de filters aan als dit niet klopt.</span>
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className={`${showFilters ? "block" : "hidden"} lg:block`}>
          <div className="card card-pad lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <FilterPanel filters={f} onChange={update} options={options} />
          </div>
        </aside>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--ink-2)]">
              <button className="btn-ghost mr-3 lg:hidden" onClick={() => setShowFilters(!showFilters)}>Filters</button>
              {data ? <><strong className="text-navy">{fmtNum(data.total)}</strong> gepubliceerde politierechteruitspraken</> : "Laden…"}
              {loading && <span className="ml-2 text-[var(--ink-3)]">bijwerken…</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sorteren">
                <option value="datum">Nieuwste eerst</option>
                <option value="datum_oud">Oudste eerst</option>
                {f.q && <option value="relevantie">Relevantie</option>}
                <option value="taakstraf">Hoogste taakstraf</option>
                <option value="gevangenisstraf">Hoogste gevangenisstraf</option>
                <option value="boete">Hoogste geldboete</option>
              </select>
              <Link className="btn-ghost" href={`/statistieken?${params}`}>Grafieken voor deze selectie</Link>
              <a className="btn-ghost" href={`/api/export?${params}`}>Excel</a>
              <SaveSearchButton query={f} />
            </div>
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="table-x">
                <thead>
                  <tr><th>Uitspraak</th><th>Strafbaar feit</th><th>Opgelegde straf</th><th>Eis OM</th><th>Omstandigheden</th></tr>
                </thead>
                <tbody>
                  {data?.rows.map((r) => (
                    <tr key={r.ecli} className="cursor-pointer hover:bg-mist" onClick={() => router.push(`/uitspraak/${encodeURIComponent(r.ecli)}`)}>
                      <td className="whitespace-nowrap">
                        <Link href={`/uitspraak/${encodeURIComponent(r.ecli)}`} className="font-mono text-xs text-navy underline-offset-2 hover:underline">{r.ecli}</Link>
                        <div className="text-xs text-[var(--ink-3)]">{r.court_name.replace("Rechtbank ", "Rb. ")}</div>
                        <div className="text-xs text-[var(--ink-3)]">{fmtDate(r.decision_date)}</div>
                      </td>
                      <td className="max-w-[220px]">
                        {r.categories.length ? r.categories.map(offenseLabel).join(", ") : <span className="text-[var(--ink-3)]">Niet geclassificeerd</span>}
                        {r.multi_offense && <div className="mt-1"><span className="badge bg-amber-50 text-amber-800">Meerdere feiten</span></div>}
                        {r.snippet && <div className="mt-1 line-clamp-2 text-xs text-[var(--ink-3)]" dangerouslySetInnerHTML={{ __html: r.snippet.replace(/</g, "&lt;").replace(/&lt;(\/?)mark>/g, "<$1mark>") }} />}
                      </td>
                      <td className="max-w-[260px] font-medium text-navy">{r.outcome === "veroordeling" ? r.sentence_summary : OUTCOME_LABEL[r.outcome]}</td>
                      <td className="max-w-[200px] text-[var(--ink-2)]">{r.eis_summary ?? <span className="text-[var(--ink-3)]">niet vermeld</span>}</td>
                      <td className="max-w-[200px] text-xs text-[var(--ink-2)]">
                        <div>{RECIDIVE_LABEL[r.recidive]}</div>
                        {r.letsel !== "nvt" && r.letsel !== "onbekend" && <div>{LETSEL_LABEL[r.letsel]}</div>}
                        {r.bekentenis !== "onbekend" && <div>{r.bekentenis === "bekend" ? "Bekend" : r.bekentenis === "ontkend" ? "Ontkend" : "Gedeeltelijk bekend"}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-[var(--line)] md:hidden">
              {data?.rows.map((r) => (
                <li key={r.ecli} className="p-4">
                  <Link href={`/uitspraak/${encodeURIComponent(r.ecli)}`}>
                    <div className="font-medium text-navy">{r.categories.map(offenseLabel).join(", ") || "Niet geclassificeerd"}</div>
                    <div className="text-sm font-semibold">{r.outcome === "veroordeling" ? r.sentence_summary : OUTCOME_LABEL[r.outcome]}</div>
                    {r.eis_summary && <div className="text-xs text-[var(--ink-3)]">Eis OM: {r.eis_summary}</div>}
                    <div className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">{r.ecli} · {fmtDate(r.decision_date)}</div>
                  </Link>
                </li>
              ))}
            </ul>
            {data && !data.rows.length && <p className="p-8 text-center text-sm text-[var(--ink-3)]">Geen uitspraken gevonden. Verruim de filters.</p>}
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Vorige</button>
              <span className="text-[var(--ink-2)]">Pagina {page} van {pages}</span>
              <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Volgende</button>
            </div>
          )}
          <p className="mt-6 text-xs text-[var(--ink-3)]">Strafgegevens en omstandigheden zijn automatisch uit de uitspraaktekst geëxtraheerd (regelgebaseerd, met bronpassage). Controleer altijd de oorspronkelijke uitspraak. Niet alle politierechterzaken worden gepubliceerd.</p>
        </section>
      </div>
    </div>
  );
}
