import { StatsDashboard } from "@/components/StatsDashboard";
import { filterOptions } from "@/lib/options";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Grafieken & statistieken" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = parseFilters(await searchParams);
  return (
    <div className="container-x py-8">
      <div className="mb-6 max-w-3xl">
        <div className="label">Strafdashboard</div>
        <h1 className="h-display mt-1 text-3xl sm:text-4xl">Grafieken &amp; statistieken</h1>
        <p className="mt-2 text-[var(--ink-2)]">Alle grafieken zijn live gekoppeld aan de databank en reageren direct op de filters. Klik door op een balk, cel of stip om de onderliggende uitspraken te lezen.</p>
      </div>
      <StatsDashboard initial={f} options={filterOptions()} />
    </div>
  );
}
