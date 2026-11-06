// Zet een Open Data Rechtspraak XML-document om naar (1) metadata, (2) platte tekst
// met behoud van alinea's en (3) een sectie-index met tekstoffsets. De platte tekst
// is de 'brontekst' waarnaar alle extracties met offsets verwijzen.

import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";

export type Section = { title: string; start: number; end: number; level: number };

export type ParsedDocument = {
  ecli: string;
  courtCode: string;
  courtName: string | null;
  decisionDate: string | null;
  publicationDate: string | null;
  modified: string | null;
  zaaknummer: string | null;
  procedure: string | null;
  subjects: string[];
  title: string | null;
  inhoudsindicatie: string | null;
  fullText: string;
  sections: Section[];
  contentHash: string;
  deeplink: string;
  hasDecisionText: boolean;
};

type Node = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: false,
  processEntities: true,
  htmlEntities: true,
});

const BLOCK = new Set([
  "para", "bridgehead", "title", "parablock", "paragroup", "listitem", "entry", "row",
  "blockquote", "footnote", "uitspraak.info", "conclusie.info", "address", "orderedlist", "itemizedlist", "table", "tgroup", "tbody",
]);
const SKIP = new Set(["imageobject", "mediaobject", "inlinemediaobject", "footnote-ref"]);

function tagOf(n: Node): string | null {
  for (const k of Object.keys(n)) if (k !== ":@") return k;
  return null;
}

function attr(n: Node, name: string): string | undefined {
  const a = n[":@"] as Record<string, string> | undefined;
  return a?.[`@${name}`];
}

function textOf(nodes: Node[]): string {
  let s = "";
  for (const n of nodes) {
    const t = tagOf(n);
    if (!t) continue;
    if (t === "#text") s += String(n[t]);
    else if (!SKIP.has(t)) s += " " + textOf(n[t] as Node[]) + " ";
  }
  return s;
}

function findFirst(nodes: Node[], tag: string): Node | undefined {
  for (const n of nodes) {
    const t = tagOf(n);
    if (!t || t === "#text") continue;
    if (t === tag || t.endsWith(":" + tag)) return n;
    const found = findFirst(n[t] as Node[], tag);
    if (found) return found;
  }
  return undefined;
}

function findAll(nodes: Node[], tag: string, out: Node[] = []): Node[] {
  for (const n of nodes) {
    const t = tagOf(n);
    if (!t || t === "#text") continue;
    if (t === tag || t.endsWith(":" + tag)) out.push(n);
    else findAll(n[t] as Node[], tag, out);
  }
  return out;
}

