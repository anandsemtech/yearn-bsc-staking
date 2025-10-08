// src/hooks/useHonoraryNft.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";

/* ---------------------
   Types
---------------------- */
type BadgeConfig = {
  address: Address;
  label?: string;              // e.g., "YearnChamp", "YearnBuddy"
  tokenId?: bigint;            // defaults to 0n
  imageOverride?: string | null;
};

type UseHonoraryArgs =
  | {
      // Back-compat (single)
      owner?: Address | null;
      contract?: Address;
      tokenIdForImage?: bigint;
      imageOverride?: string | null;
    }
  | {
      // Multi-badge mode
      owner?: Address | null;
      contracts: BadgeConfig[];
    };

export type HonoraryBadge = {
  address: Address;
  label: string;
  owned: boolean;
  imageUrl: string | null;
  tokenId: bigint;
};

type UseHonoraryReturn = {
  badges: HonoraryBadge[];
  show: boolean;
  loading: boolean;
  error: string | null;
  dismiss: () => void; // hide for now (this session)
  dontAskAgain: (scope?: "all" | Address[]) => void; // persist preference
  reset: () => void; // clear local state and cache keys for current owner
};

/* ---------------------
   ABI / Constants
---------------------- */
const ERC721_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
] as const;

const IPFS_GATEWAYS = [
  "https://w3s.link",
  "https://cloudflare-ipfs.com",
  "https://ipfs.io",
  "https://gateway.pinata.cloud",
];

