import { q } from "./db";
import { buildWhere, FROM, type Filters } from "./filters";

/** Maakt meldingen aan voor bewaarde zoekopdrachten met nieuwe overeenkomende uitspraken. */
export async function runAlerts() {
  const searches = await q<{ id: number; user_id: number; name: string; query: Filters; last_checked_at: string }>("SELECT id, user_id, name, query, last_checked_at FROM saved_searches WHERE alert");
  let created = 0;
  for (const s of searches) {
    const { where, params } = buildWhere(s.query);
    params.push(s.last_checked_at);
    const rows = await q<{ ecli: string }>(`SELECT d.ecli FROM ${FROM} WHERE ${where} AND d.fetched_at > $${params.length} ORDER BY d.decision_date DESC LIMIT 50`, params);
    for (const r of rows) {
      await q("INSERT INTO notifications (user_id, saved_search_id, ecli, message) VALUES ($1,$2,$3,$4)", [s.user_id, s.id, r.ecli, `Nieuwe uitspraak voor “${s.name}”: ${r.ecli}`]);
      created++;
    }
    await q("UPDATE saved_searches SET last_checked_at=now() WHERE id=$1", [s.id]);
  }
  return { searches: searches.length, created };
}