const clean = (s: string) =>
  s
    .replace(/ /g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ ([,.;:)])/g, "$1")
    .replace(/\( /g, "(")
    .trim();

/** Bouwt platte tekst met secties. */
class TextBuilder {
  text = "";
  sections: Section[] = [];
  private stack: { title: string; start: number; level: number }[] = [];
  private line = "";

  pushInline(s: string) {
    this.line += s;
  }
  flush() {
    const l = clean(this.line);
    this.line = "";
    if (l) this.text += l + "\n";
  }
  openSection(level: number) {
    this.flush();
    this.stack.push({ title: "", start: this.text.length, level });
  }
  setSectionTitle(title: string) {
    const top = this.stack[this.stack.length - 1];
    if (top && !top.title) top.title = clean(title);
  }
  closeSection() {
    this.flush();
    const top = this.stack.pop();
    if (top) this.sections.push({ title: top.title, start: top.start, end: this.text.length, level: top.level });
  }
}

function walk(nodes: Node[], b: TextBuilder, level: number) {
  for (const n of nodes) {
    const t = tagOf(n);
    if (!t) continue;
    if (t === "#text") {
      b.pushInline(String(n[t]));
      continue;
    }
    if (SKIP.has(t)) continue;
    const kids = n[t] as Node[];
    if (t === "section") {
      b.openSection(level + 1);
      const titleNode = kids.find((k) => tagOf(k) === "title");
      if (titleNode) b.setSectionTitle(textOf(titleNode.title as Node[]));
      walk(kids, b, level + 1);
      b.closeSection();
    } else if (t === "nr") {
      b.pushInline(textOf(kids) + " ");
    } else if (BLOCK.has(t)) {
      b.flush();
      walk(kids, b, level);
      b.flush();
    } else {
      b.pushInline(" ");
      walk(kids, b, level);
      b.pushInline(" ");
    }
  }
}

export function parseRechtspraakXml(xml: string): ParsedDocument {
  const doc = parser.parse(xml) as Node[];
  const meta = (key: string): string | null => {
    const n = findFirst(doc, key);
    if (!n) return null;
    const t = tagOf(n)!;
    return clean(textOf(n[t] as Node[])) || null;
  };
  const ecli = meta("dcterms:identifier") ?? "";
  const creator = findFirst(doc, "dcterms:creator");
  const creatorId = creator ? attr(creator, "resourceIdentifier") : undefined;
  const subjects = findAll(doc, "dcterms:subject").map((n) => clean(textOf(n[tagOf(n)!] as Node[])));

  // Datums staan in meerdere rdf:Description-blokken; de eerste is die van het document.
  const issued = meta("dcterms:issued");
  const date = meta("dcterms:date");
  const modified = meta("dcterms:modified");

  const inh = findFirst(doc, "inhoudsindicatie");
  const inhoud = inh ? clean(textOf(inh.inhoudsindicatie as Node[])) : null;

  const uitspraak = findFirst(doc, "uitspraak") ?? findFirst(doc, "conclusie");
  const b = new TextBuilder();
  if (uitspraak) walk(uitspraak[tagOf(uitspraak)!] as Node[], b, 0);
  b.flush();
  const fullText = b.text.replace(/\n{3,}/g, "\n\n");

  const titleNode = findAll(doc, "dcterms:title")[0];
  return {
    ecli,
    courtCode: ecli.split(":")[2] ?? "",
    courtName: creator ? clean(textOf(creator[tagOf(creator)!] as Node[])) : creatorId ?? null,
    decisionDate: date,
    publicationDate: issued,
    modified,
    zaaknummer: meta("psi:zaaknummer"),
    procedure: meta("psi:procedure"),
    subjects,
    title: titleNode ? clean(textOf(titleNode[tagOf(titleNode)!] as Node[])) : null,
    inhoudsindicatie: inhoud && inhoud !== "-" ? inhoud : null,
    fullText,
    sections: b.sections.sort((x, y) => x.start - y.start),
    contentHash: createHash("sha256").update(fullText).digest("hex"),
    deeplink: `https://uitspraken.rechtspraak.nl/details?id=${encodeURIComponent(ecli)}`,
    hasDecisionText: fullText.length > 200,
  };
}

/**
 * Herkent of het een vonnis van de politierechter is. Uitsluitend op basis van
 * de tekst zelf (kop van het vonnis), met de gevonden passage als bewijs.
 */
export function detectPolitierechter(p: ParsedDocument): { is: boolean; evidence: string | null; confidence: number } {
  const head = p.fullText.slice(0, 2500);
  const lower = head.toLowerCase();
  if (/kinderrechter|meervoudige (?:straf)?kamer|meervoudige economische kamer/.test(lower)) {
    return { is: false, evidence: null, confidence: 0.9 };
  }
  // Geen vonnis in een strafzaak: wraking, verschoning, raadkamer, beklag, beschikkingen
  if (/wraking|verschoning|raadkamer|beklag|klaagschrift|beschikking|rekest|bezwaarschrift|ontnemingsvordering/.test(lower.slice(0, 1200))) {
    return { is: false, evidence: null, confidence: 0.85 };
  }
  const body0 = p.fullText.toLowerCase();
  if (!/vonnis|veroordeelt|spreekt (?:de )?verdachte .{0,40}vrij|verklaart .{0,80}bewezen|ontslaat .{0,40}rechtsvervolging/.test(body0)) {
    return { is: false, evidence: null, confidence: 0.7 };
  }
  const line = head.split("\n").find((l) => /politierechter/i.test(l));
  if (line) return { is: true, evidence: line.trim(), confidence: 0.95 };

  // Oudere/verkorte vonnissen: kop zonder vermelding, maar beslissing door 'de politierechter'
  const body = p.fullText.toLowerCase();
  const pr = (body.match(/\bde politierechter\b/g) ?? []).length;
  const rb = (body.match(/\bde rechtbank\b/g) ?? []).length;
  if (pr >= 3 && pr > rb && !/hof|gerechtshof/.test(lower.slice(0, 300))) {
    const idx = body.search(/de politierechter (?:veroordeelt|verklaart|acht|is van oordeel|legt)/);
    const ev = idx >= 0 ? p.fullText.slice(idx, idx + 160).split("\n")[0] : null;
    return { is: true, evidence: ev, confidence: 0.7 };
  }
  return { is: false, evidence: null, confidence: 0.6 };
}
