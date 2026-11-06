// Extractie van strafcomponenten (opgelegde straf én eis OM) uit een tekstspan.
// Iedere component bevat de letterlijke bronzin en de offsets in de brontekst.

import { findAmounts, findDurations, toDays, toMonths, type Duration } from "./numbers";
import { sentences, type Sentence } from "./text";

export type SanctionKind =
  | "taakstraf"
  | "gevangenisstraf"
  | "hechtenis"
  | "geldboete"
  | "ontzegging"
  | "schadevergoedingsmaatregel"
  | "vordering_benadeelde"
  | "bijzondere_voorwaarden"
  | "schuldigverklaring_zonder_straf"
  | "tul_eerder"
  | "overig";

export type Component = {
  kind: SanctionKind;
  amount: number | null;
  unit: "uren" | "dagen" | "euro" | "maanden" | null;
  conditional: boolean;
  probationMonths: number | null;
  substituteDays: number | null;
  description: string;
  evidence: string;
  evidenceStart: number;
  evidenceEnd: number;
  confidence: number;
};

export const KIND_LABEL: Record<SanctionKind, string> = {
  taakstraf: "Taakstraf",
  gevangenisstraf: "Gevangenisstraf",
  hechtenis: "Hechtenis",
  geldboete: "Geldboete",
  ontzegging: "Ontzegging rijbevoegdheid",
  schadevergoedingsmaatregel: "Schadevergoedingsmaatregel",
  vordering_benadeelde: "Toegewezen vordering benadeelde partij",
  bijzondere_voorwaarden: "Bijzondere voorwaarden",
  schuldigverklaring_zonder_straf: "Schuldigverklaring zonder straf (art. 9a Sr)",
  tul_eerder: "Tenuitvoerlegging eerder opgelegde straf",
  overig: "Overige straf/maatregel",
};

const COND_RE = /voorwaardelijk|niet (?:zal worden )?ten ?uitvoer|niet zal worden tenuitvoergelegd|tenzij de rechter later anders/;
const PROEFTIJD_RE = /proeftijd[^.;\d]{0,30}?((?:\d+\s*(?:[(\[][a-zë ]+[)\]]\s*)?|[a-zë]+\s+)(?:jaar|jaren|maand|maanden))/;
const SUBST_RE = /(?:vervangende hechtenis|subsidiair|bij gebreke van (?:volledige )?betaling|te vervangen door|vervangen door)[^;]{0,90}?(\d+\s*(?:[(\[][a-zë ]+[)\]]\s*)?|[a-zë]+\s+)(dag|dagen|week|weken|maand|maanden)/;

const KEYWORDS: [SanctionKind, RegExp][] = [
  ["taakstraf", /taakstraf|werkstraf|dienstverlening|leerstraf/],
  ["gevangenisstraf", /gevangenisstraf/],
  ["hechtenis", /hechtenis/],
  ["geldboete", /geldboete/],
  ["ontzegging", /ontzegging|ontzegt|bevoegdheid (?:om )?motorrijtuigen/],
  ["schadevergoedingsmaatregel", /schadevergoedingsmaatregel|verplichting (?:op )?(?:om )?(?:aan de staat|ten behoeve van)|betalingsverplichting/],
  ["vordering_benadeelde", /benadeelde partij/],
  ["bijzondere_voorwaarden", /bijzondere voorwaarde|meldplicht|contactverbod|locatieverbod|enkelband|elektronische monitoring|ambulante behandeling|klinische opname/],
  ["schuldigverklaring_zonder_straf", /zonder (?:oplegging van )?(?:straf|enige straf)|artikel 9a/],
  ["overig", /onttrekking aan het verkeer|verbeurd|gedragsaanwijzing|vrijheidsbeperkende maatregel|artikel 38v|stelselmatige daders|terbeschikkingstelling|ontneming|jeugddetentie|plaatsing in een inrichting/],
];

