// src/lib/subgraph.ts
// Minimal GraphQL client: token-bucket rate limit, backoff+failover, LRU cache, in-flight dedupe.

const STUDIO_URL: string = (import.meta.env.VITE_SUBGRAPH_YEARN ?? "") as string;

// Optional Graph Gateway (drop-in failover)
const GATEWAY_KEY  = import.meta.env.VITE_GRAPH_API_KEY as string | undefined;
const GATEWAY_ID   = import.meta.env.VITE_GRAPH_SUBGRAPH_ID as string | undefined;
const GATEWAY_NAME = import.meta.env.VITE_GRAPH_SUBGRAPH_NAME as string | undefined;

const gatewayById   = (GATEWAY_KEY && GATEWAY_ID)
  ? `https://gateway.thegraph.com/api/${GATEWAY_KEY}/subgraphs/id/${GATEWAY_ID}`
  : undefined;

const gatewayByName = (GATEWAY_KEY && GATEWAY_NAME)
  ? `https://gateway.thegraph.com/api/${GATEWAY_KEY}/subgraphs/name/${GATEWAY_NAME}`
  : undefined;

// Build endpoint list without any undefined/null types
const ENDPOINTS: string[] = [];
if (STUDIO_URL)     ENDPOINTS.push(STUDIO_URL);
if (gatewayById)    ENDPOINTS.push(gatewayById);
if (gatewayByName)  ENDPOINTS.push(gatewayByName);

let endpointIndex = 0;
function currentUrl(): string | null {
  if (ENDPOINTS.length === 0) return null;
  return ENDPOINTS[endpointIndex % ENDPOINTS.length];
}
function nextEndpoint() {
  if (ENDPOINTS.length > 1) endpointIndex = (endpointIndex + 1) % ENDPOINTS.length;
}

function currentUrlStrict(): string {
  const u = currentUrl();
  if (!u) throw new Error("No subgraph endpoint configured. Set VITE_SUBGRAPH_YEARN.");
  return u;
}

// DX-only tag
export const gql = (strings: TemplateStringsArray, ...values: any[]) =>
  strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ""), "");

// Token bucket (avg 4 rps, burst 6)
const MAX_TOKENS = 6;
const REFILL_PER_MS = 4 / 1000;
let tokens = MAX_TOKENS, lastRefill = Date.now();
function refill() {
  const now = Date.now();
  tokens = Math.min(MAX_TOKENS, tokens + (now - lastRefill) * REFILL_PER_MS);
  lastRefill = now;
}
async function takeToken() {
  for (;;) { refill(); if (tokens >= 1) { tokens -= 1; return; } await new Promise(r => setTimeout(r, 60)); }
}

// In-flight dedupe
type Key = string;
const inFlight = new Map<Key, Promise<any>>();

// LRU cache
const CACHE_MAX = 250;
const DEFAULT_TTL = 30_000;
const cache = new Map<Key, { ts: number; ttl: number; data: any }>();
function lruGet(key: Key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > hit.ttl) { cache.delete(key); return null; }
  // refresh LRU order
  cache.delete(key); cache.set(key, hit);
  return hit.data;
}
function lruSet(key: Key, data: any, ttl: number) {
  cache.set(key, { ts: Date.now(), ttl, data });
  if (cache.size > CACHE_MAX) {
    const first = cache.keys().next();
    if (!first.done) {
      cache.delete(first.value as Key);
    }
  }
}


// Errors
class HttpError extends Error { status: number; body?: string; constructor(status: number, body?: string) { super(`HTTP ${status}`); this.status = status; this.body = body; } }
class GraphQLError extends Error { errors: unknown; constructor(errors: unknown) { super("GraphQL Error"); this.errors = errors; } }

function stable(obj: any) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

async function doFetch<T>(url: string, query: string, variables?: Record<string, any>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text().catch(() => undefined));
  const json = await res.json();
  if (json?.errors) throw new GraphQLError(json.errors);
  return json.data as T;
}

async function withBackoff<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? 0;
      const transient = status === 429 || (status >= 500 && status < 600);
      if (!transient) break;
      nextEndpoint();
      const base = 400 * (2 ** i), jitter = Math.floor(Math.random() * 200);
      await new Promise(r => setTimeout(r, base + jitter));
    }
  }
  throw lastErr;
}

/** Public API */
export async function subgraphRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  ttlMs = DEFAULT_TTL
): Promise<T> {
  // use a definite string for the cache key
  const endpointForKey = currentUrlStrict();
  const key = `${endpointForKey}|${query}|${stable(variables ?? {})}`;

  if (ttlMs > 0) {
    const hit = lruGet(key);
    if (hit) return hit as T;
  }

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    await takeToken();
    // IMPORTANT: call currentUrlStrict() INSIDE the retry closure so failover works
    const res = await withBackoff<T>(() => doFetch<T>(currentUrlStrict(), query, variables));
    if (ttlMs > 0) lruSet(key, res, ttlMs);
    return res;
  })();

  inFlight.set(key, p);
  try { return await p; } finally { inFlight.delete(key); }
}


// Compatibility shim
export const subgraph = {
  request: <T = any>(query: string, variables?: Record<string, any>) =>
    subgraphRequest<T>(query, variables),
};
