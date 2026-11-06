// Eenvoudige in-memory rate limiter per IP (per proces). Voor meerdere instanties: vervang door Redis/PG.
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(req: Request, key: string, perHour: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.reset < now) {
    buckets.set(k, { n: 1, reset: now + 3600_000 });
    return true;
  }
  b.n++;
  return b.n <= perHour;
}