/** Maskeert bijzinnen die geen hoofdstraf zijn (vervangende hechtenis, proeftijd, voorarrest). */
function mask(s: string): string {
  const blank = (m: string) => " ".repeat(m.length);
  return s
    .replace(/vervangende hechtenis[^;,]{0,60}/g, blank)
    .replace(/subsidiair[^;,]{0,40}hechtenis/g, blank)
    .replace(/(?:bij gebreke van (?:volledige )?betaling|te vervangen door|vervangen door)[^;,]{0,80}/g, blank)
    .replace(/voorlopige hechtenis/g, blank)
    .replace(/(?:in )?(?:verzekering|voorarrest)[^;,]{0,40}/g, blank)
    .replace(/proeftijd[^;,]{0,50}/g, blank);
}

type Chunk = { text: string; start: number; kind: SanctionKind };

/** Splitst een zin in deelzinnen per strafsoort (bv. 'taakstraf van 60 uren en een voorwaardelijke gevangenisstraf van 2 weken'). */
function chunks(sentence: string): Chunk[] {
  const lower = sentence.toLowerCase();
  const masked = mask(lower);
  const hits: { idx: number; kind: SanctionKind }[] = [];
  for (const [kind, re] of KEYWORDS) {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(masked))) hits.push({ idx: m.index, kind });
  }
  hits.sort((a, b) => a.idx - b.idx);
  // dubbele treffers samenvoegen (bv. 'ontzegging' + 'motorrijtuigen' in dezelfde deelzin)
  const merged: typeof hits = [];
  for (const h of hits) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === h.kind) continue;
    if (prev && h.idx - prev.idx < 25 && !/,| en |;/.test(masked.slice(prev.idx, h.idx))) continue;
    merged.push(h);
  }
  if (!merged.length) return [];
  const out: Chunk[] = [];
  for (let i = 0; i < merged.length; i++) {
    // begin: laatste scheiding (komma, 'en', ';', '-', 'alsmede') vóór het trefwoord, na het vorige trefwoord
    const prevIdx = i === 0 ? 0 : merged[i - 1].idx;
    let start = i === 0 ? 0 : prevIdx;
    const seg = lower.slice(prevIdx, merged[i].idx);
    const sepRe = /(?:,|;| en | alsmede | met daarnaast | - |\s–\s)/g;
    let m: RegExpExecArray | null;
    let lastSep = -1;
    while ((m = sepRe.exec(seg))) lastSep = m.index + m[0].length;
    if (i > 0 && lastSep >= 0) start = prevIdx + lastSep;
    if (i > 0 && lastSep < 0) start = merged[i].idx;
    out.push({ text: "", start, kind: merged[i].kind });
  }
  for (let i = 0; i < out.length; i++) {
    const end = i + 1 < out.length ? out[i + 1].start : sentence.length;
    out[i].text = sentence.slice(out[i].start, end);
  }
  // eerste deelzin mag de aanloop ('veroordeelt verdachte tot ...') bevatten
  return out;
}

function firstMainDuration(chunk: string, allowHours: boolean): Duration | undefined {
  const masked = mask(chunk.toLowerCase());
  return findDurations(masked).find((d) => (allowHours ? d.unit === "uren" : d.unit !== "uren"));
}

function probation(s: string): number | null {
  const m = s.toLowerCase().match(PROEFTIJD_RE);
  if (!m) return null;
  const d = findDurations(m[1])[0];
  return d ? toMonths(d) : null;
}

function substitute(s: string): number | null {
  const m = s.toLowerCase().match(SUBST_RE);
  if (!m) return null;
  const d = findDurations(`${m[1]}${m[2]}`)[0];
  return d ? toDays(d) : null;
}

/** 'waarvan 2 weken voorwaardelijk' / 'waarvan € 250 voorwaardelijk' */
function waarvan(s: string): { duration?: Duration; amount?: number } | null {
  const l = s.toLowerCase();
  let m = l.match(/waarvan\s+([^;]{1,80}?)\s+voorwaardelijk/);
  if (!m && COND_RE.test(l)) m = l.match(/(?:een )?(?:gedeelte|deel)(?:,)?\s+(?:groot|van|ter grootte van)\s+([^,;]{1,50})/);
  if (!m) return null;
  const d = findDurations(m[1])[0];
  if (d) return { duration: d };
  const a = findAmounts(m[1])[0];
  return a ? { amount: a.value } : null;
}

