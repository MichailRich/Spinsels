"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Filters } from "@/lib/filters";
import { filtersToParams, describeFilters } from "@/lib/filters";
import type { FilterOptions } from "@/lib/options";
import type { Stats } from "@/lib/stats";
import { FilterPanel, countActive } from "./FilterPanel";
import { SanctionTypesChart, DistributionChart, GroupCompareChart, EisVsStrafChart, CourtsChart, YearsChart, AggravatingHeatmap, MitigatingChart, ScatterChart, SourceLine } from "./charts";
import { RECIDIVE_LABEL, RECIDIVE_ORDER, LETSEL_LABEL, LETSEL_ORDER, RECIDIVE_SHORT, LETSEL_SHORT } from "@/lib/labels";

export function StatsDashboard({ initial, options, fixed = {}, variant = "full" }: { initial: Filters; options: FilterOptions; fixed?: Filters; variant?: "full" | "offense" }) {
  const [f, setF] = useState<Filters>(initial);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const merged = useMemo(() => ({ ...f, ...fixed }), [f, fixed]);
  const params = useMemo(() => filtersToParams(merged).toString(), [merged]);
  const own = useMemo(() => filtersToParams(f).toString(), [f]);

  useEffect(() => {
    router.replace(`${path}${own ? `?${own}` : ""}`, { scroll: false });
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/stats?${params}`, { signal: ctrl.signal }).then((r) => r.json()).then((s) => { setStats(s); setLoading(false); }).catch(() => {});
    return () => ctrl.abort();
  }, [params, own, path, router]);

  const desc = describeFilters(merged, {
    cat: (c) => options.categories.find((x) => x.code === c)?.label ?? c,
    court: (c) => options.courts.find((x) => x.code === c)?.name ?? c,
  });

  return (
    <div>
      {/* filters in één rij boven de grafieken */}
      <div className="card sticky top-16 z-30 flex flex-wrap items-center gap-2 px-4 py-3">
        {variant === "full" && (
          <select className="input !w-auto" value={f.cat?.[0] ?? ""} onChange={(e) => setF({ ...f, cat: e.target.value ? [e.target.value] : undefined })} aria-label="Strafbaar feit">
            <option value="">Alle strafbare feiten</option>
            {[...new Set(options.categories.map((c) => c.groupLabel))].map((g) => (
              <optgroup key={g} label={g}>{options.categories.filter((c) => c.groupLabel === g).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</optgroup>
            ))}
          </select>
        )}
        <select className="input !w-auto" value={f.court?.[0] ?? ""} onChange={(e) => setF({ ...f, court: e.target.value ? [e.target.value] : undefined })} aria-label="Rechtbank">
          <option value="">Alle rechtbanken</option>
          {options.courts.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select className="input !w-auto" value={f.recidive?.join(",") ?? ""} onChange={(e) => setF({ ...f, recidive: e.target.value ? e.target.value.split(",") : undefined })} aria-label="Documentatie">
          <option value="">Alle documentatie</option>
          {RECIDIVE_ORDER.map((r) => <option key={r} value={r}>{RECIDIVE_LABEL[r]}</option>)}
        </select>
        <input className="input !w-24" inputMode="numeric" placeholder="vanaf jaar" value={f.yearFrom ?? ""} onChange={(e) => setF({ ...f, yearFrom: e.target.value ? Number(e.target.value) : undefined })} aria-label="Vanaf jaar" />
        <input className="input !w-24" inputMode="numeric" placeholder="t/m jaar" value={f.yearTo ?? ""} onChange={(e) => setF({ ...f, yearTo: e.target.value ? Number(e.target.value) : undefined })} aria-label="Tot en met jaar" />
        <label className="flex items-center gap-1.5 text-[13px] text-[var(--ink-2)]" title="Alleen zaken waarin uitsluitend het gekozen delict bewezen is verklaard">
          <input type="checkbox" className="accent-[#14263D]" checked={!!f.enkelvoudig} onChange={(e) => setF({ ...f, enkelvoudig: e.target.checked || undefined })} /> uitsluitend dit delict
        </label>
        <button className="btn-ghost ml-auto" onClick={() => setDrawer(true)}>Alle filters{countActive(f) ? ` (${countActive(f)})` : ""}</button>
        {loading && <span className="text-xs text-[var(--ink-3)]">bijwerken…</span>}
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={() => setDrawer(false)}>
          <div className="h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex justify-end"><button className="btn-ghost" onClick={() => setDrawer(false)}>Sluiten</button></div>
            <FilterPanel filters={f} onChange={setF} options={options} hideCategory={variant === "offense"} />
          </div>
        </div>
      )}

      {!stats ? (
        <div className="py-24 text-center text-sm text-[var(--ink-3)]">Statistieken worden berekend…</div>
      ) : (
        <div className={`mt-5 space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <SourceLine stats={stats} desc={desc} />
          {variant === "offense" ? (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <SanctionTypesChart stats={stats} filters={merged} />
                <EisVsStrafChart stats={stats} />
              </div>
              <GroupCompareChart rows={stats.recidive as never} order={RECIDIVE_ORDER} labels={RECIDIVE_LABEL} short={RECIDIVE_SHORT} filterKey="recidive" filters={merged} title="Invloed van justitiële documentatie" subtitle="Strafuitkomst naar wat de uitspraak vermeldt over eerdere veroordelingen. 'Niet vermeld' betekent onbekend — niet: blanco." />
              <div className="grid gap-6 xl:grid-cols-2">
                <MitigatingChart stats={stats} filters={merged} />
                <AggravatingHeatmap stats={stats} filters={merged} />
              </div>
              <DistributionChart stats={stats} filters={merged} />
            </>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <SanctionTypesChart stats={stats} filters={merged} />
                <DistributionChart stats={stats} filters={merged} />
              </div>
              <GroupCompareChart rows={stats.recidive as never} order={RECIDIVE_ORDER} labels={RECIDIVE_LABEL} short={RECIDIVE_SHORT} filterKey="recidive" filters={merged} title="Invloed van recidive" subtitle="Vergelijking op basis van wat de uitspraak uitdrukkelijk vermeldt: blanco strafblad, geen relevante, eerdere of relevante veroordelingen, of niets vermeld." />
              <GroupCompareChart rows={stats.letsel as never} order={LETSEL_ORDER} labels={LETSEL_LABEL} short={LETSEL_SHORT} filterKey="letsel" filters={merged} title="Invloed van letsel" subtitle="Alleen geweldsdelicten. Letselcategorie volgens de uitspraaktekst (bv. fractuur of zwaar lichamelijk letsel = ernstig)." note="'Ernstig letsel' is een feitelijke categorie en valt niet samen met de juridische kwalificatie 'zwaar lichamelijk letsel' (art. 82 Sr)." />
              <EisVsStrafChart stats={stats} />
              <CourtsChart stats={stats} filters={merged} />
              <YearsChart stats={stats} filters={merged} />
              <div className="grid gap-6 xl:grid-cols-2">
                <AggravatingHeatmap stats={stats} filters={merged} />
                <MitigatingChart stats={stats} filters={merged} />
              </div>
              <ScatterChart stats={stats} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
