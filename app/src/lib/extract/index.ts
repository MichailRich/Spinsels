// Regelgebaseerde extractie ('rules-v1') van een politierechtervonnis.
// Uitgangspunt: alleen vastleggen wat letterlijk in de uitspraak staat, met bronpassage.

import { OFFENSES, OFFENSE_BY_CODE, type OffenseCategory } from "../reference/offenses";
import { ARTICLE_BY_CODE } from "../reference/articles";
import { extractSanctions, summarize, type Component } from "./sanctions";
import { findCircumstances, type FoundCircumstance } from "./circumstances";
import { roleSpans, sentences, slice, type Section, type Span, type Sentence, negatedBefore } from "./text";

export const EXTRACTOR = "rules-v1";

export type ExtractedOffense = {
  feitNr: string | null;
  role: "kwalificatie" | "bewezen" | "ten_laste_gelegd" | "vrijgesproken";
  category: string | null;
  qualification: string;
  articles: string[];
  evidence: string;
  evidenceStart: number;
  evidenceEnd: number;
  confidence: number;
};

export type Profile = {
  primaryCategory: string | null;
  categories: string[];
  articles: string[];
  offenseCount: number;
  multiOffense: boolean;
  acquittal: "geheel" | "gedeeltelijk" | null;
  outcome: string;
  recidive: "blanco" | "geen_relevante" | "eerder" | "relevant" | "onbekend";
  letsel: "geen" | "licht" | "ernstig" | "onbekend" | "nvt";
  bekentenis: "bekend" | "ontkend" | "gedeeltelijk" | "onbekend";
  wapen: boolean;
  hulpverlener: boolean;
  huiselijk: boolean;
  alcoholUgl: number | null;
  taakstrafUren: number | null;
  gevOnvwDagen: number | null;
  gevVwDagen: number | null;
  geldboeteEuro: number | null;
  ontzeggingMaanden: number | null;
  eisTaakstrafUren: number | null;
  eisGevOnvwDagen: number | null;
  eisGevVwDagen: number | null;
  eisGeldboeteEuro: number | null;
  eisOntzeggingMaanden: number | null;
  sentenceSummary: string;
  eisSummary: string | null;
  motivation: string | null;
  motivationStart: number | null;
  factsSummary: string | null;
  quality: number;
};

export type Extraction = {
  offenses: ExtractedOffense[];
  imposed: Component[];
  demanded: Component[];
  circumstances: FoundCircumstance[];
  profile: Profile;
  spans: { beslissing?: Span; eis?: Span; motivation: Span[] };
};

export type DocInput = {
  ecli: string;
  fullText: string;
  sections: Section[];
  inhoudsindicatie: string | null;
};

// ------------------------------------------------------------------ artikelen
const LAW_MAP: [RegExp, string][] = [
  [/wetboek van strafrecht|\bsr\b/i, "Sr"],
  [/wegenverkeerswet|\bwvw\b/i, "WVW"],
  [/opiumwet/i, "OW"],
  [/wet wapens en munitie|\bwwm\b/i, "WWM"],
];

export function parseArticles(text: string): string[] {
  const out = new Set<string>();
  const re = /artikel(?:en)?\s+((?:\d+[a-z]*(?:bis|ter|quater)?(?:\s*,?\s*(?:eerste|tweede|derde|vierde|vijfde|zesde|1e|2e|3e) lid)?(?:\s*,?\s*(?:aanhef en )?onder [a-z0-9]+)?(?:\s*(?:,|en|jo\.?|juncto)\s*)?)+)\s*,?\s*(?:van (?:het|de)\s+|uit (?:het|de)\s+)?(wetboek van strafrecht|wegenverkeerswet(?: 1994)?|opiumwet|wet wapens en munitie|sr\b|wvw(?: 1994)?|wwm\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const law = LAW_MAP.find(([r]) => r.test(m![2]))?.[1];
    if (!law) continue;
    const nums = m[1].replace(/(?:eerste|tweede|derde|vierde|vijfde|zesde|1e|2e|3e) lid/gi, "").replace(/(?:aanhef en )?onder [a-z0-9]+/gi, "").match(/\d+[a-z]*(?:bis|ter|quater)?/gi) ?? [];
    for (const n of nums) {
      const code = `${law}:${n.toLowerCase()}`;
      if (ARTICLE_BY_CODE.has(code)) out.add(code);
    }
  }
  return [...out];
}

// ------------------------------------------------------------------ classificatie
function normQual(s: string) {
  return s.toLowerCase().replace(/,\s*onder/g, " onder").replace(/\s+/g, " ").trim();
}

