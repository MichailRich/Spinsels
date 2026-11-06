// Transparante vergelijkbaarheidsscore. Iedere component is zichtbaar voor de gebruiker;
// alleen kenmerken die in BEIDE zaken bekend zijn tellen mee (geen schijnzekerheid).

import { q } from "../db";
import { OFFENSE_BY_CODE } from "../reference/offenses";

export type CaseFeatures = {
  categories: string[];
  primary?: string | null;
  recidive?: string;
  letsel?: string;
  bekentenis?: string;
  wapen?: boolean | null;
  hulpverlener?: boolean | null;
  huiselijk?: boolean | null;
  multi?: boolean | null;
  text?: string | null;
  year?: number | null;
};

export type ScorePart = { label: string; got: number; max: number; detail: string };
export type Similar = {
  ecli: string; court_name: string; decision_date: string | null; categories: string[]; recidive: string; letsel: string; bekentenis: string;
  sentence_summary: string | null; eis_summary: string | null; outcome: string; score: number; parts: ScorePart[]; known: number;
  taakstraf_uren: number | null; gev_onvw_dagen: number | null; gev_vw_dagen: number | null; geldboete_euro: number | null; multi_offense: boolean;
};

const W = { delict: 40, recidive: 15, letsel: 10, bekentenis: 6, wapen: 6, hulpverlener: 6, huiselijk: 6, enkelvoudig: 5, tekst: 10 };