export function extractSanctions(text: string, base: number, opts: { origin: "opgelegd" | "eis_om" }): Component[] {
  const comps: Component[] = [];
  const sents = sentences(text, base);
  const pendingProbation: Component[] = [];
  for (const sent of sents) handleSentence(sent, comps, pendingProbation, opts.origin);
  return dedupe(comps);
}

function handleSentence(sent: Sentence, comps: Component[], pendingProbation: Component[], origin: "opgelegd" | "eis_om") {
  const s = sent.text;
  const lower = s.toLowerCase();
  const ev = { evidence: s, evidenceStart: sent.start, evidenceEnd: sent.end };
  if (/medeverdachte/.test(lower)) return;
  // aftrek voorarrest / tijd in verzekering: geen zelfstandige straf
  if (/in mindering|voorarrest|in verzekering (?:heeft )?doorgebracht|voorlopige hechtenis heeft doorgebracht|voor (?:elke|iedere) dag/.test(lower) && !/(?:taakstraf|werkstraf|gevangenisstraf|geldboete|hechtenis)\s+(?:van|voor de duur|gedurende)\s+\d/.test(lower)) return;
  // wijziging of opheffing van eerder opgelegde voorwaarden
  if (/wijzigt|vervallen|heft op|opheffing|verlengt de proeftijd|wijst de vordering tot tenuitvoerlegging af/.test(lower) && !/veroordeelt/.test(lower)) return;

  // Tenuitvoerlegging van een eerder (voorwaardelijk) opgelegde straf: geen straf in deze zaak
  if (/tenuitvoerlegging|ten uitvoer (?:te )?(?:leggen|wordt gelegd)|vordering tot (?:tul|tenuitvoer)/.test(lower) &&
      /(?:eerder|bij (?:vonnis|strafbeschikking|arrest)|parketnummer|destijds|opgelegd(?:e)? (?:bij|door))/.test(lower) &&
      !/bepaalt dat .{0,60}niet/.test(lower)) {
    if (origin === "opgelegd" && /gelast|beveelt|wijst toe/.test(lower)) {
      comps.push({ kind: "tul_eerder", amount: null, unit: null, conditional: false, probationMonths: null, substituteDays: null,
        description: "Tenuitvoerlegging van een eerder voorwaardelijk opgelegde straf (telt niet mee in de strafstatistiek)", confidence: 0.6, ...ev });
    }
    return;
  }

  // 'bepaalt dat (een gedeelte van) de gevangenisstraf ... niet ten uitvoer zal worden gelegd'
  const definite = /(?:van|dat) (?:de|deze|die) (?:gevangenisstraf|taakstraf|werkstraf|geldboete|straf|ontzegging)/.test(lower);
  if ((/bepaalt dat|met bevel dat|zal een (?:gedeelte|deel)|van de (?:gevangenis|taak|werk)?straf(?:,)? (?:zal|wordt)|(?:deze|die) (?:gevangenis|taak|werk)?straf (?:zal|wordt)/.test(lower) || definite) && COND_RE.test(lower) &&
      (definite || !/(?:een|tot) (?:taakstraf|werkstraf|gevangenisstraf|geldboete) (?:van|voor de duur)/.test(lower)) && !/veroordeelt/.test(lower)) {
    const targetKind: SanctionKind[] = /taakstraf|werkstraf|dienstverlening/.test(lower) ? ["taakstraf"] : /geldboete/.test(lower) ? ["geldboete"] : /ontzegging/.test(lower) ? ["ontzegging"] : ["gevangenisstraf", "hechtenis"];
    const target = [...comps].reverse().find((c) => targetKind.includes(c.kind) && !c.conditional);
    if (target) {
      const part = lower.match(/(?:gedeelte|deel)[^,]{0,30},?\s*groot\s+([^,;]{1,50})/) ?? lower.match(/(?:gedeelte|deel) (?:van|ter grootte van)\s+([^,;]{1,50})/);
      const pd = part ? findDurations(part[1])[0] : undefined;
      const pa = part ? findAmounts(part[1])[0] : undefined;
      if (part && (pd || pa) && target.amount) {
        const partVal = pd ? (target.unit === "dagen" ? toDays(pd) : target.unit === "maanden" ? toMonths(pd) : pd.value) : pa!.value;
        if (partVal < target.amount) {
          const cond: Component = { ...target, amount: partVal, conditional: true, description: `${KIND_LABEL[target.kind]} (voorwaardelijk deel)`, ...ev, confidence: 0.85 };
          target.amount = round(target.amount - partVal);
          target.description = `${KIND_LABEL[target.kind]} (onvoorwaardelijk deel)`;
          comps.push(cond);
          pendingProbation.push(cond);
        } else {
          target.conditional = true;
          pendingProbation.push(target);
        }
      } else if (!part) {
        target.conditional = true;
        target.description = `${KIND_LABEL[target.kind]} (voorwaardelijk)`;
        pendingProbation.push(target);
      }
      const p = probation(lower);
      if (p) pendingProbation.forEach((c) => (c.probationMonths ??= p));
      return;
    }
  }

  const cs = chunks(s);
  if (!cs.length) {
    const p = probation(lower);
    if (p) {
      for (const c of pendingProbation) c.probationMonths ??= p;
      // ook laatste voorwaardelijke componenten zonder proeftijd
      comps.filter((c) => c.conditional && c.probationMonths == null).forEach((c) => (c.probationMonths = p));
    }
    return;
  }

  for (const ch of cs) {
    const cl = ch.text.toLowerCase();
    const absStart = sent.start + ch.start;
    const chunkEv = ev;
    const isCond = COND_RE.test(cl) && !/onvoorwaardelijk/.test(cl.replace(/waarvan.*$/, ""));
    const prob = probation(cl) ?? probation(lower);
    const subst = substitute(cl);
    const wv = waarvan(cl);
    void absStart;

    const push = (c: Omit<Component, "evidence" | "evidenceStart" | "evidenceEnd">) => {
      const comp = { ...c, ...chunkEv };
      comps.push(comp);
      if (comp.conditional && comp.probationMonths == null) pendingProbation.push(comp);
    };

    switch (ch.kind) {
      case "taakstraf": {
        const d = firstMainDuration(ch.text, true);
        if (!d) break;
        if (wv?.duration && wv.duration.unit === "uren" && wv.duration.value < d.value) {
          push({ kind: "taakstraf", amount: d.value - wv.duration.value, unit: "uren", conditional: false, probationMonths: null, substituteDays: subst, description: "Taakstraf (onvoorwaardelijk deel)", confidence: 0.85 });
          push({ kind: "taakstraf", amount: wv.duration.value, unit: "uren", conditional: true, probationMonths: prob, substituteDays: null, description: "Taakstraf (voorwaardelijk deel)", confidence: 0.85 });
        } else {
          push({ kind: "taakstraf", amount: d.value, unit: "uren", conditional: isCond, probationMonths: isCond ? prob : null, substituteDays: subst, description: isCond ? "Voorwaardelijke taakstraf" : "Taakstraf", confidence: 0.9 });
        }
        break;
      }
      case "gevangenisstraf":
      case "hechtenis": {
        const d = firstMainDuration(ch.text, false);
        if (!d) break;
        const days = toDays(d);
        if (wv?.duration) {
          const vd = toDays(wv.duration);
          if (vd < days) {
            push({ kind: ch.kind, amount: round(days - vd), unit: "dagen", conditional: false, probationMonths: null, substituteDays: null, description: `${KIND_LABEL[ch.kind]} (onvoorwaardelijk deel)`, confidence: 0.85 });
            push({ kind: ch.kind, amount: round(vd), unit: "dagen", conditional: true, probationMonths: prob, substituteDays: null, description: `${KIND_LABEL[ch.kind]} (voorwaardelijk deel)`, confidence: 0.85 });
            break;
          }
        }
        push({ kind: ch.kind, amount: round(days), unit: "dagen", conditional: isCond, probationMonths: isCond ? prob : null, substituteDays: null, description: isCond ? `Voorwaardelijke ${ch.kind}` : KIND_LABEL[ch.kind], confidence: 0.9 });
        break;
      }
      case "geldboete": {
        let a: { value: number } | undefined = findAmounts(ch.text)[0];
        if (!a) {
          const m = ch.text.match(/geldboete[^\d]{0,40}?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2})|,-)?/i);
          if (m) a = { value: Number(m[1].replace(/\./g, "")) + (m[2] ? Number(m[2]) / 100 : 0) };
        }
        if (!a) break;
        if (wv?.amount && wv.amount < a.value) {
          push({ kind: "geldboete", amount: a.value - wv.amount, unit: "euro", conditional: false, probationMonths: null, substituteDays: subst, description: "Geldboete (onvoorwaardelijk deel)", confidence: 0.85 });
          push({ kind: "geldboete", amount: wv.amount, unit: "euro", conditional: true, probationMonths: prob, substituteDays: null, description: "Geldboete (voorwaardelijk deel)", confidence: 0.85 });
        } else {
          push({ kind: "geldboete", amount: a.value, unit: "euro", conditional: isCond, probationMonths: isCond ? prob : null, substituteDays: subst, description: isCond ? "Voorwaardelijke geldboete" : "Geldboete", confidence: 0.9 });
        }
        break;
      }
      case "ontzegging": {
        const d = firstMainDuration(ch.text, false);
        if (!d) break;
        const months = toMonths(d);
        if (wv?.duration) {
          const vm = toMonths(wv.duration);
          if (vm < months) {
            push({ kind: "ontzegging", amount: round(months - vm), unit: "maanden", conditional: false, probationMonths: null, substituteDays: null, description: "Ontzegging rijbevoegdheid (onvoorwaardelijk deel)", confidence: 0.85 });
            push({ kind: "ontzegging", amount: round(vm), unit: "maanden", conditional: true, probationMonths: prob, substituteDays: null, description: "Ontzegging rijbevoegdheid (voorwaardelijk deel)", confidence: 0.85 });
            break;
          }
        }
        push({ kind: "ontzegging", amount: round(months), unit: "maanden", conditional: isCond, probationMonths: isCond ? prob : null, substituteDays: null, description: isCond ? "Voorwaardelijke ontzegging rijbevoegdheid" : "Ontzegging rijbevoegdheid", confidence: 0.85 });
        break;
      }
      case "schadevergoedingsmaatregel": {
        const a = findAmounts(ch.text)[0];
        if (!a && (/heft .{0,60}niet op|gijzeling/.test(cl) || !/legt|verplichting op/.test(lower))) break;
        push({ kind: "schadevergoedingsmaatregel", amount: a?.value ?? null, unit: a ? "euro" : null, conditional: false, probationMonths: null, substituteDays: subst, description: "Schadevergoedingsmaatregel (art. 36f Sr)", confidence: a ? 0.8 : 0.5 });
        break;
      }
      case "vordering_benadeelde": {
        if (!/toe(?:wijst|gewezen)|wijst .{0,60}toe|veroordeelt .{0,80}te betalen/.test(lower) || /niet[- ]ontvankelijk/.test(cl)) break;
        const a = findAmounts(ch.text)[0];
        if (!a) break;
        push({ kind: "vordering_benadeelde", amount: a.value, unit: "euro", conditional: false, probationMonths: null, substituteDays: null, description: "Vordering benadeelde partij (toegewezen)", confidence: 0.7 });
        break;
      }
      case "bijzondere_voorwaarden": {
        push({ kind: "bijzondere_voorwaarden", amount: null, unit: null, conditional: true, probationMonths: prob, substituteDays: null, description: describeConditions(cl), confidence: 0.7 });
        break;
      }
      case "schuldigverklaring_zonder_straf": {
        if (!/schuldig|9a/.test(lower)) break;
        push({ kind: "schuldigverklaring_zonder_straf", amount: null, unit: null, conditional: false, probationMonths: null, substituteDays: null, description: KIND_LABEL.schuldigverklaring_zonder_straf, confidence: 0.85 });
        break;
      }
      case "overig": {
        if (origin === "opgelegd" && /(?:legt|gelast|verklaart|beveelt|veroordeelt|onttrekt|ontneemt)/.test(lower) === false) break;
        push({ kind: "overig", amount: null, unit: null, conditional: false, probationMonths: null, substituteDays: null, description: describeOther(cl), confidence: 0.6 });
        break;
      }
    }
  }
  const p = probation(lower);
  if (p) pendingProbation.forEach((c) => (c.probationMonths ??= p));
}

