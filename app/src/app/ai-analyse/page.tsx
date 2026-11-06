import { AiAnalyse } from "./AiAnalyse";
import { aiEnabled } from "@/lib/ai/claude";
import { OFFENSES } from "@/lib/reference/offenses";

export const metadata = { title: "AI-casusanalyse" };

export default async function Page({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const { text } = await searchParams;
  return (
    <div className="container-x py-8">
      <div className="mb-6 max-w-3xl">
        <div className="label">AI-casusanalyse</div>
        <h1 className="h-display mt-1 text-3xl sm:text-4xl">Juridische analyse van een casus</h1>
        <p className="mt-2 text-[var(--ink-2)]">De AI krijgt uitsluitend vergelijkbare uitspraken uit deze databank, de statistiek daarover en het letterlijke LOVS-oriëntatiepunt aangereikt (retrieval-augmented generation). Iedere conclusie verwijst naar controleerbare bronnen; het platform verwijdert automatisch verwijzingen naar uitspraken die niet zijn aangeleverd.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="badge-fact">Vaststaande gegevens uit uitspraken</span><span className="badge-ai">AI-interpretatie</span><span className="badge-stat">Statistische observatie</span><span className="badge-est">Juridische inschatting</span></div>
      </div>
      <AiAnalyse initial={text ?? ""} labels={Object.fromEntries(OFFENSES.map((o) => [o.code, o.label]))} enabled={aiEnabled()} />
    </div>
  );
}
