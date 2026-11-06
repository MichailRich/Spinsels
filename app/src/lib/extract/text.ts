// Hulpfuncties: secties herkennen, zinnen splitsen met offsets.

export type Section = { title: string; start: number; end: number; level: number };
export type Span = { start: number; end: number };
export type Sentence = { text: string; start: number; end: number };

export type SectionRole =
  | "tenlastelegging"
  | "bewijs"
  | "bewezenverklaring"
  | "kwalificatie"
  | "strafbaarheid_dader"
  | "straf"
  | "benadeelde"
  | "voorschriften"
  | "beslissing"
  | "voorvragen"
  | "beslag"
  | "vordering_tul"
  | "eis";

const ROLE_PATTERNS: [SectionRole, RegExp][] = [
  ["vordering_tul", /tenuitvoerlegging|vordering (?:tot )?(?:tul|tenuitvoer)|na voorwaardelijke veroordeling|beslissing op (?:de )?vordering|verlenging (?:van de )?proeftijd/i],
  ["eis", /(?:vordering|eis|standpunt) (?:van )?(?:de )?officier|officier van justitie|requisitoir/i],
  ["bewezenverklaring", /bewezenverklaring|bewezen ?verklaarde|bewezenverklaarde/i],
  ["tenlastelegging", /ten ?laste ?legging|tenlastelegging/i],
  ["bewijs", /bewijs|bewijsmiddelen|waardering/i],
  ["kwalificatie", /strafbaarheid van (?:het|de) (?:feit|bewezen)|kwalificatie|strafbare feiten|strafbaarheid feit|strafbaarheid van het tenlastegelegde/i],
  ["strafbaarheid_dader", /strafbaarheid van (?:de )?verdachte|strafbaarheid dader|strafbaarheid verdachte/i],
  ["benadeelde", /benadeelde partij|schadevergoeding|vordering benadeelde/i],
  ["straf", /\bstraf\b|straffen|strafoplegging|strafmotivering|strafmaat|oplegging|sanctie|maatregel|motivering|op te leggen/i],
  ["voorschriften", /wettelijke voorschriften|toegepaste (?:wets)?artikelen|toepasselijke/i],
  ["beslissing", /beslissing|uitspraak|beslist|dictum/i],
  ["voorvragen", /voorvragen|formele voorvragen|ontvankelijkheid/i],
  ["beslag", /beslag/i],
];

export function sectionRole(title: string): SectionRole | null {
  const t = title.replace(/^[\d.\s]+/, "");
  if (/^sector\b|strafrecht|parketn|rechtbank/i.test(t) && t.length < 80) return null;
  if (/strafbaarheid/i.test(t) && /verdachte|dader/i.test(t)) return "strafbaarheid_dader";
  if (/strafbaarheid/i.test(t) && /feit|bewezen|tenlaste|ten laste/i.test(t)) return "kwalificatie";
  for (const [role, re] of ROLE_PATTERNS) if (re.test(t)) return role;
  return null;
}

/**
 * Bepaalt per rol de tekstspan. Gebruikt de XML-secties (niveau 1); valt terug op
 * kopregels in de tekst voor documenten zonder sectie-opmaak.
 */
export function roleSpans(fullText: string, sections: Section[]): Map<SectionRole, Span[]> {
  const map = new Map<SectionRole, Span[]>();
  const add = (r: SectionRole, s: Span) => map.set(r, [...(map.get(r) ?? []), s]);
  const top = sections.filter((s) => s.level === Math.min(...sections.map((x) => x.level)));
  if (top.length >= 3) {
    for (const s of top) {
      const r = sectionRole(s.title);
      if (r) add(r, { start: s.start, end: s.end });
    }
  }
  if (map.size < 2) {
    // terugval: koppen als losse regels in hoofdletters of korte regels
    const lines = linesWithOffsets(fullText);
    const heads: { role: SectionRole; start: number }[] = [];
    for (const l of lines) {
      const t = l.text.trim();
      if (t.length > 70) continue;
      const looksHead = /^[\d.]*\s*[A-Z][A-Za-zë\s/,-]+$/.test(t) && (t === t.toUpperCase() || /^\d/.test(t) || t.split(" ").length <= 6);
      if (!looksHead) continue;
      const r = sectionRole(t);
      if (r) heads.push({ role: r, start: l.start });
    }
    for (let i = 0; i < heads.length; i++) {
      add(heads[i].role, { start: heads[i].start, end: i + 1 < heads.length ? heads[i + 1].start : fullText.length });
    }
  }
  return map;
}

export function linesWithOffsets(text: string): Sentence[] {
  const out: Sentence[] = [];
  let pos = 0;
  for (const line of text.split("\n")) {
    out.push({ text: line, start: pos, end: pos + line.length });
    pos += line.length + 1;
  }
  return out;
}

const ABBREV = /(?:\b(?:art|artt|mr|nr|jo|jo\.|o\.a|i\.c|e\.d|bijv|ca|resp|sr|sv|lid|vgl|blz|p|pag|dhr|mevr|mw|dr|ir|ing|bv|nv|st|ex|incl|excl|m\.n|d\.d|t\.a\.v|a\.s|e\.a|o\.g\.v|i\.v\.m|z\.g|c\.q|zgn|jl|ten|ivm|tav|tbs)|\b[A-Z]|\d)$/i;

/** Splits tekst in zinnen met absolute offsets (rekening houdend met afkortingen). */
export function sentences(text: string, base = 0): Sentence[] {
  const out: Sentence[] = [];
  for (const line of linesWithOffsets(text)) {
    if (!line.text.trim()) continue;
    let start = 0;
    const re = /[.;!?](?=\s+["“(]?[A-Z0-9\[])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.text))) {
      const before = line.text.slice(start, m.index);
      if (m[0] === "." && ABBREV.test(before)) continue;
      const seg = line.text.slice(start, m.index + 1);
      if (seg.trim()) out.push(mk(seg, base + line.start + start));
      start = m.index + 1;
    }
    const rest = line.text.slice(start);
    if (rest.trim()) out.push(mk(rest, base + line.start + start));
  }
  return out;
}

function mk(seg: string, abs: number): Sentence {
  const lead = seg.length - seg.trimStart().length;
  const t = seg.trim();
  return { text: t, start: abs + lead, end: abs + lead + t.length };
}

export function slice(text: string, s: Span | undefined): string {
  return s ? text.slice(s.start, s.end) : "";
}

export function inSpans(pos: number, spans: Span[] | undefined): boolean {
  return !!spans?.some((s) => pos >= s.start && pos < s.end);
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/** Detecteert ontkenning kort vóór een treffer ('niet eerder', 'nooit', 'geen'). */
export function negatedBefore(s: string, index: number, window = 45): boolean {
  let pre = s.slice(Math.max(0, index - window), index).toLowerCase();
  // alleen de lopende deelzin: ontkenning vóór een komma of 'en/maar' telt niet mee
  const cut = Math.max(pre.lastIndexOf(","), pre.lastIndexOf(";"), pre.lastIndexOf(" en "), pre.lastIndexOf(" maar "), pre.lastIndexOf(" doch "));
  if (cut >= 0) pre = pre.slice(cut + 1);
  return /\b(niet|nooit|geen|noch|zonder)\b[^.;]*$/.test(pre);
}
