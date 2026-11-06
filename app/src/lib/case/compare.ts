// 'Vergelijk mijn zaak': herkent kenmerken in een vrije casusbeschrijving, signaleert
// ontbrekende gegevens, zoekt vergelijkbare uitspraken en geeft — alleen als de gegevens
// het toelaten — een statistische observatie (geen voorspelling).
import { interpret } from "../search/nlq";
import { findSimilar, type CaseFeatures, type Similar } from "../search/similar";
import { findCircumstances } from "../extract/circumstances";
import { sentences } from "../extract/text";
import { classifyFacts } from "../extract";
import { OFFENSE_BY_CODE } from "../reference/offenses";
import { lovsFor } from "../reference/lovs";

export type Detected = CaseFeatures & { notes: string[] };

export function detectFeatures(text: string): Detected {
  const t = text.toLowerCase();
  const nl = interpret(text);
  const cats = new Set(nl.filters.cat ?? []);
  for (const s of sentences(text)) {
    const c = classifyFacts(s.text, text);
    if (c) cats.add(c);
  }
  // spreektaal → delict
  if (/geslagen|slaan|sloeg|klap|stomp|schop|geschopt|kopstoot|vuistslag/.test(t) && ![...cats].some((c) => OFFENSE_BY_CODE.get(c)?.group === "geweld")) cats.add("mishandeling");
  if (/(gebroken|breuk|fractuur)/.test(t) && cats.has("mishandeling")) { /* letsel, geen ander delict */ }
  if (/(politie|agent|boa|ambulance|hulpverlener|handhaver|conducteur)/.test(t) && [...cats].some((c) => ["mishandeling", "bedreiging"].includes(c))) { cats.delete("mishandeling"); cats.add("geweld_hulpverleners"); }
  if (/(partner|vriendin|echtgeno|\bvrouw\b|man van|\bex-|\bex\b|zijn moeder|haar moeder|zijn vader|haar vader)/.test(t) && cats.has("mishandeling")) { cats.delete("mishandeling"); cats.add("huiselijk_geweld"); }
  const circ = findCircumstances(sentences(text), [{ start: 0, end: text.length + 1 }], { isViolent: true, isTraffic: [...cats].some((c) => OFFENSE_BY_CODE.get(c)?.group === "verkeer") });
  const has = (c: string) => circ.some((x) => x.code === c);
  const notes: string[] = [];
  let recidive = "onbekend";
  if (has("geen_relevante_documentatie")) recidive = "geen_relevante";
  else if (has("blanco_strafblad") || /geen strafblad|blanco|niet eerder|nooit eerder|first offender|schoon strafblad/.test(t)) recidive = "blanco";
  else if (has("recidive") || /eerder veroordeeld|strafblad|recidive|vaker|al eerder/.test(t)) recidive = /soortgelijk|vergelijkbaar|ook voor|eerder voor|al eerder/.test(t) ? "relevant" : "eerder";
  let letsel = "onbekend";
  if (/gebroken|breuk|fractuur|zwaar letsel|ziekenhuis|hersenschudding|geopereerd/.test(t)) letsel = "ernstig";
  else if (/blauwe plek|blauw oog|zwelling|schaafwond|bloedneus|kneuzing|snijwond|letsel|bloedde|hechting/.test(t) && !/geen letsel/.test(t)) letsel = "licht";
  else if (/geen letsel|zonder letsel|geen verwondingen/.test(t)) letsel = "geen";
  const bekentenis = /heeft bekend|bekent|bekend\b|geeft toe|toegegeven|erkent/.test(t) ? "bekend" : /ontkent|ontkend|zwijgt|zwijgrecht/.test(t) ? "ontkend" : "onbekend";
  const violent = [...cats].some((c) => OFFENSE_BY_CODE.get(c)?.group === "geweld");
  return {
    categories: [...cats],
    recidive,
    letsel: violent ? letsel : "nvt",
    bekentenis,
    wapen: has("wapengebruik") || /\bmes\b|wapen|knuppel|pistool|fles/.test(t) ? true : null,
    hulpverlener: cats.has("geweld_hulpverleners") || null,
    huiselijk: cats.has("huiselijk_geweld") || null,
    multi: cats.size > 1,
    text,
    notes: [...notes, ...(has("excuses") ? ["excuses aangeboden"] : []), ...(has("berouw") ? ["berouw/spijt"] : [])],
  };
}

