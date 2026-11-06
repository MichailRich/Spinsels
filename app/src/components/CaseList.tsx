import Link from "next/link";
import type { CaseRow } from "@/lib/search/query";
import { offenseLabel } from "@/lib/reference/offenses";
import { RECIDIVE_LABEL, LETSEL_LABEL, OUTCOME_LABEL, fmtDate } from "@/lib/labels";

export function CaseList({ rows, compact = false }: { rows: CaseRow[]; compact?: boolean }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-[var(--ink-3)]">Geen uitspraken gevonden met deze criteria.</p>;
  return (
    <ul className="divide-y divide-[var(--line)]">
      {rows.map((r) => (
        <li key={r.ecli} className="group py-4 first:pt-0 last:pb-0">
          <Link href={`/uitspraak/${encodeURIComponent(r.ecli)}`} className="block">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="font-medium text-navy group-hover:underline">{r.categories.length ? r.categories.map(offenseLabel).join(" · ") : "Delict niet automatisch geclassificeerd"}</div>
              <div className="text-xs text-[var(--ink-3)]">{r.court_name.replace("Rechtbank ", "Rb. ")} · {fmtDate(r.decision_date)}</div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-navy">{r.outcome === "veroordeling" ? r.sentence_summary : OUTCOME_LABEL[r.outcome] ?? r.outcome}</span>
              {r.eis_summary && <span className="text-[var(--ink-3)]">Eis OM: {r.eis_summary}</span>}
            </div>
            {!compact && (
              <>
                {r.snippet ? (
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--ink-2)]" dangerouslySetInnerHTML={{ __html: sanitize(r.snippet) }} />
                ) : r.inhoudsindicatie ? (
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--ink-2)]">{r.inhoudsindicatie}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="badge-fact font-mono">{r.ecli}</span>
                  {r.recidive !== "onbekend" && <span className="badge-fact">{RECIDIVE_LABEL[r.recidive]}</span>}
                  {r.letsel !== "onbekend" && r.letsel !== "nvt" && <span className="badge-fact">{LETSEL_LABEL[r.letsel]}</span>}
                  {r.bekentenis === "bekend" && <span className="badge-fact">Bekend</span>}
                  {r.multi_offense && <span className="badge bg-amber-50 text-amber-800">Meerdere feiten — straf gezamenlijk</span>}
                  {r.review_status !== "auto" && <span className="badge-stat">Geverifieerd</span>}
                </div>
              </>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ts_headline levert alleen <mark>-tags; overige HTML wordt geneutraliseerd
function sanitize(s: string) {
  return s.replace(/</g, "&lt;").replace(/&lt;mark>/g, "<mark>").replace(/&lt;\/mark>/g, "</mark>");
}
