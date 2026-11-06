import Link from "next/link";
import { searchCases } from "@/lib/search/query";
import { CaseList } from "@/components/CaseList";

export const metadata = { title: "Recente uitspraken" };
export const dynamic = "force-dynamic";

export default async function Recent({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Number((await searchParams).page ?? 1) || 1;
  const { rows, total } = await searchCases({}, { page, pageSize: 25, sort: "datum" });
  const pages = Math.ceil(total / 25);
  return (
    <div className="container-x max-w-4xl py-8">
      <h1 className="h-display text-3xl sm:text-4xl">Recente uitspraken</h1>
      <p className="mt-2 text-[var(--ink-2)]">De meest recente gepubliceerde politierechteruitspraken, gesorteerd op uitspraakdatum. Nieuwe publicaties worden automatisch geïmporteerd.</p>
      <div className="card card-pad mt-6"><CaseList rows={rows} /></div>
      <div className="mt-4 flex justify-center gap-2 text-sm">
        {page > 1 && <Link className="btn-ghost" href={`/uitspraken?page=${page - 1}`}>Vorige</Link>}
        <span className="px-3 py-2 text-[var(--ink-2)]">Pagina {page} van {pages}</span>
        {page < pages && <Link className="btn-ghost" href={`/uitspraken?page=${page + 1}`}>Volgende</Link>}
      </div>
    </div>
  );
}
