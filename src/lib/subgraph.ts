// src/lib/subgraph.ts
import { GraphQLClient, gql as gqlTag } from "graphql-request";

/** ----- Endpoint resolution & failover ----- */
const STUDIO_URL = import.meta.env.VITE_SUBGRAPH_YEARN as string | undefined;

// Optional Graph Gateway (production) – just set envs, no code changes:
//   VITE_GRAPH_API_KEY=... (Gateway key)
//   VITE_GRAPH_SUBGRAPH_ID=...  (subgraph id)   OR   VITE_GRAPH_SUBGRAPH_NAME=org/name
const GATEWAY_KEY  = import.meta.env.VITE_GRAPH_API_KEY as string | undefined;
const GATEWAY_ID   = import.meta.env.VITE_GRAPH_SUBGRAPH_ID as string | undefined;
const GATEWAY_NAME = import.meta.env.VITE_GRAPH_SUBGRAPH_NAME as string | undefined;

const gatewayById   = GATEWAY_KEY && GATEWAY_ID   ? `https://gateway.thegraph.com/api/${GATEWAY_KEY}/subgraphs/id/${GATEWAY_ID}` : null;
const gatewayByName = GATEWAY_KEY && GATEWAY_NAME ? `https://gateway.thegraph.com/api/${GATEWAY_KEY}/subgraphs/name/${GATEWAY_NAME}` : null;

// Priority: Studio → Gateway by id → Gateway by name
const ENDPOINTS = [STUDIO_URL, gatewayById, gatewayByName].filter(Boolean) as string[];
if (ENDPOINTS.length === 0) {
  console.warn("[subgraph] No endpoint configured. Set VITE_SUBGRAPH_YEARN.");
}
let endpointIndex = 0;

function currentUrl() { return ENDPOINTS[Math.min(endpointIndex, ENDPOINTS.length - 1)]; }
function nextEndpoint() { if (ENDPOINTS.length > 1) endpointIndex = (endpointIndex + 1) % ENDPOINTS.length; }

function makeClient(url?: string) {
  return new GraphQLClient(url ?? "", { headers: {} });
}
let client = makeClient(currentUrl());

/** Export gql for callers */
export const gql = gqlTag;

/** ----- Token-bucket + in-flight coalescing + small LRU ----- */
const MAX_TOKENS = 6;                 // allow brief bursts up to 6
const REFILL_PER_MS = 4 / 1000;       // 4 req/s steady state
let tokens = MAX_TOKENS, lastRefill = Date.now();

type Key = string;
const inFlight = new Map<Key, Promise<any>>();

const CACHE_MAX = 250;
const CACHE_TTL_MS_DEFAULT = 30_000;
const cache = new Map<Key, { ts: number; data: any; ttl: number }>();

function lruGet(key: Key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > hit.ttl) { cache.delete(key); return null; }
  cache.delete(key); cache.set(key, hit); return hit.data;
}
function lruSet(key: Key, data: any, ttl: number) {
  cache.set(key, { ts: Date.now(), data, ttl });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}
function refill() {
  const now = Date.now(); const delta = now - lastRefill;
  tokens = Math.min(MAX_TOKENS, tokens + delta * REFILL_PER_MS); lastRefill = now;
}
async function takeToken() {
  for (;;) { refill(); if (tokens >= 1) { tokens -= 1; return; } await new Promise(r => setTimeout(r, 60)); }
}
function stable(obj: any) { return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v)); }

async function withBackoff<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status ?? 0;
      const transient = status === 429 || (status >= 500 && status < 600);
      if (!transient) break;
      // On hard 429/5xx, rotate endpoint (failover) next attempt
      nextEndpoint(); client = makeClient(currentUrl());
      const base = 400 * 2 ** i, jitter = Math.floor(Math.random() * 200);
      await new Promise(r => setTimeout(r, base + jitter));
    }
  }
  throw lastErr;
}

/**
 * subgraphRequest:
 * - dedupes identical in-flight queries
 * - token-bucket rate limits
 * - retries + endpoint failover on 429/5xx
 * - LRU cache on success (ttlMs)
 */
export async function subgraphRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  ttlMs = CACHE_TTL_MS_DEFAULT
): Promise<T> {
  const key = `${currentUrl()}|${query}|${stable(variables ?? {})}`;

  if (ttlMs > 0) {
    const cached = lruGet(key);
    if (cached) return cached as T;
  }

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    await takeToken();
    const run = () => client.request<T>(query, variables);
    const res = await withBackoff(run);
    if (ttlMs > 0) lruSet(key, res, ttlMs);
    return res;
  })();

  inFlight.set(key, p);
  try { return await p; } finally { inFlight.delete(key); }
}

/** Compatibility shim for components using `subgraph.request(query, vars)` */
export const subgraph = {
  request: <T = any>(query: string, variables?: Record<string, any>) =>
    subgraphRequest<T>(query, variables),
};
