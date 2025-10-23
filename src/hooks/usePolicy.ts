// src/hooks/usePolicy.ts
import { useMemo } from "react";
import type { Rule, Trio, PageFlags } from "@/config/passPolicy";
import { PASS_POLICY } from "@/config/passPolicy";

/** Helper: membership checks */
const hasAll = (owned: number[] | undefined, need?: number[]) =>
  !need || ((owned ?? []).length > 0 && need.every((id) => (owned ?? []).includes(id)));


const hasAny = (owned: number[] | undefined, maybe?: number[]) =>
  !!maybe && maybe.length > 0 && (owned ?? []).some((id) => maybe.includes(id));

/** Inputs to the policy resolver from the current wallet's perspective */
export type Context = {
  /** The connected wallet’s pass ids (referee when staking) */
  ownPassIds: number[];
  /** Their referrer’s pass ids (if known) */
  referrerPassIds?: number[];
  /** Their referee’s pass ids (used when rendering referrer tools) */
  refereePassIds?: number[];
  /** Is the connected user acting as referee (staking user) or referrer (upline)? */
  role: "referee" | "referrer";
  referrerIsVerified?: boolean; // NEW: allows StakingModal to pass this flag

};

export type ResolvedPolicy = {
  showReferralBox: boolean;
  allowedCompositions: Trio[];
  showPages: Required<PageFlags>;
};


const defaultPageFlags: Required<PageFlags> = {
  myClaims: false,
  referrals: false,
  starJourney: false,
};


/** Merge util to accumulate grants without duplicates */
function mergeInto(target: ResolvedPolicy, add: Partial<ResolvedPolicy>) {
  if (add.showReferralBox) target.showReferralBox = true;

  if (add.allowedCompositions && add.allowedCompositions.length) {
    const seen = new Set(target.allowedCompositions.map((t) => t.join(",")));
    for (const t of add.allowedCompositions) {
      const k = t.join(",");
      if (!seen.has(k)) {
        seen.add(k);
        target.allowedCompositions.push(t);
      }
    }
  }

  if (add.showPages) {
    target.showPages.myClaims    ||= !!add.showPages.myClaims;
    target.showPages.referrals   ||= !!add.showPages.referrals;
    target.showPages.starJourney ||= !!add.showPages.starJourney;
  }
}

/** Core deterministic resolver (pure function) */
export function resolvePolicy(ctx: Context, policy: Rule[] = PASS_POLICY): ResolvedPolicy {
  const out: ResolvedPolicy = {
    showReferralBox: false,
    allowedCompositions: [],
    showPages: { ...defaultPageFlags },
  };

  const refVerified = ctx.role !== "referee" || !!ctx.referrerIsVerified;


  for (const rule of policy) {
    // Rule activates if the OWNER (connected user) owns ANY of ownerPassIds
    const ownerHas = ctx.ownPassIds.some((id) => rule.ownerPassIds.includes(id));
    if (!ownerHas) continue;

    // Hard “requires” gates
    const req = rule.requires;
    const hardOkSelf = hasAll(ctx.ownPassIds, req?.selfMustHave);
    const needsRefHard = ctx.role === "referee" && !!req?.referrerMustHave && req.referrerMustHave.length > 0;

    const hardOkCounter =
      ctx.role === "referee"
        ? (!needsRefHard || (refVerified && hasAll(ctx.referrerPassIds, req?.referrerMustHave)))
        : hasAll(ctx.refereePassIds, req?.refereeMustHave);

    const hardOk = hardOkSelf && hardOkCounter;



    // Soft “may-have” gates (additive; if specified and matched, we’ll allow even if hardOk=false)
    const softHit =
  (ctx.role === "referee" && refVerified && hasAny(ctx.referrerPassIds, req?.referrerMayHave)) ||
  (ctx.role === "referrer" && hasAny(ctx.refereePassIds,  req?.refereeMayHave));


    // Base owner-side grant (role filter + gating)
    const appliesRole = rule.appliesTo === "both" || rule.appliesTo === ctx.role;
    if (appliesRole && (hardOk || softHit)) {
      mergeInto(out, {
        showReferralBox: !!rule.referralBox,
        allowedCompositions: rule.compositions || [],
        showPages: { ...defaultPageFlags, ...(rule.pages ?? {}) },
      });
    }

    // Propagation to counterparty (if present)
    if (rule.propagate) {
      const ownerOk = hasAll(ctx.ownPassIds, rule.propagate.ownerMustHave ?? rule.ownerPassIds);
      const counterpartyIds = ctx.role === "referrer" ? ctx.refereePassIds : ctx.referrerPassIds;
      const needsRefPropHard =
      ctx.role === "referee" && !!rule.propagate.counterpartyMustHave && rule.propagate.counterpartyMustHave.length > 0;

    const counterOk =
      ctx.role === "referee"
        ? (!needsRefPropHard || (refVerified && hasAll(counterpartyIds, rule.propagate.counterpartyMustHave)))
        : hasAll(counterpartyIds, rule.propagate.counterpartyMustHave);


      // Soft propagation gates
      const softCounterOk =
  (ctx.role === "referee" && refVerified && hasAny(ctx.referrerPassIds, rule.propagate.referrerMayHave)) ||
  (ctx.role === "referrer" && hasAny(ctx.refereePassIds,  rule.propagate.refereeMayHave));


      if ((ownerOk && counterOk) || softCounterOk) {
        mergeInto(out, {
          showReferralBox: !!rule.referralBox,
          allowedCompositions: rule.compositions || [],
          showPages: { ...defaultPageFlags, ...(rule.pages ?? {}) },
        });
      }
    }
  }

  // Stable sort: show higher yYearn first
  out.allowedCompositions.sort((a, b) => b[0] - a[0]);

  // Ensure at least baseline [100,0,0] is available for UX
  if (out.allowedCompositions.length === 0) {
    out.allowedCompositions.push([100, 0, 0]);
  }

  return out;
}

/** Tiny hook wrapper around resolvePolicy (memoized) */
export function usePolicy(ctx: Context, policy: Rule[] = PASS_POLICY) {
  return useMemo(() => resolvePolicy(ctx, policy), [JSON.stringify(ctx), JSON.stringify(policy)]);
}

export default usePolicy;