export function classifyQualification(line: string, context: string): { cat: OffenseCategory; confidence: number } | null {
  const q = normQual(line);
  const ctx = context.toLowerCase();
  let best: { cat: OffenseCategory; confidence: number } | null = null;
  for (const o of OFFENSES) {
    if (!o.qual?.some((r) => r.test(q))) continue;
    if (o.refine && !(o.refine.test(q) || o.refine.test(ctx))) continue;
    if (!best || o.priority > best.cat.priority) best = { cat: o, confidence: 0.85 };
  }
  // Opiumwet art. 3 onder B: telen vs. handel
  if (/artikel 3 onder b/.test(q)) {
    const teelt = /(?:geteeld|telen|kweken|gekweekt|hennepplant|kwekerij|plantage)/.test(q + " " + ctx);
    best = { cat: OFFENSE_BY_CODE.get(teelt ? "hennepteelt" : "drugshandel")!, confidence: 0.75 };
  } else if (/artikel 2 onder b/.test(q)) {
    best = { cat: OFFENSE_BY_CODE.get("drugshandel")!, confidence: 0.8 };
  }
  return best;
}

const QUAL_BOILERPLATE = /^(?:er (?:zijn|is) geen|het bewezenverklaarde levert|de verdachte is (?:daarom )?strafbaar|het feit is strafbaar|de feiten zijn strafbaar|dit levert op|levert op|het bewezene levert|strafbaarheid|kwalificatie|de politierechter|de rechtbank|omdat|nu |ten aanzien van|verdachte is)/i;

function qualificationLines(text: string, span: Span | undefined): Sentence[] {
  if (!span) return [];
  const out: Sentence[] = [];
  let pos = span.start;
  for (const raw of slice(text, span).split("\n")) {
    const start = pos;
    pos += raw.length + 1;
    const line = raw.trim().replace(/^(?:feit\s*\d+[a-z]?\s*[:.]?|\d+[a-z]?[.:)]\s*|[-•]\s*)/i, "").trim();
    if (line.length < 6 || line.length > 600) continue;
    if (QUAL_BOILERPLATE.test(line) && !/levert (?:het|de|op)[^:]*:\s*\S/.test(line)) continue;
    out.push({ text: raw.trim(), start, end: start + raw.length });
  }
  return out;
}

