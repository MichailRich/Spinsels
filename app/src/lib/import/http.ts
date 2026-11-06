// Beleefde HTTP-client: rate limiting per host, retries met exponentiële backoff,
// en een herkenbare User-Agent. Voorkomt onnodige externe aanroepen.

const lastCall = new Map<string, number>();
const USER_AGENT =
  process.env.IMPORT_USER_AGENT ?? "PolitierechterNL-onderzoeksimport/0.1 (+https://politierechter.nl/over)";

export async function politeFetch(
  url: string,
  init: RequestInit & { minIntervalMs?: number; retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const host = new URL(url).host;
  const minInterval = init.minIntervalMs ?? Number(process.env.IMPORT_MIN_INTERVAL_MS ?? 350);
  const retries = init.retries ?? 4;
  let attempt = 0;
  for (;;) {
    // rate limit (eenvoudige token-spacing per host)
    const now = Date.now();
    const next = (lastCall.get(host) ?? 0) + minInterval;
    lastCall.set(host, Math.max(now, next));
    if (next > now) await sleep(next - now);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 45_000);
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
      });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        throw new RetryableError(`HTTP ${res.status} voor ${url}`);
      }
      return res;
    } catch (e) {
      clearTimeout(t);
      attempt++;
      const retryable = e instanceof RetryableError || (e as Error).name === "AbortError" || (e as Error).name === "TypeError";
      if (!retryable || attempt > retries) throw e;
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
    }
  }
}

class RetryableError extends Error {}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Eenvoudige concurrency-pool */
export async function mapPool<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
