"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Grafiekbouwstenen voor dashboard en delictpagina's. Alle grafieken krijgen hun data
// rechtstreeks uit /api/stats (live databank) en tonen n, selectie en peildatum.
import type { EChartsOption } from "echarts";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Chart, AXIS } from "./Chart";
import type { Stats } from "@/lib/stats";
import { filtersToParams, type Filters } from "@/lib/filters";
import { RECIDIVE_LABEL, RECIDIVE_ORDER, LETSEL_LABEL, LETSEL_ORDER, RECIDIVE_COLOR, RECIDIVE_SYMBOL, SERIES, fmtNum, fmtDays, pct } from "@/lib/labels";
import { CIRCUMSTANCES } from "@/lib/extract/circumstances";
import nlMap from "@/lib/reference/nl-map.json";
import { offenseLabel } from "@/lib/reference/offenses";

const NAVY = "#2a5a94";
const SEV_ORDER = ["boete", "vw", "taak", "onvw"] as const;
const SEV_LABEL: Record<string, string> = { boete: "Geldboete", vw: "Voorw. gevangenisstraf", taak: "Taakstraf", onvw: "Onvoorw. gevangenisstraf", overig: "Overige sanctie", "9a": "Schuldig zonder straf", geen: "Geen straf" };

export function ChartCard({ title, subtitle, n, note, children, id, causal }: { title: string; subtitle?: string; n?: number; note?: string; children: React.ReactNode; id?: string; causal?: boolean }) {
  return (
    <section id={id} className="card card-pad fade-in">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg text-navy">{title}</h3>
          {subtitle && <p className="mt-0.5 max-w-2xl text-[13px] text-[var(--ink-3)]">{subtitle}</p>}
        </div>
        {n !== undefined && <span className="badge-stat whitespace-nowrap">n = {fmtNum(n)}</span>}
      </div>
      <div className="mt-3">{children}</div>
      {(note || causal) && (
        <p className="mt-3 border-t border-[var(--line)] pt-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
          {causal && <><strong>Geen causaal verband:</strong> verschillen tussen groepen kunnen samenhangen met andere factoren (ernst van het feit, delictsoort, publicatiebeleid). </>}
          {note}
        </p>
      )}
    </section>
  );
}

export function SourceLine({ stats, desc }: { stats: Stats; desc: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-xs text-[var(--ink-2)]">
      <strong className="text-navy">Bron &amp; selectie:</strong> {fmtNum(stats.meta.n)} gepubliceerde politierechteruitspraken
      {stats.meta.first && <> uit de periode {stats.meta.first} t/m {stats.meta.last}</>}
      {desc.length ? <> — {desc.join("; ")}</> : <> — geen filters</>}. Bijgewerkt: {stats.meta.updated}. Bron: Open Data van de Rechtspraak; straffen en omstandigheden automatisch geëxtraheerd.
      {stats.meta.multi > 0 && <> {fmtNum(stats.meta.multi)} zaken betreffen meerdere feiten met één gezamenlijke straf.</>}
    </div>
  );
}

function useGo(filters: Filters) {
  const router = useRouter();
  return (patch: Partial<Filters>) => router.push(`/zoeken?${filtersToParams({ ...filters, ...patch }).toString()}`);
}

