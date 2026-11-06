// AI-laag (retrieval-augmented): Claude krijgt uitsluitend de relevante bronpassages
// en moet letterlijk citeren. Iedere citaat wordt daarna tegen de brontekst gecontroleerd;
// niet-terug te vinden citaten en niet-aangeleverde ECLI's worden verwijderd.
// Zonder ANTHROPIC_API_KEY (of ander geldig credential) valt het platform terug op de
// regelgebaseerde analyse.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { q, q1 } from "../db";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const PROMPT_VERSION = "2026-11-v1";

export function aiEnabled() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

const SYSTEM = `Je bent een zorgvuldige Nederlandse strafrechtjurist die politierechtervonnissen analyseert voor een onderzoeksplatform.
Regels:
- Gebruik uitsluitend de aangeleverde bronpassages. Verzin nooit uitspraken, ECLI-nummers, citaten, wetsartikelen of strafhoogtes.
- Ieder citaat moet letterlijk (woord voor woord) uit de aangeleverde tekst komen.
- Verwar de eis van de officier van justitie nooit met de opgelegde straf.
- Leid niets af uit het ontbreken van informatie (bv. geen 'blanco strafblad' als de documentatie niet wordt genoemd); zeg dan expliciet dat de informatie ontbreekt.
- Maak onderscheid tussen vaststaande gegevens uit de uitspraak, je eigen interpretatie en statistische observaties.
- Schrijf in helder Nederlands voor juristen én geïnteresseerde leken.`;

function norm(s: string) {
  return s.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();
}

async function callJson<T>(user: string, schema: Record<string, unknown>): Promise<T> {
  const res = await getClient().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("Het model heeft deze analyse geweigerd.");
  if (res.stop_reason === "max_tokens") throw new Error("Analyse afgebroken (maximale lengte bereikt).");
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as T;
}

// ------------------------------------------------------------------ Waarom deze straf?
export type WhyOutput = {
  samenvatting: string;
  factoren: { omschrijving: string; richting: "verzwarend" | "verminderend" | "neutraal"; citaat: string; geverifieerd?: boolean }[];
  ontbrekende_informatie: string[];
};

const WHY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["samenvatting", "factoren", "ontbrekende_informatie"],
  properties: {
    samenvatting: { type: "string", description: "Begrijpelijke samenvatting (max. 120 woorden) van waarom de politierechter deze straf oplegde." },
    factoren: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["omschrijving", "richting", "citaat"],
        properties: {
          omschrijving: { type: "string" },
          richting: { type: "string", enum: ["verzwarend", "verminderend", "neutraal"] },
          citaat: { type: "string", description: "Letterlijk citaat uit de strafmotivering" },
        },
      },
    },
    ontbrekende_informatie: { type: "array", items: { type: "string" } },
  },
};

export async function whyThisSentence(input: { ecli: string; fullText: string; motivation: string; sentence: string; eis: string | null }) {
  const hash = createHash("sha256").update(PROMPT_VERSION + AI_MODEL + input.motivation + input.sentence + (input.eis ?? "")).digest("hex");
  const cached = await q1<{ output: WhyOutput; quotes_verified: boolean; model: string; created_at: string }>(
    "SELECT output, quotes_verified, model, to_char(created_at,'YYYY-MM-DD') AS created_at FROM ai_analyses WHERE ecli=$1 AND kind='waarom_deze_straf' AND input_hash=$2",
    [input.ecli, hash],
  );
  if (cached) return cached;
  const out = await callJson<WhyOutput>(
    `ECLI: ${input.ecli}
Opgelegde straf (geëxtraheerd): ${input.sentence}
Eis officier van justitie (geëxtraheerd): ${input.eis ?? "niet vermeld"}

<strafmotivering>
${input.motivation.slice(0, 12000)}
</strafmotivering>

Leg uit waarom de politierechter deze straf heeft opgelegd. Noem alleen factoren die in de strafmotivering staan, elk met een letterlijk citaat.`,
    WHY_SCHEMA,
  );
  const hay = norm(input.fullText);
  out.factoren = out.factoren.map((f) => ({ ...f, geverifieerd: f.citaat.length > 8 && hay.includes(norm(f.citaat)) })).filter((f) => f.geverifieerd);
  const verified = true;
  await q(
    "INSERT INTO ai_analyses (ecli, kind, model, prompt_version, input_hash, output, quotes_verified) VALUES ($1,'waarom_deze_straf',$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
    [input.ecli, AI_MODEL, PROMPT_VERSION, hash, JSON.stringify(out), verified],
  );
  return { output: out, quotes_verified: verified, model: AI_MODEL, created_at: new Date().toISOString().slice(0, 10) };
}