// ------------------------------------------------------------------ hoofdfunctie
export function extractDocument(doc: DocInput): Extraction {
  const T = doc.fullText;
  const roles = roleSpans(T, doc.sections);
  const last = (r: Parameters<typeof roles.get>[0]) => {
    const l = roles.get(r);
    return l?.[l.length - 1];
  };

  // ---- beslissing
  let beslissing = last("beslissing");
  if (beslissing) beslissing = { start: beslissing.start, end: T.length };
  if (!beslissing) {
    const idx = Math.max(T.search(/\n(?:\d+[.\s]*)?(?:de )?beslissing\b/i), T.toLowerCase().lastIndexOf("\nbeslissing"));
    if (idx > 0) beslissing = { start: idx, end: T.length };
  }
  if (!beslissing) {
    const lower = T.toLowerCase();
    const m = [...lower.matchAll(/(?:de politierechter |)(?:veroordeelt|verklaart (?:het|de|bewezen))/g)].find((x) => !/(?:gevorderd|geëist|vordert)[^.]{0,200}$/.test(lower.slice(Math.max(0, x.index! - 200), x.index)));
    if (m) beslissing = { start: Math.max(0, m.index! - 50), end: T.length };
  }

  if (!beslissing) {
    // mondeling vonnis / proces-verbaal: dictum als losse regels ('Gevangenisstraf voor de duur van ...')
    const m = /\n(?:[-•]\s*)?(?:een )?(?:gevangenisstraf|taakstraf|werkstraf|geldboete|hechtenis|ontzegging)\b[^\n]{0,40}(?:van|voor)/i.exec(T.slice(Math.floor(T.length * 0.3)));
    if (m) {
      const st = Math.floor(T.length * 0.3) + m.index;
      beslissing = { start: Math.max(0, st - 300), end: Math.min(T.length, st + 2500) };
    }
  }
  if (beslissing) {
    const tulAfter = (roles.get("vordering_tul") ?? []).filter((s) => s.start > beslissing!.start + 50).map((s) => s.start);
    if (tulAfter.length) beslissing = { start: beslissing.start, end: Math.min(...tulAfter) };
  }

  // ---- eis van de officier van justitie
  const strafSpans = (roles.get("straf") ?? []).filter((s) => !beslissing || s.start < beslissing.start);
  const eisSection = last("eis");
  const eisSearch: Span[] = [...(eisSection ? [eisSection] : []), ...strafSpans];
  let eis: Span | undefined;
  for (const sp of [...eisSearch, { start: 0, end: beslissing?.start ?? T.length }]) {
    const sents = sentences(slice(T, sp), sp.start);
    const i = sents.findIndex((s) => /officier van justitie[^;]{0,200}?(?:gevorderd|geëist|eist|vordert|vordering|requisitoir)|(?:gevorderd|geëist)[^;]{0,80}officier van justitie|^(?:\d[\d.]*\s*)?(?:de )?eis(?: van de officier)?(?: van justitie)?\s*:?$/i.test(s.text));
    if (i < 0) continue;
    let end = sents[i].end;
    for (let j = i + 1; j < sents.length && sents[j].start - sents[i].start < 1500; j++) {
      if (/^(?:\d[\d.]*\s*)?(?:het )?(?:standpunt|oordeel)|^de (?:raadsman|raadsvrouw|verdediging|advocaat|verdachte|politierechter|rechtbank)|^(?:\d[\d.]*\s*)?(?:de )?(?:strafmotivering|motivering)/i.test(sents[j].text)) break;
      end = sents[j].end;
    }
    eis = { start: sents[i].start, end };
    break;
  }

  // ---- strafmotivering (oordeel van de politierechter over de straf)
  const motivation: Span[] = [];
  for (const sp of strafSpans) {
    const sents = sentences(slice(T, sp), sp.start);
    const i = sents.findIndex((s) =>
      (!eis || s.start >= eis.end || s.end <= eis.start) &&
      /(?:oordeel van de politierechter|de politierechter (?:heeft|houdt|acht|let|neemt|is van oordeel|legt|zal|komt|ziet|vindt|overweegt|rekent)|bij de (?:bepaling|strafoplegging|keuze|strafbepaling)|de op te leggen straf|^(?:\d[\d.]*\s*)?(?:de )?(?:strafmotivering|motivering))/i.test(s.text) &&
      !/(?:raadsman|raadsvrouw|advocaat|verdediging) (?:heeft|bepleit|verzoekt)/i.test(s.text),
    );
    if (i >= 0) motivation.push({ start: sents[i].start, end: sp.end });
  }
  if (!motivation.length) {
    // terugval: zinnen van de politierechter met weegtaal buiten eis/bewijs
    for (const s of sentences(T)) {
      if (beslissing && s.start >= beslissing.start) break;
      if (eis && s.start >= eis.start && s.start < eis.end) continue;
      if (/(?:de politierechter|ik) (?:heeft|houdt|acht|let|neemt|legt|zal)[^.]{0,120}(?:rekening|straf|in aanmerking|ernst)/i.test(s.text)) motivation.push({ start: s.start, end: s.end });
    }
  }

  // ---- strafcomponenten
  let imposed = beslissing ? extractSanctions(slice(T, beslissing), beslissing.start, { origin: "opgelegd" }) : [];
  const MAIN = ["taakstraf", "gevangenisstraf", "hechtenis", "geldboete", "ontzegging", "schuldigverklaring_zonder_straf"];
  if (!imposed.some((c) => MAIN.includes(c.kind))) {
    // dictum buiten de beslissingssectie (bv. 'De politierechter veroordeelt verdachte tot ...')
    const extra = sentences(T).filter((x) =>
      /^(?:de politierechter\s+)?(?:veroordeelt|ontzegt)\b|^(?:[-•]\s*)?(?:een )?(?:taakstraf|werkstraf|gevangenisstraf|geldboete|hechtenis)\s+(?:van|voor de duur)/i.test(x.text) && (!eis || x.start < eis.start || x.start >= eis.end) &&
      !/gevorderd|geëist|officier|verdediging|raadsman|raadsvrouw|bepleit/i.test(x.text));
    for (const x of extra) imposed.push(...extractSanctions(x.text, x.start, { origin: "opgelegd" }));
  }
  if (!imposed.some((c) => c.kind !== "tul_eerder") && doc.inhoudsindicatie && !/vrijspraak|vrijgesproken/i.test(doc.inhoudsindicatie)) {
    // terugval: inhoudsindicatie (samenvatting door de Rechtspraak) — lagere betrouwbaarheid
    const inhSents = sentences(doc.inhoudsindicatie).filter((x) => !/eis|geëist|gevorderd|officier|OM /i.test(x.text));
    imposed = inhSents.flatMap((x) => extractSanctions(x.text, 0, { origin: "opgelegd" })).filter((c) => c.kind !== "tul_eerder" && c.kind !== "vordering_benadeelde")
      .map((c) => ({ ...c, evidenceStart: -1, evidenceEnd: -1, confidence: 0.5, description: `${c.description} (volgens inhoudsindicatie)` }));
  }
  const demanded = eis ? extractSanctions(slice(T, eis), eis.start, { origin: "eis_om" }).filter((c) => c.kind !== "tul_eerder" && c.kind !== "vordering_benadeelde") : [];

  // ---- strafbare feiten
  const bewezen = last("bewezenverklaring");
  const bewezenText = slice(T, bewezen);
  const context = `${bewezenText}\n${doc.inhoudsindicatie ?? ""}`;
  const offenses: ExtractedOffense[] = [];
  const qualSpan = last("kwalificatie");
  for (const line of qualificationLines(T, qualSpan)) {
    const c = classifyQualification(line.text, context);
    if (!c && /^(?:\d+\s+)?[A-Z\s]{6,}$|levert[^:]*op:?\s*$|strafbare? feit(?:en)? op:?\s*$/.test(line.text.trim())) continue;
    if (!c && (/^(?:\d+\s+)?kwalificatie|parketnummer|gegrond op|leveren op:?$|levert op:?$|toegepaste wetsartikelen|^de (?:oplegging|beslissing)/i.test(line.text) || line.text.length < 12)) continue;
    const feit = line.text.match(/^feit\s*(\d+[a-z]?)/i)?.[1] ?? line.text.match(/^(\d+[a-z]?)[.:)]/)?.[1] ?? null;
    offenses.push({
      feitNr: feit, role: "kwalificatie", category: c?.cat.code ?? null,
      qualification: line.text.replace(/^(?:feit\s*\d+[a-z]?\s*[:.]?|\d+[a-z]?[.:)])\s*/i, ""),
      articles: [], evidence: line.text, evidenceStart: line.start, evidenceEnd: line.end, confidence: c?.confidence ?? 0.3,
    });
  }
  // niet-geclassificeerde maar herkenbare kwalificaties → 'overig'
  for (const o of offenses) {
    if (!o.category && /opzettelijk|overtreding|misdrijf|artikel \d|medeplegen|poging|wederrechtelijk/i.test(o.qualification) && o.qualification.length < 400) {
      o.category = "overig";
      o.confidence = 0.5;
    }
  }
  // terugval: kwalificatie in beslissing ('verklaart ... dat het bewezenverklaarde oplevert: ...')
  if (!offenses.some((o) => o.category) && beslissing) {
    for (const s of sentences(slice(T, beslissing), beslissing.start)) {
      if (/veroordeelt|bepaalt|ontzegt|stelt|gelast|wijst/i.test(s.text.slice(0, 30))) continue;
      const c = classifyQualification(s.text, context);
      if (c && s.text.length < 500) {
        offenses.push({ feitNr: null, role: "kwalificatie", category: c.cat.code, qualification: s.text, articles: [], evidence: s.text, evidenceStart: s.start, evidenceEnd: s.end, confidence: c.confidence - 0.1 });
      }
    }
  }

  // ---- tenlastegelegde feiten (feitelijke omschrijving) — o.a. nodig bij vrijspraak
  const tll = last("tenlastelegging");
  const tllOffenses: ExtractedOffense[] = [];
  if (tll) {
    const tllText = slice(T, tll);
    const seen = new Set<string>();
    for (const s of sentences(tllText, tll.start)) {
      const cat = classifyFacts(s.text, tllText);
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        tllOffenses.push({ feitNr: null, role: "ten_laste_gelegd", category: cat, qualification: s.text.slice(0, 300), articles: [], evidence: s.text.slice(0, 600), evidenceStart: s.start, evidenceEnd: s.end, confidence: 0.55 });
      }
    }
  }
  if (!offenses.some((o) => o.category)) {
    for (const o of tllOffenses) offenses.push({ ...o, role: outcomeHint(T, beslissing) === "vrijspraak" ? "vrijgesproken" : "ten_laste_gelegd" });
  } else {
    offenses.push(...tllOffenses);
  }

  // ---- wetsartikelen
  const vs = last("voorschriften");
  const articleText = vs ? slice(T, vs) : (T.match(/(?:gelet op|gegrond op|toepassing van)[^]{0,600}/i)?.[0] ?? "");
  let articles = parseArticles(articleText);
  if (!articles.length && beslissing) articles = parseArticles(slice(T, beslissing));

  // terugval: artikelen + inhoudsindicatie
  if (!offenses.some((o) => o.category)) {
    const hint = OFFENSES.filter((o) => o.articleHints?.some((r) => articles.some((a) => r.test(a)))).sort((a, b) => b.priority - a.priority);
    const inh = (doc.inhoudsindicatie ?? "").toLowerCase();
    const synCode = classifyInhoud(inh) ?? (/economische politierechter/i.test(T.slice(0, 3000)) ? "economisch" : null);
    const syn = synCode ? [OFFENSE_BY_CODE.get(synCode)!] : [];
    const cat = hint[0] ?? syn[0];
    if (cat) {
      const ev = doc.inhoudsindicatie ?? articleText.slice(0, 300);
      offenses.push({ feitNr: null, role: "kwalificatie", category: cat.code, qualification: hint[0] ? `Afgeleid uit toegepaste artikelen (${articles.join(", ")})` : "Afgeleid uit inhoudsindicatie", articles, evidence: ev, evidenceStart: -1, evidenceEnd: -1, confidence: 0.45 });
    }
  }
  // artikelen koppelen aan feiten
  for (const o of offenses) {
    if (o.category && !o.articles.length) o.articles = OFFENSE_BY_CODE.get(o.category)!.articles.filter((a) => articles.includes(a));
  }

  const qualOffenses = offenses.filter((o) => o.category && o.role === "kwalificatie");
  const catOffenses = qualOffenses.length ? qualOffenses : offenses.filter((o) => o.category);
  const categories = [...new Set(catOffenses.map((o) => o.category!))];
  const primary = [...catOffenses].sort((a, b) => OFFENSE_BY_CODE.get(b.category!)!.priority - OFFENSE_BY_CODE.get(a.category!)!.priority)[0]?.category ?? null;
  const group = primary ? OFFENSE_BY_CODE.get(primary)!.group : null;
  const isViolent = categories.some((c) => OFFENSE_BY_CODE.get(c)!.group === "geweld") || /mishandel|geweld|geslagen|geschopt/.test(context.toLowerCase());
  const isTraffic = group === "verkeer";

  // ---- omstandigheden
  const allSents = sentences(T);
  const exclude: Span[] = [...(roles.get("tenlastelegging") ?? []), ...(roles.get("voorschriften") ?? []), ...(roles.get("vordering_tul") ?? [])];
  if (beslissing) exclude.push(beslissing);
  const circumstances = findCircumstances(allSents, motivation, { excludeSpans: exclude, isViolent, isTraffic });

  // ---- profiel
  const has = (code: string) => circumstances.some((c) => c.code === code);
  const recidiveSents = circumstances.filter((c) => c.code === "recidive");
  let recidive: Profile["recidive"] = "onbekend";
  const relevantRe = /soortgelijk|vergelijkbaar|gelijksoortig|recidive|recidiveert|veelpleger|stelselmatige dader|proeftijd|eerder voor (?:een )?(?:mishandeling|diefstal|bedreiging|rijden|winkeldiefstal|geweld|verkeer|opiumwet|belediging|vernieling)|(?:onder|in) de invloed/i;
  if (recidiveSents.some((c) => relevantRe.test(c.evidence) && !/niet[^.]{0,30}(?:soortgelijk|vergelijkbaar|gelijksoortig)/i.test(c.evidence))) recidive = "relevant";
  else if (has("geen_relevante_documentatie")) recidive = "geen_relevante";
  else if (recidiveSents.length) recidive = "eerder";
  else if (has("blanco_strafblad")) recidive = "blanco";

  let letsel: Profile["letsel"] = isViolent ? "onbekend" : "nvt";
  if (isViolent) {
    if (has("ernstig_letsel")) letsel = "ernstig";
    else {
      const scan = allSents.filter((s) => !exclude.some((e) => s.start >= e.start && s.start < e.end));
      const light = scan.find((s) => {
        const l = s.text.toLowerCase();
        const m = /(blauwe plek|blauw oog|zwelling|schaafwond|schaafwonden|bloedneus|kneuzing|rode plek|roodheid|snijwond|bult|hechting|hechtingen|letsel (?:opgelopen|bekomen|heeft|had)|(?:een )?(?:hoofd|gezichts)wond|bloedde|bloeding|krassen|wondje)/.exec(l);
        return m && !negatedBefore(l, m.index);
      });
      if (light) letsel = "licht";
      else if (scan.some((s) => /geen (?:zichtbaar |lichamelijk |enkel )?letsel/i.test(s.text))) letsel = "geen";
    }
  }

  const bekendSent = circumstances.find((c) => c.code === "bekentenis");
  const ontkendSent = circumstances.find((c) => c.code === "ontkenning");
  const bekentenis: Profile["bekentenis"] = bekendSent && ontkendSent ? (/gedeeltelijk|deels/.test(bekendSent.evidence) ? "gedeeltelijk" : "bekend") : bekendSent ? (/gedeeltelijk|deels/.test(bekendSent.evidence) ? "gedeeltelijk" : "bekend") : ontkendSent ? "ontkend" : "onbekend";

  const alc = T.match(/ademalcoholgehalte[^.]{0,60}?(\d{2,4})\s*(?:\([a-zë ]+\)\s*)?(?:microgram|µg|ug)/i);
  const alcoholUgl = alc ? Number(alc[1]) : null;

  const real = imposed.filter((c) => c.kind !== "tul_eerder" && c.kind !== "vordering_benadeelde");
  const sum = (cs: Component[], kinds: string[], cond: boolean) => {
    const xs = cs.filter((c) => kinds.includes(c.kind) && c.conditional === cond && c.amount != null);
    return xs.length ? xs.reduce((a, c) => a + Number(c.amount), 0) : null;
  };
  const besl = slice(T, beslissing).toLowerCase();
  let outcome = "onbekend";
  const TL = T.toLowerCase();
  if (!/veroordeelt|schuldig/.test(TL) && /vordering (?:tot )?(?:tenuitvoerlegging|tul)|na voorwaardelijke veroordeling|verlengt de proeftijd|wijzigt de (?:bijzondere )?voorwaarden/.test(TL)) outcome = "tul_beslissing";
  else if (real.some((c) => c.kind === "schuldigverklaring_zonder_straf")) outcome = "schuldig_zonder_straf";
  else if (real.length) outcome = "veroordeling";
  else if (!/veroordeelt|spreekt (?:de )?verdachte[^.]{0,80}vrij/.test(besl) && /tenuitvoerlegging|ten uitvoer|proeftijd|bijzondere voorwaarden/.test(besl)) outcome = "tul_beslissing";
  else if (/spreekt (?:de )?(?:verdachte|hem|haar|verdachten)[^.]{0,80}vrij|vrijspraak|wordt (?:daarvan )?vrijgesproken|niet bewezen en de verdachte wordt/.test(besl)) outcome = "vrijspraak";
  else if (/ontslaat[^.]{0,80}rechtsvervolging/.test(besl)) outcome = "ontslag_van_alle_rechtsvervolging";
  else if (/niet[- ]ontvankelijk/.test(besl) && /officier|openbaar ministerie/.test(besl)) outcome = "niet_ontvankelijk";
  const partial = sentences(besl).some((x) => /spreekt (?:de )?(?:verdachte|hem|haar)[^.]{0,80}vrij|niet bewezen/.test(x.text) && !/meer of anders/.test(x.text));
  const acquittal: Profile["acquittal"] = outcome === "vrijspraak" ? "geheel" : outcome === "veroordeling" && partial ? "gedeeltelijk" : null;

  const motText = motivation.map((m) => slice(T, m)).join("\n").trim();
  const quality =
    (real.length || outcome !== "onbekend" ? 0.4 : 0) + (primary ? 0.3 : 0) + (demanded.length ? 0.15 : 0) + (motText ? 0.15 : 0);

  const profile: Profile = {
    primaryCategory: primary,
    categories,
    articles,
    offenseCount: Math.max(catOffenses.length, offenses.length ? 1 : 0),
    multiOffense: catOffenses.length > 1,
    acquittal,
    outcome,
    recidive,
    letsel,
    bekentenis,
    wapen: has("wapengebruik") || primary === "wapenbezit",
    hulpverlener: categories.includes("geweld_hulpverleners") || categories.includes("wederspannigheid") || (has("geweld_hulpverleners") && (isViolent || categories.includes("belediging"))),
    huiselijk: categories.includes("huiselijk_geweld") || (has("huiselijk_geweld") && isViolent),
    alcoholUgl,
    taakstrafUren: sum(real, ["taakstraf"], false),
    gevOnvwDagen: sum(real, ["gevangenisstraf", "hechtenis"], false),
    gevVwDagen: sum(real, ["gevangenisstraf", "hechtenis"], true),
    geldboeteEuro: sum(real, ["geldboete"], false),
    ontzeggingMaanden: sum(real, ["ontzegging"], false),
    eisTaakstrafUren: sum(demanded, ["taakstraf"], false),
    eisGevOnvwDagen: sum(demanded, ["gevangenisstraf", "hechtenis"], false),
    eisGevVwDagen: sum(demanded, ["gevangenisstraf", "hechtenis"], true),
    eisGeldboeteEuro: sum(demanded, ["geldboete"], false),
    eisOntzeggingMaanden: sum(demanded, ["ontzegging"], false),
    sentenceSummary: summarize(real) || (outcome === "vrijspraak" ? "Vrijspraak" : outcome === "onbekend" ? "Niet automatisch vastgesteld" : outcome.replace(/_/g, " ")),
    eisSummary: demanded.length ? summarize(demanded) : null,
    motivation: motText ? motText.slice(0, 6000) : null,
    motivationStart: motivation[0]?.start ?? null,
    factsSummary: doc.inhoudsindicatie ?? (bewezenText ? bewezenText.slice(0, 900) : null),
    quality,
  };

  return { offenses: offenses.filter((o) => o.category), imposed, demanded, circumstances, profile, spans: { beslissing, eis, motivation } };
}

