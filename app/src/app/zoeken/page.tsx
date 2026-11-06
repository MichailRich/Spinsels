import { SearchClient } from "./SearchClient";
import { filterOptions } from "@/lib/options";
import { parseFilters } from "@/lib/filters";
import { interpret } from "@/lib/search/nlq";

export const metadata = { title: "Zoeken" };

export default async function ZoekPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const nl = typeof sp.nl === "string" ? sp.nl : "";
  const interp = nl ? interpret(nl) : null;
  const filters = interp ? interp.filters : parseFilters(sp);
  return <SearchClient initialFilters={filters} notes={interp?.notes ?? []} question={nl} options={filterOptions()} />;
}