// ------------------------------------------------------------------ 1. strafsoorten
export function SanctionTypesChart({ stats, filters }: { stats: Stats; filters: Filters }) {
  const go = useGo(filters);
  const t = stats.types as Stats["types"] & Record<string, number>;
  const conv = t.convicted || 0;
  const items = [
    { key: "geldboete", label: "Geldboete", v: t.geldboete, kind: "geldboete" },
    { key: "taakstraf", label: "Taakstraf (onvoorwaardelijk)", v: t.taakstraf, kind: "taakstraf" },
    { key: "vw", label: "Voorwaardelijke gevangenisstraf", v: t.vw, kind: "gevangenisstraf_vw" },
    { key: "onvw", label: "Onvoorwaardelijke gevangenisstraf", v: t.onvw, kind: "gevangenisstraf_onvw" },
    { key: "overig", label: "Uitsluitend overige sancties", v: t.overig, kind: undefined },
  ];
  const option: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => { const d = p as { name: string; value: number }; return `<b>${d.name}</b><br/>${fmtNum(d.value)} zaken (${pct(d.value, conv)}% van ${fmtNum(conv)} veroordelingen)`; } },
    grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel } },
    yAxis: { type: "category", data: items.map((i) => i.label).reverse(), ...AXIS },
    series: [{ type: "bar", data: items.map((i) => i.v).reverse(), barMaxWidth: 26, itemStyle: { color: NAVY, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: "right", color: "#14263d", fontSize: 11, formatter: (p: any) => { const d = p as { value: number }; return `${fmtNum(d.value)} · ${pct(d.value, conv)}%`; } } }],
  };
  return (
    <ChartCard title="Welke straffen worden opgelegd?" subtitle="Aantal veroordelingen waarin de strafsoort voorkomt (strafcomponenten). Eén zaak kan meerdere componenten bevatten; percentages tellen daarom niet op tot 100%." n={conv}
      note="Klik op een balk om de onderliggende uitspraken te openen.">
      <Chart option={option} height={240} title="Strafsoorten" filename="strafsoorten" onClick={(p) => { const it = items.find((i) => i.label === p.name); if (it?.kind) go({ kind: it.kind, min: undefined, max: undefined }); }}
        table={{ columns: ["Strafsoort", "Aantal zaken", "% van veroordelingen"], rows: items.map((i) => [i.label, i.v, `${pct(i.v, conv)}%`]) }} />
      <div className="mt-4">
        <div className="label mb-2">Volledige strafcombinaties (elke zaak telt één keer)</div>
        <ul className="space-y-1.5 text-[13px]">
          {(stats.types.combos as any[]).slice(0, 8).map((c: { combo: string; n: number }) => (
            <li key={c.combo} className="flex items-center gap-3">
              <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(2, pct(c.n, conv) * 2)}px` }} />
              <span className="flex-1 text-[var(--ink-2)]">{c.combo || "uitsluitend overige sanctie"}</span>
              <span className="tabular-nums text-navy">{fmtNum(c.n)} <span className="text-[var(--ink-3)]">({pct(c.n, conv)}%)</span></span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 2. strafhoogte
const DIST_META = {
  taakstraf: { label: "Taakstraf", unit: "uur", kind: "taakstraf", fmt: (v: number) => `${fmtNum(v)} uur` },
  gevangenis: { label: "Onvoorwaardelijke gevangenisstraf", unit: "dagen", kind: "gevangenisstraf_onvw", fmt: (v: number) => fmtDays(v) },
  voorwaardelijk: { label: "Voorwaardelijke gevangenisstraf", unit: "dagen", kind: "gevangenisstraf_vw", fmt: (v: number) => fmtDays(v) },
  geldboete: { label: "Geldboete", unit: "euro", kind: "geldboete", fmt: (v: number) => `€ ${fmtNum(v)}` },
  ontzegging: { label: "Ontzegging rijbevoegdheid", unit: "maanden", kind: "ontzegging", fmt: (v: number) => `${fmtNum(v, 1)} mnd` },
} as const;
type DistKey = keyof typeof DIST_META;

function niceBins(values: number[], target = 14) {
  if (!values.length) return [] as { lo: number; hi: number; n: number }[];
  const max = values[values.length - 1];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const bins: { lo: number; hi: number; n: number }[] = [];
  for (let lo = 0; lo <= max; lo += step) bins.push({ lo, hi: lo + step, n: 0 });
  for (const v of values) bins[Math.min(bins.length - 1, Math.floor(v / step))].n++;
  return bins;
}

export function DistributionChart({ stats, filters, initial }: { stats: Stats; filters: Filters; initial?: DistKey }) {
  const first = (Object.keys(DIST_META) as DistKey[]).find((key) => stats.distributions[key].summary.n > 0) ?? "taakstraf";
  const [k, setK] = useState<DistKey>(initial ?? first);
  const go = useGo(filters);
  const d = stats.distributions[k];
  const m = DIST_META[k];
  const vals = d.values.map((x) => x.v);
  const bins = useMemo(() => niceBins(vals), [vals]);
  const s = d.summary;
  const hist: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => { const x = p as { dataIndex: number; value: number }; const b = bins[x.dataIndex]; return `${m.fmt(b.lo)} – < ${m.fmt(b.hi)}<br/><b>${x.value}</b> uitspraken`; } },
    xAxis: { type: "category", data: bins.map((b) => fmtNum(b.lo)), name: m.unit, nameLocation: "middle", nameGap: 26, ...AXIS },
    yAxis: { type: "value", name: "aantal", ...AXIS, minInterval: 1 },
    grid: { left: 8, right: 16, top: 24, bottom: 24, containLabel: true },
    dataZoom: [{ type: "inside" }],
    series: [{ type: "bar", data: bins.map((b) => b.n), barCategoryGap: "8%", itemStyle: { color: NAVY, borderRadius: [4, 4, 0, 0] } },
      ...(s.median != null ? [{ type: "line" as const, data: [], markLine: { symbol: "none", silent: true, label: { formatter: `mediaan ${m.fmt(s.median)}`, color: "#86693A", fontSize: 11 }, lineStyle: { color: "#C3A46B", width: 2, type: "dashed" as const }, data: [{ xAxis: Math.min(bins.length - 1, Math.max(0, bins.findIndex((b) => s.median! >= b.lo && s.median! < b.hi))) }] } }] : [])],
  };
  const box: EChartsOption = {
    tooltip: { trigger: "item" },
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", ...AXIS },
    yAxis: { type: "category", data: [m.label], show: false },
    series: [{ type: "boxplot", data: s.n ? [[s.min!, s.p25!, s.median!, s.p75!, s.max!]] : [], itemStyle: { color: "#EEF2F7", borderColor: NAVY, borderWidth: 2 }, boxWidth: [18, 28],
      tooltip: { formatter: () => `min ${m.fmt(s.min!)}<br/>25% ${m.fmt(s.p25!)}<br/><b>mediaan ${m.fmt(s.median!)}</b><br/>75% ${m.fmt(s.p75!)}<br/>max ${m.fmt(s.max!)}` } }],
  };
  return (
    <ChartCard title="Hoe hoog zijn de straffen?" subtitle="Verdeling van de opgelegde strafhoogte, per strafsoort. Alleen zaken waarin de strafsoort is opgelegd." n={s.n}
      note="Gevangenisstraf is genormaliseerd naar dagen (week = 7, maand = 30, jaar = 365 dagen). Bij gezamenlijke straffen voor meerdere feiten is de totale straf weergegeven. Klik op een staaf voor de uitspraken in die klasse.">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(DIST_META) as DistKey[]).map((key) => (
          <button key={key} className={k === key ? "chip-on" : "chip"} onClick={() => setK(key)}>{DIST_META[key].label} ({stats.distributions[key].summary.n})</button>
        ))}
      </div>
      {s.n ? (
        <>
          <dl className="mb-3 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
            {[["Minimum", s.min], ["10e perc.", s.p10], ["Mediaan", s.median], ["90e perc.", s.p90], ["Maximum", s.max], ["Gemiddelde", s.mean]].map(([l, v]) => (
              <div key={l as string} className={`rounded-lg p-2 ${l === "Mediaan" ? "bg-gold-50" : "bg-mist"}`}>
                <dt className="text-[10.5px] uppercase tracking-wider text-[var(--ink-3)]">{l}</dt>
                <dd className="font-serif text-lg text-navy tabular-nums">{v == null ? "–" : m.fmt(Math.round((v as number) * 10) / 10)}</dd>
              </div>
            ))}
          </dl>
          <Chart option={hist} height={260} title={`Verdeling ${m.label}`} filename={`verdeling-${k}`} onClick={(p) => { const b = bins[p.dataIndex!]; if (b) go({ kind: m.kind, min: b.lo, max: b.hi - (k === "geldboete" ? 0.01 : 0.001) }); }}
            table={{ columns: [`Klasse (${m.unit})`, "Aantal"], rows: bins.map((b) => [`${fmtNum(b.lo)} – < ${fmtNum(b.hi)}`, b.n]) }} />
          <Chart option={box} height={90} title={`Boxplot ${m.label}`} filename={`boxplot-${k}`} />
        </>
      ) : <Empty />}
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 3/4. groepsvergelijking
type GroupRow = { key: string; n: number; convicted: number; onvw: number; taak: number; boete: number; vw: number; med_taak: number | null; med_onvw: number | null; med_boete: number | null };
export function GroupCompareChart({ rows, order, labels, short, title, subtitle, filterKey, filters, note }: {
  rows: GroupRow[]; order: string[]; labels: Record<string, string>; short?: Record<string, string>; title: string; subtitle: string; filterKey: "recidive" | "letsel"; filters: Filters; note?: string;
}) {
  const go = useGo(filters);
  const data = order.map((k) => rows.find((r) => r.key === k) ?? { key: k, n: 0, convicted: 0, onvw: 0, taak: 0, boete: 0, vw: 0, med_taak: null, med_onvw: null, med_boete: null });
  const cats = data.map((d) => `${(short ?? labels)[d.key]}\n(n=${d.n})`);
  const mix: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => `${v}%` },
    legend: { top: 0, textStyle: { fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: cats, ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: 0, fontSize: 10 } },
    yAxis: { type: "value", max: 100, name: "% van zaken", ...AXIS },
    series: [
      { name: "Onvoorw. gevangenisstraf", key: "onvw" },
      { name: "Taakstraf", key: "taak" },
      { name: "Voorw. gevangenisstraf", key: "vw" },
      { name: "Geldboete", key: "boete" },
    ].map((s, i) => ({ type: "bar" as const, name: s.name, barGap: "10%", itemStyle: { color: SERIES[i], borderRadius: [3, 3, 0, 0] }, data: data.map((d) => pct(d[s.key as "onvw"], d.n)) })),
  };
  const med: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => (v == null ? "–" : `${v} uur`) },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: cats, ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: 0, fontSize: 10 } },
    yAxis: { type: "value", name: "mediane taakstraf (uur)", ...AXIS },
    series: [{ type: "bar", data: data.map((d) => d.med_taak), barMaxWidth: 34, itemStyle: { color: NAVY, borderRadius: [4, 4, 0, 0] }, label: { show: true, position: "top", fontSize: 11, color: "#14263d", formatter: (p: any) => ((p as { value: number | null }).value == null ? "" : `${(p as { value: number }).value} u`) } }],
  };
  const click = (p: { dataIndex?: number }) => { const d = data[p.dataIndex ?? -1]; if (d) go({ [filterKey]: [d.key] } as Partial<Filters>); };
  return (
    <ChartCard title={title} subtitle={subtitle} n={data.reduce((a, d) => a + d.n, 0)} causal note={note}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Chart option={mix} height={300} title={`${title} — strafsoort`} filename={`${filterKey}-strafsoort`} onClick={click}
          table={{ columns: ["Groep", "n", "% onvw. gev.", "% taakstraf", "% vw. gev.", "% geldboete"], rows: data.map((d) => [labels[d.key], d.n, pct(d.onvw, d.n), pct(d.taak, d.n), pct(d.vw, d.n), pct(d.boete, d.n)]) }} />
        <Chart option={med} height={300} title={`${title} — mediane taakstraf`} filename={`${filterKey}-taakstraf`} onClick={click}
          table={{ columns: ["Groep", "Mediane taakstraf (uur)", "Mediane onvw. gev. (dagen)", "Mediane boete (€)"], rows: data.map((d) => [labels[d.key], d.med_taak, d.med_onvw, d.med_boete]) }} />
      </div>
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 5. eis OM vs straf
const EIS_META = {
  taakstraf: { label: "Taakstraf (uur)", fmt: (v: number) => `${fmtNum(v)} uur` },
  gevangenis: { label: "Onvoorw. gevangenisstraf (dagen)", fmt: (v: number) => fmtDays(v) },
  voorwaardelijk: { label: "Voorw. gevangenisstraf (dagen)", fmt: (v: number) => fmtDays(v) },
  geldboete: { label: "Geldboete (€)", fmt: (v: number) => `€ ${fmtNum(v)}` },
  ontzegging: { label: "Ontzegging (maanden)", fmt: (v: number) => `${fmtNum(v, 1)} mnd` },
} as const;
type EisKey = keyof typeof EIS_META;
export function EisVsStrafChart({ stats }: { stats: Stats }) {
  const [k, setK] = useState<EisKey>("taakstraf");
  const router = useRouter();
  const e = stats.eis[k];
  const m = EIS_META[k];
  const both = e.pairs.filter((p) => p.straf > 0);
  const max = Math.max(1, ...both.map((p) => Math.max(p.eis, p.straf)));
  const scatter: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => { const d = (p as { data: [number, number, string] }).data; return `<b>${d[2]}</b><br/>Eis OM: ${m.fmt(d[0])}<br/>Opgelegd: ${m.fmt(d[1])}<br/><i>klik om te openen</i>`; } },
    grid: { left: 8, right: 24, top: 24, bottom: 28, containLabel: true },
    xAxis: { type: "value", name: "Eis OM", nameLocation: "middle", nameGap: 26, max, ...AXIS },
    yAxis: { type: "value", name: "Opgelegd", max, ...AXIS },
    dataZoom: [{ type: "inside", xAxisIndex: 0 }, { type: "inside", yAxisIndex: 0 }],
    series: [{
      type: "scatter", symbolSize: 9, data: both.map((p) => [p.eis, p.straf, p.ecli]),
      itemStyle: { color: (p: any) => { const d = (p as { data: [number, number] }).data; return d[1] < d[0] ? SERIES[0] : d[1] > d[0] ? SERIES[4] : SERIES[1]; }, borderColor: "#fff", borderWidth: 1.5, opacity: 0.85 },
      markLine: { silent: true, symbol: "none", lineStyle: { color: "#9aa5b4", type: "dashed" }, label: { formatter: "straf = eis", fontSize: 10 }, data: [[{ coord: [0, 0] }, { coord: [max, max] }]] },
    }],
  };
  const bar: EChartsOption = {
    tooltip: { trigger: "item" },
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", ...AXIS },
    yAxis: { type: "category", data: ["Hoger dan eis", "Gelijk aan eis", "Lager dan eis", "Component niet opgelegd"], ...AXIS },
    series: [{ type: "bar", barMaxWidth: 22, data: [
      { value: e.higher, itemStyle: { color: SERIES[4] } }, { value: e.equal, itemStyle: { color: SERIES[1] } },
      { value: e.lower, itemStyle: { color: SERIES[0] } }, { value: e.notImposed, itemStyle: { color: "#9aa5b4" } },
    ], label: { show: true, position: "right", fontSize: 11, color: "#14263d" }, itemStyle: { borderRadius: [0, 4, 4, 0] } }],
  };
  return (
    <ChartCard title="Eis OM tegenover straf politierechter" subtitle="Per strafcomponent: de eis van de officier van justitie afgezet tegen de opgelegde straf. Alleen technisch vergelijkbare componenten worden vergeleken (uren met uren, onvoorwaardelijke met onvoorwaardelijke gevangenisstraf)." n={e.pairs.length}
      note={`Uitspraken met een vermelde eis OM in deze selectie: ${fmtNum(stats.eis.withEis)}. "Component niet opgelegd": de eis bevatte deze component, de politierechter legde die niet op (bv. taakstraf i.p.v. gevangenisstraf). Blauw = lager, goud = gelijk, rood = hoger dan de eis. Klik op een stip om de uitspraak te openen.`}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(EIS_META) as EisKey[]).map((key) => (
          <button key={key} className={k === key ? "chip-on" : "chip"} onClick={() => setK(key)}>{EIS_META[key].label} ({stats.eis[key].pairs.length})</button>
        ))}
      </div>
      {e.pairs.length ? (
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3"><Chart option={scatter} height={320} title={`Eis OM vs straf — ${m.label}`} filename={`eis-vs-straf-${k}`} onClick={(p) => { const d = p.data as [number, number, string]; if (d?.[2]) router.push(`/uitspraak/${encodeURIComponent(d[2])}`); }}
            table={{ columns: ["ECLI", "Eis OM", "Opgelegd"], rows: e.pairs.map((p) => [p.ecli, m.fmt(p.eis), p.straf ? m.fmt(p.straf) : "niet opgelegd"]) }} /></div>
          <div className="xl:col-span-2">
            <Chart option={bar} height={200} title="Uitkomst t.o.v. eis" filename={`eis-uitkomst-${k}`} />
            <div className="mt-2 rounded-lg bg-mist p-3 text-[13px] text-[var(--ink-2)]">
              {e.compared > 0 ? <>In <b>{pct(e.lower, e.compared)}%</b> van de {e.compared} vergelijkbare zaken bleef de straf onder de eis; mediane verhouding straf/eis: <b>{e.medianRatio != null ? `${Math.round(e.medianRatio * 100)}%` : "–"}</b>.</> : "Te weinig vergelijkbare paren."}
            </div>
          </div>
        </div>
      ) : <Empty />}
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 6. rechtbanken + kaart
type CourtRow = { code: string; n: number; onvw: number; taak: number; boete: number; vw: number; vrijspraak: number; med_taak: number | null; med_onvw: number | null };
const COURT_NAMES: Record<string, string> = { RBAMS: "Amsterdam", RBDHA: "Den Haag", RBROT: "Rotterdam", RBMNE: "Midden-Nederland", RBNHO: "Noord-Holland", RBNNE: "Noord-Nederland", RBOBR: "Oost-Brabant", RBZWB: "Zeeland-West-Brabant", RBLIM: "Limburg", RBGEL: "Gelderland", RBOVE: "Overijssel" };
export function CourtsChart({ stats, filters }: { stats: Stats; filters: Filters }) {
  const courts = stats.courts as CourtRow[];
  const [sel, setSel] = useState<string | null>(courts[0]?.code ?? null);
  const go = useGo(filters);
  const maxN = Math.max(1, ...courts.map((c) => c.n));
  const c = courts.find((x) => x.code === sel);
  const cats = (stats.courtCats as { code: string; cat: string; n: number }[]).filter((x) => x.code === sel).slice(0, 6);
  const yrs = (stats.courtYears as { code: string; year: number; n: number }[]).filter((x) => x.code === sel);
  const pts = nlMap.points as Record<string, number[]>;
  const yearsOpt: EChartsOption = {
    tooltip: { trigger: "axis" }, grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: yrs.map((y) => String(y.year)), ...AXIS }, yAxis: { type: "value", minInterval: 1, ...AXIS },
    series: [{ type: "bar", data: yrs.map((y) => y.n), itemStyle: { color: NAVY, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 16 }],
  };
  return (
    <ChartCard title="Verschillen tussen rechtbanken" subtitle="Selecteer een rechtbank op de kaart. Cirkeloppervlak = aantal gepubliceerde politierechteruitspraken in de selectie (historische rechtbanken zijn samengevoegd met hun opvolger)." n={stats.meta.n}
      note="Let op: verschillen tussen rechtbanken weerspiegelen ook verschillen in publicatiebeleid, zaakzwaarte en samenstelling van de zaken. Ze zijn niet zonder meer toe te schrijven aan een strengere of mildere strafpraktijk.">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <svg viewBox={`0 0 ${nlMap.width} ${nlMap.height}`} className="w-full" role="img" aria-label="Kaart van Nederland met rechtbanken">
          <path d={nlMap.path} fill="#EEF2F7" stroke="#AFC0D6" strokeWidth={1} />
          {courts.map((ct) => {
            const p = pts[ct.code];
            if (!p) return null;
            const r = 6 + 22 * Math.sqrt(ct.n / maxN);
            const on = ct.code === sel;
            return (
              <g key={ct.code} onClick={() => setSel(ct.code)} className="cursor-pointer" role="button" aria-label={`${COURT_NAMES[ct.code]}: ${ct.n} uitspraken`}>
                <circle cx={p[0]} cy={p[1]} r={r} fill={on ? "#C3A46B" : "#2a5a94"} fillOpacity={on ? 0.9 : 0.55} stroke="#fff" strokeWidth={2} />
                <text x={p[0]} y={p[1] + 4} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={on ? "#14263D" : "#fff"} pointerEvents="none">{ct.n}</text>
                <title>{`Rechtbank ${COURT_NAMES[ct.code]} — ${ct.n} uitspraken`}</title>
              </g>
            );
          })}
        </svg>
        <div>
          <div className="flex flex-wrap gap-1.5">
            {courts.map((ct) => <button key={ct.code} className={ct.code === sel ? "chip-on" : "chip"} onClick={() => setSel(ct.code)}>{COURT_NAMES[ct.code]} ({ct.n})</button>)}
          </div>
          {c && (
            <div className="mt-4 fade-in">
              <div className="flex items-baseline justify-between">
                <h4 className="font-serif text-xl text-navy">Rechtbank {COURT_NAMES[c.code]}</h4>
                <button className="text-sm text-gold-600 hover:underline" onClick={() => go({ court: [c.code] })}>Bekijk {c.n} uitspraken →</button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Taakstraf", pct(c.taak, c.n) + "%"], ["Onvoorw. gev.", pct(c.onvw, c.n) + "%"], ["Mediane taakstraf", c.med_taak ? `${c.med_taak} uur` : "–"], ["Vrijspraak", pct(c.vrijspraak, c.n) + "%"]].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-mist p-2.5"><dt className="text-[10.5px] uppercase tracking-wider text-[var(--ink-3)]">{l}</dt><dd className="font-serif text-lg text-navy">{v}</dd></div>
                ))}
              </dl>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="label mb-2">Meest voorkomende delicten</div>
                  <ul className="space-y-1 text-[13px]">{cats.map((x) => <li key={x.cat} className="flex justify-between"><span>{offenseLabel(x.cat)}</span><span className="tabular-nums text-[var(--ink-3)]">{x.n}</span></li>)}</ul>
                </div>
                <div>
                  <div className="label mb-1">Uitspraken per jaar</div>
                  <Chart option={yearsOpt} height={150} title={`Rechtbank ${COURT_NAMES[c.code]} per jaar`} filename={`rechtbank-${c.code}`} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>Rechtbank</th><th>n</th><th>% taakstraf</th><th>% onvw. gev.</th><th>% geldboete</th><th>Mediane taakstraf</th><th>Mediane onvw. gev.</th></tr></thead>
          <tbody>{courts.map((ct) => <tr key={ct.code} className="cursor-pointer hover:bg-mist" onClick={() => setSel(ct.code)}><td>{COURT_NAMES[ct.code]}</td><td className="tabular-nums">{ct.n}</td><td>{pct(ct.taak, ct.n)}%</td><td>{pct(ct.onvw, ct.n)}%</td><td>{pct(ct.boete, ct.n)}%</td><td>{ct.med_taak ? `${ct.med_taak} uur` : "–"}</td><td>{fmtDays(ct.med_onvw)}</td></tr>)}</tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 7. jaren
type YearRow = { year: number; n: number; convicted: number; onvw: number; taak: number; boete: number; med_taak: number | null; med_onvw: number | null; med_boete: number | null };
export function YearsChart({ stats, filters }: { stats: Stats; filters: Filters }) {
  const go = useGo(filters);
  const ys = stats.years as YearRow[];
  const [metric, setMetric] = useState<"n" | "med_taak" | "med_onvw" | "med_boete" | "pct">("med_taak");
  const labels = { n: "Aantal gepubliceerde uitspraken", med_taak: "Mediane taakstraf (uur)", med_onvw: "Mediane onvoorw. gevangenisstraf (dagen)", med_boete: "Mediane geldboete (€)", pct: "% zaken met strafsoort" };
  const opt: EChartsOption = metric === "pct" ? {
    tooltip: { trigger: "axis", valueFormatter: (v) => `${v}%` },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: ys.map((y) => String(y.year)), ...AXIS }, yAxis: { type: "value", max: 100, ...AXIS },
    dataZoom: [{ type: "inside" }],
    series: [["Onvoorw. gevangenisstraf", "onvw"], ["Taakstraf", "taak"], ["Geldboete", "boete"]].map(([name, key], i) => ({ type: "line" as const, name, smooth: false, symbolSize: 7, lineStyle: { width: 2 }, itemStyle: { color: SERIES[i] }, data: ys.map((y) => pct(y[key as "onvw"], y.n)) })),
  } : {
    tooltip: { trigger: "axis", formatter: (p: any) => { const a = (p as { dataIndex: number; value: number }[])[0]; const y = ys[a.dataIndex]; return `<b>${y.year}</b><br/>${labels[metric]}: ${a.value ?? "–"}<br/>n = ${y.n}`; } },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: ys.map((y) => String(y.year)), ...AXIS }, yAxis: { type: "value", name: labels[metric], ...AXIS },
    dataZoom: [{ type: "inside" }],
    series: [metric === "n"
      ? { type: "bar", data: ys.map((y) => y.n), itemStyle: { color: NAVY, borderRadius: [3, 3, 0, 0] } }
      : { type: "line", data: ys.map((y) => y[metric]), symbolSize: 8, lineStyle: { width: 2, color: NAVY }, itemStyle: { color: NAVY }, connectNulls: true }],
  };
  return (
    <ChartCard title="Ontwikkeling van straffen door de jaren heen" subtitle="Kies een maatstaf. Klik op een jaar om de uitspraken van dat jaar te openen." n={stats.meta.n}
      note="Jaren met weinig gepubliceerde uitspraken (zie n in de tooltip) geven een onzekere mediaan. Publicatiebeleid verschilt per jaar.">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => <button key={k} className={metric === k ? "chip-on" : "chip"} onClick={() => setMetric(k)}>{labels[k]}</button>)}
      </div>
      {ys.length ? <Chart option={opt} height={280} title={labels[metric]} filename={`jaren-${metric}`} onClick={(p) => { const y = ys[p.dataIndex ?? -1]; if (y) go({ yearFrom: y.year, yearTo: y.year }); }}
        table={{ columns: ["Jaar", "n", "% taakstraf", "% onvw. gev.", "Mediane taakstraf", "Mediane onvw. gev. (dagen)", "Mediane boete"], rows: ys.map((y) => [y.year, y.n, pct(y.taak, y.n), pct(y.onvw, y.n), y.med_taak, y.med_onvw, y.med_boete]) }} /> : <Empty />}
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 8. heatmap verzwarend
export function AggravatingHeatmap({ stats, filters }: { stats: Stats; filters: Filters }) {
  const go = useGo(filters);
  const heat = stats.heat as { code: string; sev: string; n: number }[];
  const codes = Object.entries(CIRCUMSTANCES).filter(([, v]) => v.polarity === "verzwarend").map(([k]) => k).filter((k) => heat.some((h) => h.code === k));
  const cols = [...SEV_ORDER];
  const data: [number, number, number, number][] = [];
  codes.forEach((code, y) => {
    const rowTotal = heat.filter((h) => h.code === code && cols.includes(h.sev as never)).reduce((a, h) => a + h.n, 0);
    cols.forEach((sev, x) => { const n = heat.find((h) => h.code === code && h.sev === sev)?.n ?? 0; data.push([x, y, rowTotal ? Math.round((n / rowTotal) * 100) : 0, n]); });
  });
  const opt: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => { const d = (p as { data: [number, number, number, number] }).data; return `<b>${CIRCUMSTANCES[codes[d[1]] as keyof typeof CIRCUMSTANCES].label}</b><br/>Zwaarste component: ${SEV_LABEL[cols[d[0]]]}<br/>${d[3]} zaken (${d[2]}% van de rij)`; } },
    grid: { left: 8, right: 8, top: 8, bottom: 60, containLabel: true },
    xAxis: { type: "category", data: cols.map((c) => SEV_LABEL[c]), ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: 0, fontSize: 10, rotate: 20 } },
    yAxis: { type: "category", data: codes.map((c) => CIRCUMSTANCES[c as keyof typeof CIRCUMSTANCES].label), ...AXIS, axisLabel: { ...AXIS.axisLabel, width: 170, overflow: "truncate" } },
    visualMap: { min: 0, max: 100, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: 140, text: ["100% van rij", "0%"], textStyle: { fontSize: 10 }, inRange: { color: ["#f4f7fb", "#9ec5f4", "#3987e5", "#1c5cab", "#0d366b"] } },
    series: [{ type: "heatmap", data, label: { show: true, fontSize: 10, formatter: (p: any) => { const d = (p as { data: number[] }).data; return d[3] ? String(d[3]) : ""; } }, itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 3 } }],
  };
  return (
    <ChartCard title="Strafverzwarende omstandigheden" subtitle="Hoe vaak een uitdrukkelijk door de politierechter meegewogen verzwarende omstandigheid voorkomt, naar de zwaarste opgelegde strafcomponent. Kleur = aandeel binnen de rij; getal = aantal zaken." causal
      note="Alleen omstandigheden die in de strafmotivering van de politierechter staan, tellen mee. Klik op een cel om de uitspraken te openen.">
      {codes.length ? <Chart option={opt} height={Math.max(240, codes.length * 34 + 90)} title="Heatmap strafverzwarende omstandigheden" filename="heatmap-verzwarend"
        onClick={(p) => { const d = p.data as number[]; const code = codes[d?.[1]]; const sev = cols[d?.[0]]; if (code) go({ verzwarend: [code], kind: sev === "onvw" ? "gevangenisstraf_onvw" : sev === "taak" ? "taakstraf" : sev === "vw" ? "gevangenisstraf_vw" : "geldboete", min: undefined, max: undefined }); }}
        table={{ columns: ["Omstandigheid", ...cols.map((c) => SEV_LABEL[c])], rows: codes.map((code, y) => [CIRCUMSTANCES[code as keyof typeof CIRCUMSTANCES].label, ...cols.map((_, x) => data.find((d) => d[0] === x && d[1] === y)?.[3] ?? 0)]) }} /> : <Empty />}
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 9. verminderend
export function MitigatingChart({ stats, filters }: { stats: Stats; filters: Filters }) {
  const go = useGo(filters);
  const rows = (stats.circ as { code: string; polarity: string; n: number; onvw: number; taak: number; med_taak: number | null }[]).filter((r) => r.polarity === "verminderend");
  const o = stats.overall as { n: number; onvw: number; taak: number; med_taak: number | null };
  const opt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => `${v}%` },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true },
    xAxis: { type: "value", max: 100, name: "% zaken", ...AXIS },
    yAxis: { type: "category", data: rows.map((r) => `${CIRCUMSTANCES[r.code as keyof typeof CIRCUMSTANCES].label} (n=${r.n})`).reverse(), ...AXIS, axisLabel: { ...AXIS.axisLabel, width: 200, overflow: "truncate" } },
    series: [
      { type: "bar", name: "Onvoorw. gevangenisstraf", data: rows.map((r) => pct(r.onvw, r.n)).reverse(), itemStyle: { color: SERIES[0], borderRadius: [0, 3, 3, 0] }, barGap: "10%",
        markLine: { symbol: "none", silent: true, label: { formatter: `alle zaken ${pct(o.onvw, o.n)}%`, fontSize: 10 }, lineStyle: { color: SERIES[0], type: "dashed" }, data: [{ xAxis: pct(o.onvw, o.n) }] } },
      { type: "bar", name: "Taakstraf", data: rows.map((r) => pct(r.taak, r.n)).reverse(), itemStyle: { color: SERIES[1], borderRadius: [0, 3, 3, 0] },
        markLine: { symbol: "none", silent: true, label: { formatter: `alle zaken ${pct(o.taak, o.n)}%`, fontSize: 10, position: "insideEndTop" }, lineStyle: { color: SERIES[1], type: "dashed" }, data: [{ xAxis: pct(o.taak, o.n) }] } },
    ],
  };
  return (
    <ChartCard title="Strafverminderende omstandigheden" subtitle="Aandeel zaken met onvoorwaardelijke gevangenisstraf en taakstraf wanneer de politierechter een verminderende omstandigheid uitdrukkelijk meewoog, vergeleken met alle zaken in de selectie (stippellijn)." causal
      note="Een statistische samenhang is geen bewijs dat de omstandigheid de straf heeft veroorzaakt: zo komen bekentenissen vaker voor bij eenvoudiger zaken. Klik op een balk voor de uitspraken.">
      {rows.length ? <Chart option={opt} height={Math.max(240, rows.length * 44 + 60)} title="Strafverminderende omstandigheden" filename="verminderend"
        onClick={(p) => { const r = [...rows].reverse()[p.dataIndex ?? -1]; if (r) go({ verminderend: [r.code] }); }}
        table={{ columns: ["Omstandigheid", "n", "% onvw. gev.", "% taakstraf", "Mediane taakstraf"], rows: rows.map((r) => [CIRCUMSTANCES[r.code as keyof typeof CIRCUMSTANCES].label, r.n, pct(r.onvw, r.n), pct(r.taak, r.n), r.med_taak]) }} /> : <Empty />}
    </ChartCard>
  );
}

// ------------------------------------------------------------------ 10. spreiding
export function ScatterChart({ stats }: { stats: Stats }) {
  const router = useRouter();
  const [metric, setMetric] = useState<"taak" | "onvw" | "vw" | "boete">("taak");
  const labels = { taak: "Taakstraf (uur)", onvw: "Onvoorw. gevangenisstraf (dagen)", vw: "Voorw. gevangenisstraf (dagen)", boete: "Geldboete (€)" };
  type Pt = { ecli: string; date: string; taak: number | null; onvw: number | null; vw: number | null; boete: number | null; recidive: string; cat: string | null };
  const pts = (stats.scatter as Pt[]).filter((p) => (p[metric] ?? 0) > 0);
  const opt: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => { const d = (p as { data: [string, number, string, string, string] }).data; return `<b>${d[2]}</b><br/>${d[0]} · ${offenseLabel(d[4])}<br/>${labels[metric]}: ${fmtNum(d[1])}<br/>${RECIDIVE_LABEL[d[3]]}<br/><i>klik om te openen</i>`; } },
    legend: { top: 0, textStyle: { fontSize: 11 }, itemWidth: 10 },
    grid: { left: 8, right: 16, top: 40, bottom: 36, containLabel: true },
    xAxis: { type: "time", ...AXIS }, yAxis: { type: "value", name: labels[metric], ...AXIS },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 4, borderColor: "transparent" }],
    series: RECIDIVE_ORDER.map((r) => ({
      type: "scatter" as const, name: RECIDIVE_LABEL[r], symbol: RECIDIVE_SYMBOL[r], symbolSize: 9,
      itemStyle: { color: RECIDIVE_COLOR[r], borderColor: "#fff", borderWidth: 1, opacity: 0.85 },
      data: pts.filter((p) => p.recidive === r).map((p) => [p.date, p[metric], p.ecli, p.recidive, p.cat]),
    })),
  };
  return (
    <ChartCard title="Vergelijkbaarheid van uitspraken" subtitle="Iedere stip is één uitspraak: uitspraakdatum tegenover strafhoogte. Kleur én vorm = vermelde justitiële documentatie. Stipgrootte heeft geen betekenis." n={pts.length}
      note="Klik op een stip om de oorspronkelijke uitspraak te openen. Zoom met scrollen of de schuifbalk.">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => <button key={k} className={metric === k ? "chip-on" : "chip"} onClick={() => setMetric(k)}>{labels[k]}</button>)}
      </div>
      {pts.length ? <Chart option={opt} height={360} title="Spreiding per uitspraak" filename={`spreiding-${metric}`} onClick={(p) => { const d = p.data as string[]; if (d?.[2]) router.push(`/uitspraak/${encodeURIComponent(d[2])}`); }}
        table={{ columns: ["ECLI", "Datum", labels[metric], "Documentatie"], rows: pts.map((p) => [p.ecli, p.date, p[metric], RECIDIVE_LABEL[p.recidive]]) }} /> : <Empty />}
    </ChartCard>
  );
}

function Empty() {
  return <p className="py-10 text-center text-sm text-[var(--ink-3)]">Onvoldoende gegevens in deze selectie. Verruim de filters.</p>;
}

export { RECIDIVE_LABEL, RECIDIVE_ORDER, LETSEL_LABEL, LETSEL_ORDER };
