// Achtergrondworker: verwerkt de PostgreSQL-wachtrij (FOR UPDATE SKIP LOCKED) en plant
// periodiek de incrementele synchronisatie. Herstartbaar: alle status staat in de database.
import { q, getPool } from "../src/lib/db";
import { discoverViaSearch, discoverViaOpenData, fetchPending } from "../src/lib/import/pipeline";
import { extractAll } from "../src/lib/extract/run";
import { runAlerts } from "../src/lib/alerts";
import { enqueue } from "../src/lib/admin";

const SYNC_EVERY_MS = Number(process.env.SYNC_INTERVAL_HOURS ?? 6) * 3600_000;
const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);

async function enabled(code: string) {
  const r = await q<{ enabled: boolean }>("SELECT enabled FROM sources WHERE code=$1", [code]);
  return r[0]?.enabled !== false;
}

const HANDLERS: Record<string, () => Promise<unknown>> = {
  discover: async () => {
    if (await enabled("rechtspraak-zoekdienst")) await discoverViaSearch({ log });
    if (await enabled("rechtspraak-open-data")) await discoverViaOpenData({ log });
    await enqueue("fetch", {}, "auto:fetch");
  },
  fetch: async () => {
    if (!(await enabled("rechtspraak-open-data"))) return log("bron uitgeschakeld");
    await fetchPending({ log });
    await enqueue("extract", {}, "auto:extract");
  },
  extract: async () => {
    await extractAll({ onlyMissing: true, log });
    await enqueue("alerts", {}, "auto:alerts");
  },
  extract_all: () => extractAll({ onlyMissing: false, log }),
  alerts: async () => log(`meldingen: ${JSON.stringify(await runAlerts())}`),
};

async function pick() {
  const r = await q<{ id: string; type: string; attempts: number; max_attempts: number }>(
    `UPDATE jobs SET status='running', locked_at=now(), attempts=attempts+1 WHERE id = (
       SELECT id FROM jobs WHERE (status='queued' OR (status='running' AND locked_at < now() - interval '2 hours')) AND run_after <= now()
       ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id, type, attempts, max_attempts`,
  );
  return r[0];
}

async function main() {
  log("worker gestart");
  let lastSync = 0;
  const once = process.argv.includes("--once");
  for (;;) {
    if (!once && Date.now() - lastSync > SYNC_EVERY_MS) {
      await enqueue("discover", {}, "auto:discover");
      lastSync = Date.now();
    }
    const job = await pick();
    if (!job) {
      if (once) break;
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    log(`job ${job.id} (${job.type}) start`);
    try {
      await HANDLERS[job.type]?.();
      await q("UPDATE jobs SET status='done', finished_at=now(), last_error=NULL WHERE id=$1", [job.id]);
      log(`job ${job.id} klaar`);
    } catch (e) {
      const failed = job.attempts >= job.max_attempts;
      await q(`UPDATE jobs SET status=$2, last_error=$3, run_after=now() + ($4 || ' minutes')::interval WHERE id=$1`, [job.id, failed ? "failed" : "queued", String(e).slice(0, 1000), String(2 ** job.attempts)]);
      log(`job ${job.id} mislukt (${failed ? "definitief" : "wordt opnieuw geprobeerd"}): ${e}`);
    }
  }
  await getPool().end();
}
main();