export async function findSimilar(feat: CaseFeatures, opts: { excludeEcli?: string; limit?: number } = {}): Promise<Similar[]> {
  if (!feat.categories.length) return [];
  const groups = [...new Set(feat.categories.map((c) => OFFENSE_BY_CODE.get(c)?.group).filter(Boolean))];
  const groupCats = [...OFFENSE_BY_CODE.values()].filter((o) => groups.includes(o.group)).map((o) => o.code);
  const textQ = feat.text?.trim() ? feat.text.slice(0, 400) : null;
  const rows = await q<Omit<Similar, "score" | "parts" | "known"> & { rank: number | null; wapen: boolean; hulpverlener: boolean; huiselijk: boolean }>(
    `SELECT d.ecli, c.name AS court_name, to_char(d.decision_date,'YYYY-MM-DD') AS decision_date, p.categories, p.recidive, p.letsel, p.bekentenis,
       p.sentence_summary, p.eis_summary, p.outcome, p.wapen, p.hulpverlener, p.huiselijk, p.multi_offense,
       p.taakstraf_uren::float AS taakstraf_uren, p.gev_onvw_dagen::float AS gev_onvw_dagen, p.gev_vw_dagen::float AS gev_vw_dagen, p.geldboete_euro::float AS geldboete_euro,
       ${textQ ? `ts_rank_cd(d.search, plainto_tsquery('dutch', $3))` : "NULL::float"} AS rank
     FROM documents d JOIN case_profiles p ON p.ecli=d.ecli JOIN courts c ON c.code=d.court_code
     WHERE d.is_politierechter AND p.categories && $1::text[] AND d.ecli <> $2 AND p.outcome IN ('veroordeling','vrijspraak','schuldig_zonder_straf','ontslag_van_alle_rechtsvervolging')
     LIMIT 1500`,
    textQ ? [groupCats, opts.excludeEcli ?? "", textQ] : [groupCats, opts.excludeEcli ?? ""],
  );
  const maxRank = Math.max(0.0001, ...rows.map((r) => r.rank ?? 0));
  const out: Similar[] = rows.map((r) => {
    const parts: ScorePart[] = [];
    // delict
    const overlap = r.categories.filter((c) => feat.categories.includes(c));
    const exact = overlap.length && overlap.length === feat.categories.length && r.categories.length === feat.categories.length;
    const sameGroup = r.categories.some((c) => groups.includes(OFFENSE_BY_CODE.get(c)?.group));
    parts.push({ label: "Strafbaar feit", max: W.delict, got: exact ? W.delict : overlap.length ? W.delict * 0.7 : sameGroup ? W.delict * 0.25 : 0,
      detail: exact ? "zelfde delict(en)" : overlap.length ? "deels zelfde delict" : "zelfde delictgroep" });
    // documentatie
    const UNKNOWN = 0.3; // kenmerk bekend in de casus maar niet vermeld in de uitspraak: gedeeltelijke score
    if (feat.recidive && feat.recidive !== "onbekend" && r.recidive === "onbekend") parts.push({ label: "Justitiële documentatie", max: W.recidive, got: W.recidive * UNKNOWN, detail: "niet vermeld in uitspraak" });
    if (feat.letsel && !["onbekend", "nvt"].includes(feat.letsel) && r.letsel === "onbekend") parts.push({ label: "Letsel", max: W.letsel, got: W.letsel * UNKNOWN, detail: "niet vermeld in uitspraak" });
    if (feat.bekentenis && feat.bekentenis !== "onbekend" && r.bekentenis === "onbekend") parts.push({ label: "Proceshouding", max: W.bekentenis, got: W.bekentenis * UNKNOWN, detail: "niet vermeld in uitspraak" });
    if (feat.recidive && feat.recidive !== "onbekend" && r.recidive !== "onbekend") {
      const near = (a: string, b: string) => (["relevant", "eerder"].includes(a) && ["relevant", "eerder"].includes(b)) || (["blanco", "geen_relevante"].includes(a) && ["blanco", "geen_relevante"].includes(b));
      parts.push({ label: "Justitiële documentatie", max: W.recidive, got: r.recidive === feat.recidive ? W.recidive : near(r.recidive, feat.recidive) ? W.recidive * 0.5 : 0, detail: r.recidive === feat.recidive ? "gelijk" : near(r.recidive, feat.recidive) ? "vergelijkbaar" : "verschillend" });
    }
    if (feat.letsel && !["onbekend", "nvt"].includes(feat.letsel) && !["onbekend", "nvt"].includes(r.letsel)) {
      parts.push({ label: "Letsel", max: W.letsel, got: r.letsel === feat.letsel ? W.letsel : 0, detail: r.letsel === feat.letsel ? "gelijk" : "verschillend" });
    }
    if (feat.bekentenis && feat.bekentenis !== "onbekend" && r.bekentenis !== "onbekend") {
      parts.push({ label: "Proceshouding", max: W.bekentenis, got: r.bekentenis === feat.bekentenis ? W.bekentenis : 0, detail: r.bekentenis === feat.bekentenis ? "gelijk" : "verschillend" });
    }
    for (const k of ["wapen", "hulpverlener", "huiselijk"] as const) {
      if (feat[k] === true || r[k] === true) {
        if (feat[k] == null) continue;
        parts.push({ label: k === "wapen" ? "Wapen" : k === "hulpverlener" ? "Hulpverlener/ambtenaar" : "Huiselijke kring", max: W[k], got: !!feat[k] === !!r[k] ? W[k] : 0, detail: !!feat[k] === !!r[k] ? "gelijk" : "verschillend" });
      }
    }
    if (feat.multi != null) parts.push({ label: "Enkel/meervoudig", max: W.enkelvoudig, got: !!feat.multi === r.multi_offense ? W.enkelvoudig : 0, detail: r.multi_offense ? "meerdere feiten" : "één feit" });
    if (textQ) parts.push({ label: "Tekstuele overeenkomst", max: W.tekst, got: Math.round(((r.rank ?? 0) / maxRank) * W.tekst * 10) / 10, detail: "op basis van woordgebruik" });
    const got = parts.reduce((a, p) => a + p.got, 0);
    const max = parts.reduce((a, p) => a + p.max, 0);
    const { rank: _r, wapen: _w, hulpverlener: _h, huiselijk: _hu, ...rest } = r;
    void _r; void _w; void _h; void _hu;
    return { ...rest, score: Math.round((got / max) * 100), parts, known: parts.filter((p) => !p.detail.startsWith("niet vermeld")).length };
  });
  out.sort((a, b) => b.score - a.score || b.known - a.known || (b.decision_date ?? "").localeCompare(a.decision_date ?? ""));
  return out.slice(0, opts.limit ?? 25);
}

export function scoreLabel(s: number, known: number) {
  if (known <= 2) return "beperkt vergelijkbaar (weinig kenmerken bekend)";
  return s >= 80 ? "sterk vergelijkbaar" : s >= 60 ? "redelijk vergelijkbaar" : "beperkt vergelijkbaar";
}
