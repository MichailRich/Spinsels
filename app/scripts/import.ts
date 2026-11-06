import { getPool } from "../src/lib/db";
import { discoverViaSearch, discoverViaOpenData, fetchPending } from "../src/lib/import/pipeline";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (n: string) => rest.includes(`--${n}`);
  const val = (n: string) => {
    const i = rest.indexOf(`--${n}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (cmd === "discover" || cmd === "all") {
    await discoverViaSearch({ full: flag("full"), maxPages: val("max-pages") ? Number(val("max-pages")) : undefined });
    if (!flag("no-opendata")) await discoverViaOpenData({ since: val("since") });
  }
  if (cmd === "fetch" || cmd === "all") {
    await fetchPending({ limit: val("limit") ? Number(val("limit")) : undefined, concurrency: Number(val("concurrency") ?? 3), refetch: flag("refetch") });
  }
  if (cmd === "extract" || cmd === "all") {
    const { extractAll } = await import("../src/lib/extract/run");
    await extractAll({ onlyMissing: !flag("force") });
  }
  await getPool().end();
}
main().catch(async (e) => {
  console.error(e);
  await getPool().end();
  process.exit(1);
});
