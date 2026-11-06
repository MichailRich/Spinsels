// Interpretatie van zoekvragen in gewone taal → gestructureerde filters.
// Volledig regelgebaseerd en transparant: iedere herkende term wordt teruggemeld.

import { OFFENSES } from "../reference/offenses";
import { CURRENT_COURTS } from "../reference/courts";
import type { Filters } from "../filters";
import { parseDutchNumber } from "../extract/numbers";

export type Interpretation = { filters: Filters; notes: string[]; residual: string };

const STOP = new Set(
  "wat is de het een voor van bij in op met welke welk hoe zwaar straft strafte straffen straf politierechter politierechters wordt worden werd zijn er zaken zaak waarin opgelegd oplegt opgelegde invloed rechter rechters nederland nederlandse en of als aan te tot uitspraak uitspraken vonnis vonnissen geven geeft krijg krijgt je ik mijn iemand die dat dit deze hebben heeft had voor gemiddeld gemiddelde hoeveel hoe vaak meestal typisch".split(" "),
);

const COURT_WORDS: [RegExp, string][] = [
  [/amsterdam/i, "RBAMS"], [/den haag|'s-gravenhage|haag/i, "RBDHA"], [/rotterdam|dordrecht/i, "RBROT"],
  [/utrecht|midden-nederland|lelystad/i, "RBMNE"], [/noord-holland|haarlem|alkmaar/i, "RBNHO"],
  [/groningen|leeuwarden|assen|noord-nederland/i, "RBNNE"], [/den bosch|'s-hertogenbosch|oost-brabant|eindhoven/i, "RBOBR"],
  [/breda|middelburg|zeeland|west-brabant/i, "RBZWB"], [/maastricht|roermond|limburg/i, "RBLIM"],
  [/arnhem|nijmegen|zutphen|gelderland/i, "RBGEL"], [/zwolle|almelo|overijssel|enschede/i, "RBOVE"],
];

export function interpret(input: string): Interpretation {
  let text = ` ${input.toLowerCase().replace(/[?!.,;]/g, " ")} `;
  const f: Filters = {};
  const notes: string[] = [];
  const consume = (re: RegExp) => {
    text = text.replace(re, " ");
  };

  // ECLI direct
  const ecli = input.match(/ECLI:NL:[A-Z]{2,6}:\d{4}:[A-Z0-9]+/i);
  if (ecli) return { filters: { q: ecli[0].toUpperCase() }, notes: [`ECLI-nummer ${ecli[0].toUpperCase()}`], residual: "" };

  // strafhoogte
  const taak = text.match(/(\d+|[a-zë]+)\s*(?:uur|uren)\s*(?:taakstraf|werkstraf)?/);
  if (taak && (/taakstraf|werkstraf/.test(text) || /uur/.test(taak[0]))) {
    const n = Number(taak[1]) || parseDutchNumber(taak[1]);
    if (n) {
      f.kind = "taakstraf";
      f.min = n;
      f.max = n;
      notes.push(`taakstraf van precies ${n} uur`);
      consume(new RegExp(taak[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
  const gev = text.match(/(\d+)\s*(dag|dagen|week|weken|maand|maanden)\s*(?:onvoorwaardelijke\s*)?(?:gevangenisstraf|cel|celstraf)/);
  if (gev && !f.kind) {
    const n = Number(gev[1]);
    const days = /dag/.test(gev[2]) ? n : /week|weken/.test(gev[2]) ? n * 7 : n * 30;
    f.kind = "gevangenisstraf_onvw";
    f.min = days;
    f.max = days;
    notes.push(`onvoorwaardelijke gevangenisstraf van ${days} dagen`);
    consume(new RegExp(gev[0]));
  }
  const boete = text.match(/(?:€|eur|euro)?\s*(\d[\d.]*)\s*(?:euro|eur)?\s*(?:geld)?boete/);
  if (boete && !f.kind) {
    const n = Number(boete[1].replace(/\./g, ""));
    if (n) {
      f.kind = "geldboete";
      f.min = n;
      f.max = n;
      notes.push(`geldboete van € ${n}`);
      consume(new RegExp(boete[0].replace(/[.*+?^${}()|[\]\\€]/g, "\\$&")));
    }
  }

  // documentatie / recidive
  if (/zonder strafblad|geen strafblad|blanco|first offender|niet eerder veroordeeld|nooit eerder|schoon strafblad|eerste keer|first-offender/.test(text)) {
    f.recidive = ["blanco"];
    notes.push("blanco strafblad (uitdrukkelijk vermeld in de uitspraak)");
    consume(/zonder strafblad|geen strafblad|blanco( strafblad)?|first[- ]offender|niet eerder veroordeeld|nooit eerder|schoon strafblad|eerste keer/g);
  } else if (/recidive|recidivist|tweede|derde|herhaling|eerder veroordeeld|opnieuw|weer|vaker|strafblad/.test(text)) {
    f.recidive = ["relevant", "eerder"];
    notes.push("met eerdere veroordelingen (recidive, uitdrukkelijk vermeld)");
    consume(/recidive|recidivist|tweede|derde|herhaling|eerder veroordeeld|opnieuw|weer|vaker|strafblad/g);
  }

  // letsel
  if (/zonder letsel|geen letsel/.test(text)) {
    f.letsel = ["geen"];
    notes.push("zonder vastgesteld letsel");
    consume(/zonder letsel|geen letsel/g);
  } else if (/ernstig letsel|zwaar letsel|gebroken|fractuur|botbreuk|ziekenhuis/.test(text)) {
    f.letsel = ["ernstig"];
    notes.push("met ernstig letsel");
    consume(/ernstig letsel|zwaar letsel|gebroken \w+|gebroken|fractuur|botbreuk|ziekenhuis/g);
  } else if (/licht letsel|blauwe plek|letsel/.test(text)) {
    f.letsel = ["licht", "ernstig"];
    notes.push("met letsel");
    consume(/licht letsel|blauwe plek|letsel/g);
  }

  if (/bekentenis|bekend|heeft bekend|bekende/.test(text)) {
    f.bekentenis = "bekend";
    notes.push("verdachte heeft bekend");
    consume(/bekentenis|heeft bekend|bekende|bekend/g);
  } else if (/ontken/.test(text)) {
    f.bekentenis = "ontkend";
    notes.push("verdachte ontkent");
    consume(/ontken\w*/g);
  }
  if (/vrijspraak|vrijgesproken/.test(text)) {
    f.outcome = ["vrijspraak"];
    notes.push("uitkomst: vrijspraak");
    consume(/vrijspraak|vrijgesproken/g);
  }
  if (/voorwaardelijk/.test(text) && !/onvoorwaardelijk/.test(text)) {
    f.voorwaardelijk = true;
    notes.push("met voorwaardelijk strafdeel");
    consume(/voorwaardelijke?/g);
  }
  if (/huiselijk|partner|echtgeno|vriendin/.test(text)) {
    f.huiselijk = true;
    notes.push("huiselijke kring");
  }

  // delict
  const cands: { code: string; syn: string }[] = [];
  for (const o of OFFENSES) for (const s of o.synonyms) if (text.includes(` ${s} `) || text.includes(` ${s}`)) cands.push({ code: o.code, syn: s });
  cands.sort((a, b) => b.syn.length - a.syn.length);
  const chosen: string[] = [];
  for (const c of cands) {
    if (!text.includes(c.syn)) continue;
    if (!chosen.includes(c.code)) chosen.push(c.code);
    consume(new RegExp(c.syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
  }
  // generieke 'rijden onder invloed' → alcohol én drugs, tenzij specifiek
  if (chosen.includes("rijden_onder_invloed_alcohol") && /rijden onder invloed/.test(input.toLowerCase()) && !/alcohol|drank|dronken|beschonken/.test(input.toLowerCase())) {
    if (!chosen.includes("rijden_onder_invloed_drugs")) chosen.push("rijden_onder_invloed_drugs");
  }
  if (chosen.includes("geweld_hulpverleners")) {
    const i = chosen.indexOf("mishandeling");
    if (i >= 0) chosen.splice(i, 1);
    f.hulpverlener = undefined;
  }
  if (chosen.includes("winkeldiefstal")) {
    const i = chosen.indexOf("diefstal");
    if (i >= 0) chosen.splice(i, 1);
  }
  if (chosen.includes("wapenbezit") && chosen.length > 1) {
    chosen.splice(chosen.indexOf("wapenbezit"), 1);
    f.wapen = true;
    notes.push("met wapen");
  }
  if (chosen.length) {
    f.cat = chosen;
    notes.unshift(`delict: ${chosen.map((c) => OFFENSES.find((o) => o.code === c)!.label).join(" of ")}`);
  }

  // rechtbank & jaar
  const courts = COURT_WORDS.filter(([re]) => re.test(text)).map(([, c]) => c);
  if (courts.length) {
    f.court = [...new Set(courts)];
    notes.push(`rechtbank: ${f.court.map((c) => CURRENT_COURTS.find((x) => x.code === c)?.name).join(", ")}`);
    for (const [re] of COURT_WORDS) consume(new RegExp(re.source, "gi"));
  }
  const yr = text.match(/\b(?:in|uit)\s+(20\d{2}|19\d{2})\b/);
  const since = text.match(/\b(?:sinds|na|vanaf)\s+(20\d{2}|19\d{2})\b/);
  if (yr) {
    f.yearFrom = Number(yr[1]);
    f.yearTo = Number(yr[1]);
    notes.push(`jaar ${yr[1]}`);
    consume(new RegExp(yr[0]));
  } else if (since) {
    f.yearFrom = Number(since[1]);
    notes.push(`vanaf ${since[1]}`);
    consume(new RegExp(since[0]));
  }

  const residual = text
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
    .join(" ")
    .trim();
  if (!chosen.length && residual) {
    f.q = residual;
    notes.push(`vrije tekst: “${residual}”`);
  }
  return { filters: f, notes, residual: chosen.length ? residual : "" };
}
