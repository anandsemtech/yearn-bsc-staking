import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { createPublicClient, http } from "viem";
import { bsc } from "viem/chains";
import { YEARNPASS1155_ABI } from "@/lib/abi";

/** ─────────── ENV ─────────── */
const PASS_ADDRESS = (import.meta.env.VITE_PASS_ADDRESS || "") as Address;
const IDS: number[] = String(import.meta.env.VITE_PASS_TIER_IDS || "1,2,3,4,5,6,7,8,9,10")
  .split(",")
  .map(s => parseInt(s.trim(), 10))
  .filter(Number.isFinite);

const VITE_COLLECTION_URI = (import.meta.env.VITE_COLLECTION_URI || import.meta.env.COLLECTION_URI || "") as string;
const GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY || "https://ipfs.io/ipfs/") as string;
const ID_FORMAT = String(import.meta.env.VITE_ERC1155_ID_FORMAT || "hex").toLowerCase() as "hex" | "dec";

/** IMPORTANT: use the app's BSC RPC (same as appkit) */
const APP_RPC = (import.meta.env.VITE_BSC_RPC_URL as string) || "https://bsc-dataseed1.bnbchain.org";

/** ─────────── Helpers ─────────── */
const idHex64 = (n: number) => BigInt(n).toString(16).toLowerCase().padStart(64, "0");
const ipfsToHttp = (uri?: string) => (!uri ? undefined : uri.startsWith("ipfs://") ? GATEWAY + uri.slice(7) : uri);

const resolveJsonUrl = (tpl: string, id: number) => {
  if (!tpl) return "";
  if (/\{idhex\}/i.test(tpl)) return tpl.replace(/\{idhex\}/gi, idHex64(id));
  if (tpl.includes("{id}")) return tpl.replace("{id}", ID_FORMAT === "dec" ? String(id) : idHex64(id));
  return tpl;
};

/** ─────────── Types ─────────── */
export type PassMeta = {
  id: number;
  name: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: Array<{ trait_type?: string; value?: string }>;
};

export type HonoraryBadgeItem = {
  id: number;
  title: string;
  imageUrl?: string | null;
  mediaUrl?: string | null;   // animation_url preferred
  address?: Address;          // pass contract (for keys)
  externalUrl?: string | null;
};

export function useHonoraryNft(owner?: Address | null) {
  const [passes, setPasses] = useState<PassMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // simple popup gate: show once when user has at least one pass
  const [show, setShow] = useState(false);
  const dismiss = () => setShow(false);

  const rpc = useMemo(
    () =>
      createPublicClient({
        chain: bsc,
        transport: http(APP_RPC),
      }),
    []
  );

  const ready = !!owner && !!PASS_ADDRESS && IDS.length > 0;

  useEffect(() => {
    let stop = false;
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (!ready) {
          setPasses([]);
          setShow(false);
          return;
        }

        const balances = await Promise.all(
          IDS.map((id) =>
            rpc.readContract({
              address: PASS_ADDRESS,
              abi: YEARNPASS1155_ABI,
              functionName: "balanceOf",
              args: [owner as Address, BigInt(id)],
            }) as Promise<bigint>
          )
        );
        const owned = IDS.filter((_, i) => (balances[i] ?? 0n) > 0n);
        if (!owned.length) {
          if (!stop) {
            setPasses([]);
            setShow(false);
          }
          return;
        }

        const result: PassMeta[] = [];
        for (const id of owned) {
          let base = VITE_COLLECTION_URI;
          if (!base) {
            try {
              base = (await rpc.readContract({
                address: PASS_ADDRESS,
                abi: YEARNPASS1155_ABI,
                functionName: "uri",
                args: [BigInt(id)],
              })) as string;
            } catch {/* ignore */}
          }

          if (!base) {
            result.push({ id, name: `Pass #${id}` });
            continue;
          }

          const jsonUrl = ipfsToHttp(resolveJsonUrl(base, id));
          if (!jsonUrl) {
            result.push({ id, name: `Pass #${id}` });
            continue;
          }

          try {
            const res = await fetch(jsonUrl, { signal: ctrl.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const j = await res.json();
            result.push({
              id,
              name: j?.name ?? `Pass #${id}`,
              description: j?.description,
              image: ipfsToHttp(j?.image),
              animation_url: ipfsToHttp(j?.animation_url),
              external_url: j?.external_url,
              attributes: Array.isArray(j?.attributes) ? j.attributes : undefined,
            });
          } catch {
            result.push({ id, name: `Pass #${id}` });
          }
        }

        if (!stop) {
          setPasses(result);
          setShow(true);
        }
      } catch (e: any) {
        if (!stop) {
          setError(e?.message || "Failed to load passes");
          setPasses([]);
          setShow(false);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();

    return () => {
      stop = true;
      ctrl.abort();
    };
  }, [ready, owner, rpc]);

  const badges: HonoraryBadgeItem[] = useMemo(
    () =>
      (passes || []).map((p) => ({
        id: p.id,
        title: p.name,
        imageUrl: p.image || null,
        mediaUrl: p.animation_url || p.image || null,
        address: PASS_ADDRESS,
        externalUrl: p.external_url || null,
      })),
    [passes]
  );

  return { passes, badges, loading, error, show, dismiss };
}
