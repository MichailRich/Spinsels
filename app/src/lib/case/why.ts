// Regelgebaseerde 'Waarom deze straf?'-samenvatting: uitsluitend opgebouwd uit
// geëxtraheerde gegevens; iedere bewering is herleidbaar tot een getoonde passage.
import type { LoadedCase } from "./load";
import { CIRCUMSTANCES } from "../extract/circumstances";
import { offenseLabel } from "../reference/offenses";
import { OUTCOME_LABEL, RECIDIVE_LABEL } from "../labels";

export function ruleBasedWhy(c: LoadedCase): string[] {
  const p = c.profile;
  if (!p) return ["Voor deze uitspraak is nog geen analyse beschikbaar."];
  const out: string[] = [];
  const feit = p.categories.length ? p.categories.map(offenseLabel).join(", ").toLowerCase() : "het bewezenverklaarde";
  if (p.outcome === "veroordeling") {
    out.push(`De politierechter veroordeelde voor ${feit} tot: ${p.sentence_summary}.`);
    if (p.eis_summary) out.push(`De officier van justitie had gevorderd: ${p.eis_summary}.`);
    else out.push("De eis van de officier van justitie staat niet (herkenbaar) in de gepubliceerde uitspraak.");
  } else {
    out.push(`Uitkomst: ${OUTCOME_LABEL[p.outcome] ?? p.outcome}.`);
  }
  if (p.multi_offense) out.push("Er zijn meerdere feiten bewezen verklaard; de straf is voor deze feiten gezamenlijk opgelegd en kan niet aan één afzonderlijk feit worden toegeschreven.");
  const weighed = c.circumstances.filter((x) => x.status === "meegewogen");
  const up = [...new Set(weighed.filter((x) => x.polarity === "verzwarend").map((x) => CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label.toLowerCase()))];
  const down = [...new Set(weighed.filter((x) => x.polarity === "verminderend").map((x) => CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label.toLowerCase()))];
  if (up.length) out.push(`In de strafmotivering weegt de politierechter in het nadeel van verdachte: ${up.join(", ")}.`);
  if (down.length) out.push(`In het voordeel van verdachte worden genoemd: ${down.join(", ")}.`);
  if (!up.length && !down.length) out.push("In de strafmotivering zijn geen specifieke verzwarende of verminderende omstandigheden automatisch herkend. Lees de motivering hieronder.");
  out.push(`Justitiële documentatie: ${RECIDIVE_LABEL[p.recidive]}.`);
  return out;
}
