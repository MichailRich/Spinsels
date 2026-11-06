import { Vergelijker } from "./Vergelijker";
import { filterOptions } from "@/lib/options";

export const metadata = { title: "Strafvergelijker — Vergelijk mijn zaak" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ecli?: string }> }) {
  const { ecli } = await searchParams;
  return (
    <div className="container-x py-8">
      <div className="mb-6 max-w-3xl">
        <div className="label">Strafvergelijker</div>
        <h1 className="h-display mt-1 text-3xl sm:text-4xl">Vergelijk mijn zaak</h1>
        <p className="mt-2 text-[var(--ink-2)]">Beschrijf een casus in gewone taal. Het platform herkent mogelijke strafbare feiten en relevante omstandigheden, signaleert ontbrekende gegevens en zoekt vergelijkbare gepubliceerde politierechteruitspraken — met een transparante vergelijkbaarheidsscore. Dit is geen juridisch advies.</p>
      </div>
      <Vergelijker options={filterOptions()} initialEcli={ecli} />
    </div>
  );
}
