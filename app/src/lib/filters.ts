// Gedeeld filtermodel voor zoeken, statistiek en export.
// Alle filters worden vertaald naar geparametriseerde SQL (geen string-interpolatie van invoer).

export type Filters = {
  q?: string;
  cat?: string[];
  group?: string;
  art?: string;
  court?: string[];
  yearFrom?: number;
  yearTo?: number;
  dateFrom?: string;
  dateTo?: string;
  kind?: string; // taakstraf | gevangenisstraf_onvw | gevangenisstraf_vw | geldboete | ontzegging
  min?: number;
  max?: number;
  recidive?: string[];
  letsel?: string[];
  bekentenis?: string;
  wapen?: boolean;
  hulpverlener?: boolean;
  huiselijk?: boolean;
  voorwaardelijk?: boolean;
  outcome?: string[];
  verzwarend?: string[];
  verminderend?: string[];
  enkelvoudig?: boolean;
  verified?: boolean;
  ecli?: string[];
};

const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
const num = (v: string | null) => (v != null && v !== "" && isFinite(Number(v)) ? Number(v) : undefined);
const bool = (v: string | null) => (v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : undefined);

export function parseFilters(sp: URLSearchParams | Record<string, string | string[] | undefined>): Filters {
  const get = (k: string): string | null => {
    if (sp instanceof URLSearchParams) return sp.get(k);
    const v = sp[k];
    return Array.isArray(v) ? v.join(",") : v ?? null;
  };
  const f: Filters = {
    q: get("q")?.slice(0, 300) || undefined,
    cat: list(get("cat")),
    group: get("group") || undefined,
    art: get("art") || undefined,
    court: list(get("court")),
    yearFrom: num(get("yearFrom")),
    yearTo: num(get("yearTo")),
    dateFrom: get("dateFrom") || undefined,
    dateTo: get("dateTo") || undefined,
    kind: get("kind") || undefined,
    min: num(get("min")),
    max: num(get("max")),
    recidive: list(get("recidive")),
    letsel: list(get("letsel")),
    bekentenis: get("bekentenis") || undefined,
    wapen: bool(get("wapen")),
    hulpverlener: bool(get("hulpverlener")),
    huiselijk: bool(get("huiselijk")),
    voorwaardelijk: bool(get("voorwaardelijk")),
    outcome: list(get("outcome")),
    verzwarend: list(get("verzwarend")),
    verminderend: list(get("verminderend")),
    enkelvoudig: bool(get("enkelvoudig")),
    verified: bool(get("verified")),
    ecli: list(get("ecli")),
  };
  return f;
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(",") : typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return p;
}

const KIND_COL: Record<string, string> = {
  taakstraf: "p.taakstraf_uren",
  gevangenisstraf_onvw: "p.gev_onvw_dagen",
  gevangenisstraf_vw: "p.gev_vw_dagen",
  geldboete: "p.geldboete_euro",
  ontzegging: "p.ontzegging_maanden",
};

/**
 * Bouwt een WHERE-clausule over: documents d JOIN case_profiles p JOIN courts c.
 * Retourneert de clausule en de parameters (vanaf $offset+1).
 */
