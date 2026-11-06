import Link from "next/link";
import { categoryCounts } from "@/lib/search/query";
import { OFFENSE_BY_CODE } from "@/lib/reference/offenses";
import { articleLabel } from "@/lib/reference/articles";
import { fmtNum } from "@/lib/labels";

export const metadata = { title: "Strafbare feiten" };
export const dynamic = "force-dynamic";

export default async function DelictenPage() {
  const cats = await categoryCounts();
  const groups = [...new Set(cats.map((c) => c.group_label))];
  return (
    <div className="container-x py-8">
      <div className="label">Classificatie</div>
      <h1 className="h-display mt-1 text-3xl sm:text-4xl">Strafbare feiten</h1>
      <p className="mt-2 max-w-3xl text-[var(--ink-2)]">Iedere uitspraak is geclassificeerd op basis van de juridische kwalificatie van het bewezenverklaarde (en bij vrijspraak de tenlastelegging), gekoppeld aan de toegepaste wetsartikelen. Tussen haakjes: zaken waarin uitsluitend dit delict is bewezen.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g} className="card card-pad">
            <h2 className="font-serif text-xl text-navy">{g}</h2>
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {cats.filter((c) => c.group_label === g).map((c) => (
                <li key={c.code}>
                  <Link href={`/delicten/${c.code}`} className="flex items-start justify-between gap-3 py-2.5 hover:bg-mist">
                    <span>
                      <span className="text-sm text-navy">{c.label}</span>
                      <span className="block text-[11px] text-[var(--ink-3)]">{OFFENSE_BY_CODE.get(c.code)?.articles.map(articleLabel).join(", ")}</span>
                    </span>
                    <span className="whitespace-nowrap text-sm tabular-nums text-[var(--ink-2)]">{fmtNum(c.n)} <span className="text-[var(--ink-3)]">({fmtNum(c.n_single)})</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