const DEFAULT_IMAGE = "/images/YearnChamp.gif";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/* ---------------------
   IPFS helpers
---------------------- */
function ipfsToHttp(url?: string, gateway = IPFS_GATEWAYS[0]): string | null {
  if (!url) return null;
  if (!url.startsWith("ipfs://")) return url;
  const path = url.replace(/^ipfs:\/\//, "").replace(/^ipfs\//, "");
  return `${gateway}/ipfs/${path}`;
}

async function fetchWithGateways(ipfsUri: string) {
  let lastErr: any;
  for (const gw of IPFS_GATEWAYS) {
    try {
      const url = ipfsToHttp(ipfsUri, gw)!;
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) return { res, url };
      lastErr = new Error(`Gateway ${gw} bad status ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function resolveImageFromTokenUri(tokenUri: string): Promise<string | null> {
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(tokenUri);
  if (isImage) return tokenUri.startsWith("ipfs://") ? ipfsToHttp(tokenUri) : tokenUri;

  // data: JSON
  if (tokenUri.startsWith("data:application/json")) {
    try {
      const base64 = tokenUri.split(",")[1] || "";
      const json = JSON.parse(atob(base64));
      const img = json?.image as string | undefined;
      if (!img) return null;
      return img.startsWith("ipfs://") ? ipfsToHttp(img) : img;
    } catch {
      return null;
    }
  }

  // ipfs:// JSON
  if (tokenUri.startsWith("ipfs://")) {
    try {
      const { res, url } = await fetchWithGateways(tokenUri);
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const json = await res.json();
        const img = json?.image as string | undefined;
        if (!img) return null;
        return img.startsWith("ipfs://") ? ipfsToHttp(img, new URL(url).origin) : img;
      }
      if (ctype.startsWith("image/")) return url;
    } catch {
      return null;
    }
  }

  // http(s)
  if (/^https?:\/\//i.test(tokenUri)) {
    try {
      const res = await fetch(tokenUri, { mode: "cors" });
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const json = await res.json();
        const img = json?.image as string | undefined;
        if (!img) return null;
        return img.startsWith("ipfs://") ? ipfsToHttp(img) : img;
      }
      if (ctype.startsWith("image/")) return tokenUri;
    } catch {
      return null;
    }
  }

  return null;
}

/* ---------------------
   localStorage cache & prefs
---------------------- */
const cacheKey = (chainId: number | undefined, addr: Address, tokenId: bigint) =>
  `honNft:cache:v1:${chainId ?? 0}:${addr.toLowerCase()}:${tokenId.toString()}`;

const prefsKey = (owner: Address | null | undefined, chainId: number | undefined) =>
  `honNft:prefs:v1:${(owner ?? "").toLowerCase()}@${chainId ?? 0}`;

// image cache get/set
function getCachedImage(chainId: number | undefined, addr: Address, tokenId: bigint): string | null {
  try {
    const raw = localStorage.getItem(cacheKey(chainId, addr, tokenId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url: string; ts: number };
    if (!parsed?.url || !parsed?.ts) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.url;
  } catch {
    return null;
  }
}

function setCachedImage(chainId: number | undefined, addr: Address, tokenId: bigint, url: string) {
  try {
    localStorage.setItem(
      cacheKey(chainId, addr, tokenId),
      JSON.stringify({ url, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

// prefs get/set
type Prefs = {
  dontAskAll?: boolean;
  dontAskByAddr?: Record<string, boolean>;
};

function getPrefs(owner: Address | null | undefined, chainId: number | undefined): Prefs {
  try {
    const raw = localStorage.getItem(prefsKey(owner ?? null, chainId));
    if (!raw) return { dontAskAll: false, dontAskByAddr: {} };
    const p = JSON.parse(raw);
    return {
      dontAskAll: Boolean(p?.dontAskAll),
      dontAskByAddr: typeof p?.dontAskByAddr === "object" ? p.dontAskByAddr : {},
    };
  } catch {
    return { dontAskAll: false, dontAskByAddr: {} };
  }
}

function setPrefs(owner: Address | null | undefined, chainId: number | undefined, next: Prefs) {
  try {
    localStorage.setItem(prefsKey(owner ?? null, chainId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

/* ---------------------
   Hook
---------------------- */
export function useHonoraryNft(args: UseHonoraryArgs): UseHonoraryReturn {
  const { chainId } = useAccount();
  const publicClient = usePublicClient();

  // Normalize config to multi-badge list (back-compat)
  const config: BadgeConfig[] = useMemo(() => {
    if ("contracts" in args && Array.isArray(args.contracts)) {
      return args.contracts.map((c) => ({
        address: c.address,
        label: c.label ?? c.address.slice(0, 10),
        tokenId: c.tokenId ?? 0n,
        imageOverride: c.imageOverride ?? DEFAULT_IMAGE,
      }));
    }
    const single = args as any;
    if (single?.contract) {
      return [
        {
          address: single.contract as Address,
          label: "Honorary",
          tokenId: (single.tokenIdForImage as bigint) ?? 0n,
          imageOverride: (single.imageOverride as string) ?? DEFAULT_IMAGE,
        },
      ];
    }
    return [];
  }, [args]);

  const owner = ("owner" in args ? args.owner : (args as any)?.owner) ?? null;

  const [badges, setBadges] = useState<HonoraryBadge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI visibility
  const [show, setShow] = useState(false);

  const checkKey = useMemo(() => {
    const parts = [owner ?? "", chainId ?? 0, ...config.map((c) => c.address.toLowerCase())];
    return parts.join("|");
  }, [owner, chainId, config]);

  const lastCheckedRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef({ aborted: false });

  const dismiss = () => setShow(false);

  const dontAskAgain = (scope: "all" | Address[] = "all") => {
    const curr = getPrefs(owner, chainId);
    if (scope === "all") {
      setPrefs(owner, chainId, { ...curr, dontAskAll: true });
      setShow(false);
      return;
    }
    const map = { ...(curr.dontAskByAddr ?? {}) };
    for (const a of scope) map[a.toLowerCase()] = true;
    setPrefs(owner, chainId, { ...curr, dontAskByAddr: map });
    setShow(false);
  };

  const reset = () => {
    setBadges([]);
    setShow(false);
    setError(null);
    lastCheckedRef.current = null;
    // Note: we do NOT clear localStorage caches/prefs here;
    // if you want to force-clear cache, do it manually in DevTools.
  };

  // Preload images for smooth UX
  useEffect(() => {
    badges.forEach((b) => {
      if (b.imageUrl) {
        const img = new Image();
        img.src = b.imageUrl;
      }
    });
  }, [badges]);

  useEffect(() => {
    abortRef.current = { aborted: false };

    if (!publicClient || !owner || !chainId || config.length === 0) {
      setBadges([]);
      setShow(false);
      return;
    }

    if (lastCheckedRef.current === checkKey || inFlightRef.current) return;

    (async () => {
      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const prefs = getPrefs(owner, chainId);

        // 1) Query balances for all contracts
        const results: HonoraryBadge[] = [];
        for (const c of config) {
          const balance = (await publicClient.readContract({
            address: c.address,
            abi: ERC721_ABI,
            functionName: "balanceOf",
            args: [owner],
          })) as bigint;

          const owned = balance > 0n;

          // Resolve image (use cache then network)
          let imageUrl: string | null =
            getCachedImage(chainId, c.address, c.tokenId ?? 0n) || c.imageOverride || DEFAULT_IMAGE;

          if (owned) {
            try {
              const tokenUri = (await publicClient.readContract({
                address: c.address,
                abi: ERC721_ABI,
                functionName: "tokenURI",
                args: [c.tokenId ?? 0n],
              })) as string;

              if (tokenUri) {
                const img = await resolveImageFromTokenUri(tokenUri);
                if (img) {
                  imageUrl = img;
                  setCachedImage(chainId, c.address, c.tokenId ?? 0n, img);
                }
              }
            } catch {
              // ignore; keep imageUrl from cache/override
            }
          }

          results.push({
            address: c.address,
            label: c.label || c.address.slice(0, 10),
            owned,
            imageUrl,
            tokenId: c.tokenId ?? 0n,
          });
        }

        if (abortRef.current.aborted) return;

        setBadges(results);

        // 2) Decide whether to show popup:
        // show if user owns at least one badge AND not globally muted AND the owned badge(s) aren’t muted per-address
        const ownedAddrs = results.filter((r) => r.owned).map((r) => r.address.toLowerCase());
        const isOwnerOfAny = ownedAddrs.length > 0;

        let visible = false;
        if (isOwnerOfAny && !prefs.dontAskAll) {
          const mutedMap = prefs.dontAskByAddr ?? {};
          const anyUnmuted = ownedAddrs.some((a) => !mutedMap[a]);
          visible = anyUnmuted;
        }

        setShow(visible);
        lastCheckedRef.current = checkKey;
      } catch (e: any) {
        if (!abortRef.current.aborted) {
          setError(e?.shortMessage || e?.message || "Honorary NFT check failed");
          setBadges([]);
          setShow(false);
        }
      } finally {
        if (!abortRef.current.aborted) setLoading(false);
        inFlightRef.current = false;
      }
    })();

    return () => {
      abortRef.current.aborted = true;
    };
  }, [publicClient, owner, chainId, config, checkKey]);

  return { badges, show, loading, error, dismiss, dontAskAgain, reset };
}