export function buildWhere(f: Filters, offset = 0): { where: string; params: unknown[]; tsQuery: string | null } {
  const conds: string[] = ["d.is_politierechter"];
  const params: unknown[] = [];
  const P = (v: unknown) => {
    params.push(v);
    return `$${offset + params.length}`;
  };
  let tsQuery: string | null = null;
  if (f.q) {
    const ecliMatch = f.q.match(/ECLI:NL:[A-Z]{2,6}:\d{4}:[A-Z0-9]+/i);
    if (ecliMatch) conds.push(`d.ecli = ${P(ecliMatch[0].toUpperCase())}`);
    else {
      tsQuery = P(f.q);
      conds.push(`d.search @@ websearch_to_tsquery('dutch', ${tsQuery})`);
    }
  }
  if (f.ecli?.length) conds.push(`d.ecli = ANY(${P(f.ecli)})`);
  if (f.cat?.length) {
    conds.push(f.enkelvoudig ? `p.categories <@ ${P(f.cat)}::text[] AND cardinality(p.categories) >= 1` : `p.categories && ${P(f.cat)}::text[]`);
  } else if (f.enkelvoudig) {
    conds.push("cardinality(p.categories) = 1");
  }
  if (f.group) conds.push(`EXISTS (SELECT 1 FROM offense_categories oc WHERE oc.code = ANY(p.categories) AND oc.group_code = ${P(f.group)})`);
  if (f.art) conds.push(`${P(f.art)} = ANY(p.articles)`);
  if (f.court?.length) conds.push(`c.current_code = ANY(${P(f.court)})`);
  if (f.yearFrom) conds.push(`d.decision_date >= make_date(${P(f.yearFrom)}::int,1,1)`);
  if (f.yearTo) conds.push(`d.decision_date <= make_date(${P(f.yearTo)}::int,12,31)`);
  if (f.dateFrom) conds.push(`d.decision_date >= ${P(f.dateFrom)}::date`);
  if (f.dateTo) conds.push(`d.decision_date <= ${P(f.dateTo)}::date`);
  if (f.kind && KIND_COL[f.kind]) {
    const col = KIND_COL[f.kind];
    conds.push(`${col} > 0`);
    if (f.min != null) conds.push(`${col} >= ${P(f.min)}`);
    if (f.max != null) conds.push(`${col} <= ${P(f.max)}`);
  }
  if (f.recidive?.length) conds.push(`p.recidive = ANY(${P(f.recidive)})`);
  if (f.letsel?.length) conds.push(`p.letsel = ANY(${P(f.letsel)})`);
  if (f.bekentenis) conds.push(`p.bekentenis = ${P(f.bekentenis)}`);
  if (f.wapen !== undefined) conds.push(`p.wapen = ${P(f.wapen)}`);
  if (f.hulpverlener !== undefined) conds.push(`p.hulpverlener = ${P(f.hulpverlener)}`);
  if (f.huiselijk !== undefined) conds.push(`p.huiselijk = ${P(f.huiselijk)}`);
  if (f.voorwaardelijk === true) conds.push(`EXISTS (SELECT 1 FROM sentence_components s WHERE s.ecli=d.ecli AND s.origin='opgelegd' AND s.conditional AND s.kind IN ('gevangenisstraf','hechtenis','taakstraf','geldboete','ontzegging'))`);
  if (f.voorwaardelijk === false) conds.push(`NOT EXISTS (SELECT 1 FROM sentence_components s WHERE s.ecli=d.ecli AND s.origin='opgelegd' AND s.conditional AND s.kind IN ('gevangenisstraf','hechtenis','taakstraf','geldboete','ontzegging'))`);
  if (f.outcome?.length) {
    const o = f.outcome.flatMap((x) => (x === "vrijspraak" ? ["vrijspraak"] : x === "gedeeltelijke_vrijspraak" ? [] : [x]));
    const parts: string[] = [];
    if (o.length) parts.push(`p.outcome = ANY(${P(o)})`);
    if (f.outcome.includes("gedeeltelijke_vrijspraak")) parts.push(`p.acquittal = 'gedeeltelijk'`);
    conds.push(`(${parts.join(" OR ")})`);
  }
  for (const code of [...(f.verzwarend ?? []), ...(f.verminderend ?? [])]) {
    conds.push(`EXISTS (SELECT 1 FROM circumstances ci WHERE ci.ecli=d.ecli AND ci.code=${P(code)} AND ci.status='meegewogen' AND ci.review_status <> 'afgewezen')`);
  }
  if (f.verified) conds.push(`p.review_status IN ('geverifieerd','gecorrigeerd')`);
  return { where: conds.join(" AND "), params, tsQuery };
}

export const FROM = "documents d JOIN case_profiles p ON p.ecli = d.ecli JOIN courts c ON c.code = d.court_code";

export function describeFilters(f: Filters, labels: { cat: (c: string) => string; court: (c: string) => string }): string[] {
  const out: string[] = [];
  if (f.q) out.push(`zoekterm “${f.q}”`);
  if (f.cat?.length) out.push(`delict: ${f.cat.map(labels.cat).join(", ")}${f.enkelvoudig ? " (alleen zaken met uitsluitend dit delict)" : ""}`);
  else if (f.enkelvoudig) out.push("alleen zaken met één delictcategorie");
  if (f.court?.length) out.push(`rechtbank: ${f.court.map(labels.court).join(", ")}`);
  if (f.yearFrom || f.yearTo) out.push(`jaar ${f.yearFrom ?? "…"}–${f.yearTo ?? "…"}`);
  if (f.recidive?.length) out.push(`documentatie: ${f.recidive.join(", ")}`);
  if (f.letsel?.length) out.push(`letsel: ${f.letsel.join(", ")}`);
  if (f.bekentenis) out.push(`proceshouding: ${f.bekentenis}`);
  if (f.wapen) out.push("met wapen");
  if (f.hulpverlener) out.push("tegen hulpverlener/ambtenaar");
  if (f.huiselijk) out.push("huiselijke kring");
  if (f.kind) out.push(`strafsoort: ${f.kind}${f.min != null ? ` ≥ ${f.min}` : ""}${f.max != null ? ` ≤ ${f.max}` : ""}`);
  if (f.outcome?.length) out.push(`uitkomst: ${f.outcome.join(", ")}`);
  if (f.verzwarend?.length) out.push(`verzwarend meegewogen: ${f.verzwarend.join(", ")}`);
  if (f.verminderend?.length) out.push(`verminderend meegewogen: ${f.verminderend.join(", ")}`);
  if (f.voorwaardelijk !== undefined) out.push(f.voorwaardelijk ? "met voorwaardelijk strafdeel" : "zonder voorwaardelijk strafdeel");
  return out;
}