// ------------------------------------------------------------------ feitelijke omschrijving (tenlastelegging)
const FACTS: [string, RegExp][] = [
  ["geweld_hulpverleners", /(?:mishandeld|bedreigd|geslagen|geschopt)[^.]{0,200}(?:ambtenaar|politie|agent|verbalisant|boa|hulpverlener|ambulance)|(?:ambtenaar|politie|agent|verbalisant|boa|hulpverlener|ambulance)[^.]{0,200}(?:mishandeld|bedreigd)/],
  ["openlijke_geweldpleging", /openlijk[^.]{0,30}in vereniging[^.]{0,40}geweld/],
  ["zware_mishandeling", /zwaar lichamelijk letsel[^.]{0,80}toegebracht|zwaar lichamelijk letsel toe te brengen/],
  ["mishandeling", /\bmishandeld\b/],
  ["bedreiging", /\bbedreigd\b/],
  ["wederspannigheid", /verzet geboden|wederspannig/],
  ["diefstal_braak", /weggenomen[^.]{0,300}(?:braak|verbreking|inklimming|valse sleutel)/],
  ["winkeldiefstal", /weggenomen[^.]{0,200}(?:winkel|supermarkt|albert heijn|jumbo|lidl|aldi|hema|kruidvat|action|etos|bijenkorf)|(?:winkel|supermarkt|albert heijn|jumbo|lidl|aldi|hema|kruidvat|action|etos)[^.]{0,200}weggenomen/],
  ["diefstal", /\bweggenomen\b/],
  ["verduistering", /toegeëigend|zich wederrechtelijk heeft toegeëigend/],
  ["oplichting", /bewogen tot (?:de )?afgifte|listige kunstgrepen|samenweefsel van verdichtsels/],
  ["heling", /(?:verworven|voorhanden gehad|overgedragen)[^.]{0,160}(?:wist|redelijkerwijs had moeten vermoeden)[^.]{0,80}(?:misdrijf|gestolen)/],
  ["vernieling", /vernield|beschadigd|onbruikbaar gemaakt/],
  ["belediging", /beledigd|beledigende|smadelijk/],
  ["belaging", /stelselmatig[^.]{0,80}inbreuk/],
  ["huisvredebreuk", /wederrechtelijk[^.]{0,40}(?:binnengedrongen|vertoefd|vertoevende)/],
  ["rijden_onder_invloed_alcohol", /alcoholhoudende drank|ademalcoholgehalte|bloedalcoholgehalte/],
  ["rijden_onder_invloed_drugs", /(?:stof|stoffen)[^.]{0,120}(?:rijvaardigheid|in het bloed)|onder invloed van[^.]{0,40}(?:drugs|cocaïne|amfetamine|thc|cannabis)/],
  ["rijden_tijdens_ontzegging", /bevoegdheid[^.]{0,60}ontzegd/],
  ["rijden_zonder_rijbewijs", /zonder (?:dat (?:hem|haar) )?(?:een )?(?:geldig )?rijbewijs|ongeldig (?:verklaard|was verklaard)/],
  ["verlaten_plaats_ongeval", /plaats van het ongeval[^.]{0,40}verlaten|na een (?:verkeers)?ongeval[^.]{0,80}doorgereden/],
  ["verkeersongeval_letsel", /verkeersongeval[^.]{0,200}(?:zwaar lichamelijk letsel|gedood|overleden)/],
  ["gevaarlijk_rijgedrag", /gevaar op de weg|zeer gevaarlijk/],
  ["hennepteelt", /(?:geteeld|gekweekt|telen)[^.]{0,120}hennep|hennepplant/],
  ["bezit_harddrugs", /aanwezig (?:heeft )?gehad[^.]{0,120}(?:cocaïne|mdma|xtc|amfetamine|heroïne|ketamine|ghb|3-mmc|4-mmc)/],
  ["bezit_softdrugs", /aanwezig (?:heeft )?gehad[^.]{0,120}(?:hennep|hasj|hasjiesj|cannabis)/],
  ["drugshandel", /(?:verkocht|afgeleverd|verstrekt|vervoerd)[^.]{0,120}(?:cocaïne|mdma|xtc|amfetamine|heroïne|hennep|hasj|drugs|middel)/],
  ["wapenbezit", /wapen(?:s)? van categorie|munitie van categorie/],
  ["valsheid_in_geschrift", /valselijk opgemaakt|vervalst/],
  ["cybercrime", /geautomatiseerd werk|persoonsgegevens[^.]{0,80}(?:verspreid|verschaft)/],
  ["zeden", /schennis|ontuchtig|seksueel getint|seksuele handelingen/],
];