// ------------------------------------------------------------------ casusanalyse
export type CaseAnalysis = {
  mogelijke_feiten: { delict: string; wetsartikel: string; toelichting: string }[];
  ontbrekende_gegevens: string[];
  vergelijking: string;
  strafindicatie: { mogelijk: boolean; indicatie: string; onderbouwing: string; ecli_verwijzingen: string[] };
  voorbehoud: string;
};

const CASE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mogelijke_feiten", "ontbrekende_gegevens", "vergelijking", "strafindicatie", "voorbehoud"],
  properties: {
    mogelijke_feiten: { type: "array", items: { type: "object", additionalProperties: false, required: ["delict", "wetsartikel", "toelichting"], properties: { delict: { type: "string" }, wetsartikel: { type: "string" }, toelichting: { type: "string" } } } },
    ontbrekende_gegevens: { type: "array", items: { type: "string" } },
    vergelijking: { type: "string", description: "Analyse van overeenkomsten en verschillen met de aangeleverde uitspraken, met ECLI-verwijzingen" },
    strafindicatie: {
      type: "object", additionalProperties: false, required: ["mogelijk", "indicatie", "onderbouwing", "ecli_verwijzingen"],
      properties: { mogelijk: { type: "boolean" }, indicatie: { type: "string" }, onderbouwing: { type: "string" }, ecli_verwijzingen: { type: "array", items: { type: "string" } } },
    },
    voorbehoud: { type: "string" },
  },
};

export async function analyzeCase(caseText: string, similar: { ecli: string; summary: string; sentence: string; motivation: string }[], stats: string) {
  const allowed = new Set(similar.map((s) => s.ecli));
  const out = await callJson<CaseAnalysis>(
    `Casus van de gebruiker:
<casus>${caseText.slice(0, 4000)}</casus>

Vergelijkbare gepubliceerde politierechteruitspraken uit de databank (de ENIGE uitspraken die je mag noemen):
${similar.map((s) => `<uitspraak ecli="${s.ecli}">\nSamenvatting: ${s.summary}\nOpgelegde straf: ${s.sentence}\nStrafmotivering (fragment): ${s.motivation.slice(0, 1500)}\n</uitspraak>`).join("\n")}

Statistische observaties uit de databank: ${stats}

Opdracht: herken mogelijke strafbare feiten (met wetsartikel), signaleer ontbrekende juridisch relevante gegevens, vergelijk met de aangeleverde uitspraken en geef alleen een strafindicatie als de gegevens dat toelaten. Gepubliceerde uitspraken zijn geen representatieve steekproef; vermeld dat in het voorbehoud.`,
    CASE_SCHEMA,
  );
  out.strafindicatie.ecli_verwijzingen = out.strafindicatie.ecli_verwijzingen.filter((e) => allowed.has(e));
  // verwijder niet-aangeleverde ECLI's uit vrije tekst
  const scrub = (t: string) => t.replace(/ECLI:NL:[A-Z]{2,6}:\d{4}:[A-Z0-9]+/g, (m) => (allowed.has(m) ? m : "[niet-geverifieerde verwijzing verwijderd]"));
  out.vergelijking = scrub(out.vergelijking);
  out.strafindicatie.onderbouwing = scrub(out.strafindicatie.onderbouwing);
  return out;
}
