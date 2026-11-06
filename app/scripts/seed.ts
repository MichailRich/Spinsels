// Maakt het beheerdersaccount aan (ADMIN_EMAIL / ADMIN_PASSWORD) en laadt de
// meegeleverde dataset (data/seed/documents.jsonl.gz) als de databank nog leeg is.
import { q, getPool } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { importSeed } from "./seed-data";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const pw = process.env.ADMIN_PASSWORD;
  if (email && pw) {
    await q(
      "INSERT INTO users (email, name, password_hash, role) VALUES ($1,'Beheerder',$2,'admin') ON CONFLICT (email) DO UPDATE SET role='admin', password_hash=EXCLUDED.password_hash",
      [email.toLowerCase(), hashPassword(pw)],
    );
    console.log("beheerder:", email);
  } else console.log("ADMIN_EMAIL/ADMIN_PASSWORD niet gezet — geen beheerder aangemaakt");
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int AS n FROM documents");
  if (n === 0 || process.argv.includes("--data")) await importSeed();
  await getPool().end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