function describeConditions(s: string): string {
  const parts: string[] = [];
  if (/meldplicht/.test(s)) parts.push("meldplicht reclassering");
  if (/contactverbod/.test(s)) parts.push("contactverbod");
  if (/locatieverbod|gebiedsverbod/.test(s)) parts.push("locatieverbod");
  if (/ambulante behandeling|behandeling/.test(s)) parts.push("behandeling");
  if (/klinische opname/.test(s)) parts.push("klinische opname");
  if (/enkelband|elektronische monitoring/.test(s)) parts.push("elektronische monitoring");
  if (/alcohol|drugs|middelengebruik/.test(s)) parts.push("verbod/controle middelengebruik");
  return parts.length ? `Bijzondere voorwaarden: ${parts.join(", ")}` : "Bijzondere voorwaarde(n)";
}

function describeOther(s: string): string {
  if (/onttrekking aan het verkeer/.test(s)) return "Onttrekking aan het verkeer";
  if (/verbeurd/.test(s)) return "Verbeurdverklaring";
  if (/gedragsaanwijzing|vrijheidsbeperkende maatregel|38v/.test(s)) return "Vrijheidsbeperkende maatregel (art. 38v Sr)";
  if (/stelselmatige daders/.test(s)) return "ISD-maatregel";
  if (/terbeschikkingstelling/.test(s)) return "Terbeschikkingstelling";
  if (/ontneming/.test(s)) return "Ontnemingsmaatregel";
  if (/jeugddetentie/.test(s)) return "Jeugddetentie (adolescentenstrafrecht)";
  return "Overige straf of maatregel";
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function dedupe(cs: Component[]): Component[] {
  const seen = new Set<string>();
  return cs.filter((c) => {
    const k = `${c.kind}|${c.amount}|${c.conditional}|${c.evidenceStart}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Korte leesbare samenvatting, bv. '60 uur taakstraf + 2 weken voorwaardelijke gevangenisstraf'. */
export function summarize(cs: Component[]): string {
  const parts: string[] = [];
  const bv = new Set<string>();
  for (const c of cs) {
    if (c.kind === "bijzondere_voorwaarden") {
      c.description.replace(/^Bijzondere voorwaarden?:?\s*|\(n\)$/gi, "").split(", ").filter(Boolean).forEach((x) => bv.add(x.toLowerCase()));
      continue;
    }
    if (c.kind === "tul_eerder") continue;
    const cond = c.conditional ? " voorwaardelijk" : "";
    switch (c.kind) {
      case "taakstraf": parts.push(`${fmt(c.amount)} uur taakstraf${cond}`); break;
      case "gevangenisstraf":
      case "hechtenis": parts.push(`${days(c.amount)} ${c.kind}${cond}`); break;
      case "geldboete": parts.push(`€ ${fmt(c.amount)} geldboete${cond}`); break;
      case "ontzegging": parts.push(`${fmt(c.amount)} mnd ontzegging${cond}`); break;
      case "schadevergoedingsmaatregel": parts.push(`schadevergoedingsmaatregel${c.amount ? ` € ${fmt(c.amount)}` : ""}`); break;
      case "vordering_benadeelde": parts.push(`vordering benadeelde € ${fmt(c.amount)}`); break;
      case "schuldigverklaring_zonder_straf": parts.push("schuldigverklaring zonder straf"); break;
      case "overig": parts.push(c.description.toLowerCase()); break;
    }
  }
  if (bv.size) parts.push(`bijzondere voorwaarden (${[...bv].join(", ") || "zie uitspraak"})`);
  return [...new Set(parts)].join(" + ");
}

function fmt(n: number | null) {
  return n == null ? "?" : new Intl.NumberFormat("nl-NL").format(n);
}
function days(n: number | null) {
  if (n == null) return "?";
  if (n >= 365 && n % 365 === 0) return `${n / 365} jaar`;
  if (n >= 30 && n % 30 === 0) return `${n / 30} mnd`;
  if (n >= 7 && n % 7 === 0) return `${n / 7} wk`;
  return `${fmt(n)} dagen`;
}