export function classifyFacts(sentence: string, context: string): string | null {
  const s = sentence.toLowerCase();
  for (const [cat, re] of FACTS) {
    if (re.test(s)) {
      if (cat === "diefstal" && FACTS.find(([c]) => c === "winkeldiefstal")![1].test(context.toLowerCase().slice(0, 4000))) return "winkeldiefstal";
      return cat;
    }
  }
  return null;
}

function outcomeHint(T: string, besl: Span | undefined): string {
  const b = slice(T, besl).toLowerCase();
  if (!/veroordeelt/.test(b) && /spreekt (?:de )?(?:verdachte|hem|haar)[^.]{0,80}vrij/.test(b)) return "vrijspraak";
  return "onbekend";
}

// Terugval op de inhoudsindicatie (samenvatting door de Rechtspraak): specifieke delictstermen.
const INH_MAP: [RegExp, string][] = [
  [/geweld tegen (?:politie|hulpverlener|boa|ambulance)|mishandeling van (?:een )?(?:politie|agent|boa|hulpverlener)/, "geweld_hulpverleners"],
  [/openlijke geweldpleging|openlijk geweld/, "openlijke_geweldpleging"],
  [/zware mishandeling/, "zware_mishandeling"],
  [/huiselijk geweld|partnergeweld/, "huiselijk_geweld"],
  [/mishandel/, "mishandeling"],
  [/bedreig/, "bedreiging"],
  [/wederspannig/, "wederspannigheid"],
  [/winkeldiefstal/, "winkeldiefstal"],
  [/inbraak|diefstal met braak|gekwalificeerde diefstal/, "diefstal_braak"],
  [/diefstal/, "diefstal"],
  [/oplichting|flessentrekkerij/, "oplichting"],
  [/verduistering/, "verduistering"],
  [/heling/, "heling"],
  [/vernieling|vernield/, "vernieling"],
  [/witwassen|fraude/, "fraude"],
  [/belediging|beledig/, "belediging"],
  [/belaging|stalking/, "belaging"],
  [/huisvredebreuk|lokaalvredebreuk/, "huisvredebreuk"],
  [/rijden onder invloed van (?:drugs|cannabis|cocaïne)|drugs in het verkeer/, "rijden_onder_invloed_drugs"],
  [/rijden onder invloed|alcohol(?:gehalte)?[^.]{0,40}(?:auto|rijden|bestuurd)|ademanalyse/, "rijden_onder_invloed_alcohol"],
  [/rijontzegging|tijdens (?:een )?ontzegging/, "rijden_tijdens_ontzegging"],
  [/zonder (?:geldig )?rijbewijs|ongeldig verklaard rijbewijs/, "rijden_zonder_rijbewijs"],
  [/doorrijden na|verlaten (?:van de )?plaats (?:van het )?ongeval/, "verlaten_plaats_ongeval"],
  [/verkeersongeval|aanrijding/, "verkeersongeval_letsel"],
  [/hennep|kwekerij/, "hennepteelt"],
  [/opiumwet|cocaïne|heroïne|xtc|mdma|amfetamine|drugs/, "opiumwet_overig"],
  [/wet wapens en munitie|wapenbezit|vuurwapen|\bwwm\b/, "wapenbezit"],
  [/valsheid in geschrift|vals(?:e)? (?:paspoort|document|identiteit)/, "valsheid_in_geschrift"],
  [/computervredebreuk|doxing|hack/, "cybercrime"],
  [/schennis|aanranding|ontucht|seksuele intimidatie/, "zeden"],
];
INH_MAP.push([/economische politierechter|milieu|dierenwelzijn|wet dieren|varken|dieren|arbo|arbeidsomstandigheden|vuurwerk|visserij|schelpdier|flora|fauna|natuurbescherming|meststof|asbest|omgevingswet|wet economische delicten/, "economisch"]);
function classifyInhoud(inh: string): string | null {
  for (const [re, code] of INH_MAP) if (re.test(inh)) return code;
  return null;
}