export function missingInfo(f: CaseFeatures): string[] {
  const m: string[] = [];
  if (!f.categories.length) m.push("Welk strafbaar feit wordt verweten? (bv. mishandeling, winkeldiefstal, rijden onder invloed)");
  if (!f.recidive || f.recidive === "onbekend") m.push("Is de verdachte eerder veroordeeld, en zo ja voor soortgelijke feiten? (justitiële documentatie)");
  const violent = f.categories.some((c) => OFFENSE_BY_CODE.get(c)?.group === "geweld");
  if (violent && (!f.letsel || f.letsel === "onbekend")) m.push("Welk letsel heeft het slachtoffer opgelopen (geen, licht, ernstig) en is dat medisch vastgesteld?");
  if (!f.bekentenis || f.bekentenis === "onbekend") m.push("Heeft de verdachte bekend of ontkent hij/zij?");
  if (violent && f.wapen == null) m.push("Is er een wapen of voorwerp gebruikt?");
  if (f.categories.includes("rijden_onder_invloed_alcohol") && !/\d{2,3}\s*(?:µg|ug|microgram)/i.test(f.text ?? "")) m.push("Wat was het gemeten adem- of bloedalcoholgehalte, en was er sprake van een beginnend bestuurder?");
  if (f.categories.some((c) => ["winkeldiefstal", "diefstal", "oplichting", "verduistering", "fraude", "heling"].includes(c)) && !/€|euro/.test(f.text ?? "")) m.push("Wat was de waarde van de goederen of het benadelingsbedrag?");
  if (violent && f.letsel === "ernstig") m.push("Is het letsel juridisch aan te merken als zwaar lichamelijk letsel (art. 82 Sr)? Dan kan ook art. 300 lid 2 of art. 302 Sr (zware mishandeling) aan de orde zijn — dit hangt af van onder meer de aard, het herstel en blijvende gevolgen.");
  m.push("Persoonlijke omstandigheden (werk, zorgtaken, behandeling, reclasseringsadvies) die de rechter kan meewegen.");
  return m;
}

const pctl = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round((s[lo] + (s[hi] - s[lo]) * (i - lo)) * 10) / 10;
};

export function observe(similar: Similar[]) {
  const good = similar.filter((s) => s.score >= 60 && s.known >= 3 && s.outcome === "veroordeling");
  const take = good.slice(0, 25);
  const n = take.length;
  const share = (pred: (s: Similar) => boolean) => (n ? Math.round((take.filter(pred).length / n) * 100) : 0);
  const taak = take.map((s) => s.taakstraf_uren ?? 0).filter((v) => v > 0);
  const onvw = take.map((s) => s.gev_onvw_dagen ?? 0).filter((v) => v > 0);
  const boete = take.map((s) => s.geldboete_euro ?? 0).filter((v) => v > 0);
  return {
    n,
    sufficient: n >= 5,
    taakstraf: { share: share((s) => (s.taakstraf_uren ?? 0) > 0), p25: pctl(taak, 0.25), median: pctl(taak, 0.5), p75: pctl(taak, 0.75), n: taak.length },
    onvw: { share: share((s) => (s.gev_onvw_dagen ?? 0) > 0), p25: pctl(onvw, 0.25), median: pctl(onvw, 0.5), p75: pctl(onvw, 0.75), n: onvw.length },
    vw: { share: share((s) => (s.gev_vw_dagen ?? 0) > 0) },
    boete: { share: share((s) => (s.geldboete_euro ?? 0) > 0), p25: pctl(boete, 0.25), median: pctl(boete, 0.5), p75: pctl(boete, 0.75), n: boete.length },
    acquitShare: similar.length ? Math.round((similar.filter((s) => s.score >= 60 && s.outcome === "vrijspraak").length / Math.max(1, similar.filter((s) => s.score >= 60).length)) * 100) : 0,
  };
}

export async function compareCase(f: CaseFeatures, excludeEcli?: string) {
  const similar = await findSimilar(f, { excludeEcli, limit: 40 });
  const lovs = f.categories.map((c) => lovsFor(c)).filter(Boolean).filter((x, i, a) => a.findIndex((y) => y!.heading === x!.heading) === i);
  return { features: f, missing: missingInfo(f), similar, observation: observe(similar), lovs };
}
