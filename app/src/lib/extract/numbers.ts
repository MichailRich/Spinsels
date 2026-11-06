// Nederlandse telwoorden, duren en bedragen.

const UNITS: Record<string, number> = {
  nul: 0, een: 1, één: 1, eén: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9,
  tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17,
  achttien: 18, negentien: 19,
};
const TENS: Record<string, number> = {
  twintig: 20, dertig: 30, veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80, negentig: 90,
};

/** Parse een Nederlands telwoord (bv. 'honderdtwintig', 'vierentwintig', 'tweehonderd'). */
export function parseDutchNumber(word: string): number | null {
  const w = word.toLowerCase().replace(/[\s-]/g, "").replace(/ë/g, "e").replace(/é/g, "e");
  if (!w) return null;
  if (/^\d+$/.test(w)) return Number(w);
  const thousand = w.indexOf("duizend");
  if (thousand >= 0) {
    const pre = w.slice(0, thousand);
    const post = w.slice(thousand + 7);
    const a = pre ? parseDutchNumber(pre) : 1;
    const b = post ? parseDutchNumber(post) : 0;
    return a === null || b === null ? null : a * 1000 + b;
  }
  const hundred = w.indexOf("honderd");
  if (hundred >= 0) {
    const pre = w.slice(0, hundred);
    const post = w.slice(hundred + 7);
    const a = pre ? parseDutchNumber(pre) : 1;
    const b = post ? parseDutchNumber(post) : 0;
    return a === null || b === null ? null : a * 100 + b;
  }
  if (w in UNITS) return UNITS[w];
  if (w in TENS) return TENS[w];
  const m = w.match(/^(een|twee|drie|vier|vijf|zes|zeven|acht|negen)en(twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig)$/);
  if (m) return UNITS[m[1]] + TENS[m[2]];
  return null;
}

export const DURATION_UNIT = "(uur|uren|dag|dagen|week|weken|maand|maanden|jaar|jaren)";
const NUMWORD = "[a-zëéè]+";

/**
 * Duur, met cijfers en/of woorden: '60 (zestig) uren', 'twee weken', '3 maanden'.
 * Groep 1: getal, groep 2: telwoord tussen haakjes, groep 3: telwoord zonder cijfer, groep 4: eenheid
 */
export const DURATION_RE = new RegExp(
  `(?:(\\d+(?:[.,]5)?)\\s*(?:[(\\[](${NUMWORD}(?:[ -]${NUMWORD})?)[)\\]]\\s*)?|(${NUMWORD})\\s+)${DURATION_UNIT}\\b`,
  "gi",
);

export type Duration = { value: number; unit: "uren" | "dagen" | "weken" | "maanden" | "jaren"; index: number; length: number; raw: string };

export function findDurations(s: string): Duration[] {
  const out: Duration[] = [];
  const re = new RegExp(DURATION_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let value: number | null = null;
    if (m[1]) value = Number(m[1].replace(",", "."));
    else if (m[3]) value = parseDutchNumber(m[3]);
    if (value === null || !isFinite(value)) continue;
    const u = m[4].toLowerCase();
    const unit = u.startsWith("uur") || u.startsWith("uren") ? "uren" : u.startsWith("dag") ? "dagen" : u.startsWith("we") ? "weken" : u.startsWith("maand") ? "maanden" : "jaren";
    out.push({ value, unit, index: m.index, length: m[0].length, raw: m[0] });
  }
  return out;
}

/** Normaliseer naar dagen (conventie: week = 7, maand = 30, jaar = 365 dagen). */
export function toDays(d: Pick<Duration, "value" | "unit">): number {
  switch (d.unit) {
    case "dagen": return d.value;
    case "weken": return d.value * 7;
    case "maanden": return d.value * 30;
    case "jaren": return d.value * 365;
    default: return d.value / 24;
  }
}
export function toMonths(d: Pick<Duration, "value" | "unit">): number {
  switch (d.unit) {
    case "dagen": return Math.round((d.value / 30) * 10) / 10;
    case "weken": return Math.round(((d.value * 7) / 30) * 10) / 10;
    case "maanden": return d.value;
    case "jaren": return d.value * 12;
    default: return 0;
  }
}

/** Bedragen: '€ 1.250,00', 'EUR 500', '350 euro'. */
export const AMOUNT_RE = /(?:€|eur(?:o)?\.?)\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2}|,-)?|\d+(?:,\d{1,2})?)|(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:euro|eur)\b/gi;

export function findAmounts(s: string): { value: number; index: number; length: number }[] {
  const out: { value: number; index: number; length: number }[] = [];
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const raw = (m[1] ?? m[2] ?? "").replace(/[.\s]/g, "").replace(",-", "").replace(",", ".");
    const v = Number(raw);
    if (isFinite(v) && v > 0) out.push({ value: v, index: m.index, length: m[0].length });
  }
  return out;
}

export function formatDuration(days: number): string {
  if (days >= 365 && days % 365 === 0) return `${days / 365} jaar`;
  if (days >= 30 && days % 30 === 0) return `${days / 30} ${days / 30 === 1 ? "maand" : "maanden"}`;
  if (days >= 7 && days % 7 === 0) return `${days / 7} ${days / 7 === 1 ? "week" : "weken"}`;
  return `${Math.round(days * 10) / 10} ${days === 1 ? "dag" : "dagen"}`;
}

export function formatEuro(v: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
}
