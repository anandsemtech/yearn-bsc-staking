// Central policy describing who gets what based on YearnPass ERC-1155 tiers.
// Encodes your scenarios, including default case (no NFT), T1, T2, T3, and T4 with referrer constraints.

export type Trio = [number, number, number];
export type AppliesTo = "referee" | "referrer" | "both";

export type PageFlags = {
  myClaims?: boolean;
  referrals?: boolean;
  starJourney?: boolean;
};

export type Requires = {
  /** Extra self requirements (on top of ownerPassIds) */
  selfMustHave?: number[];
  /** Connected wallet’s REFERRER must have these passes (hard ALL-of requirement) */
  referrerMustHave?: number[];
  /** Connected wallet’s REFEREE must have these passes (hard ALL-of requirement) */
  refereeMustHave?: number[];
  /** Connected wallet’s REFERRER may have ANY of these passes (soft ANY-of unlock) */
  referrerMayHave?: number[];
  /** Connected wallet’s REFEREE may have ANY of these passes (soft ANY-of unlock) */
  refereeMayHave?: number[];
};

export type Rule = {
  /** Owning ANY of these pass ids activates the rule for the OWNER (connected wallet if role=referee) */
  ownerPassIds: number[];
  /** Whether the rule applies to “referee”, “referrer”, or “both” */
  appliesTo: AppliesTo;

  /** UI affordances this rule grants */
  referralBox?: boolean;
  compositions?: Trio[];
  pages?: PageFlags;

  /** Extra preconditions */
  requires?: Requires;

  /**
   * Propagate owner’s benefits to the counterparty **only if** both sides meet conditions.
   * Example: Owner (referrer) has pass 3, and counterparty (referee) has pass 1 ⇒ grant 80/20 to referee.
   */
  propagate?: {
    ownerMustHave?: number[];          // default = ownerPassIds
    counterpartyMustHave?: number[];   // e.g., [1] when granting to referee
    /** NEW soft gates — additive, not blocking */
    referrerMayHave?: number[];        // if referrer has ANY of these, extend benefits
    refereeMayHave?: number[];         // if referee has ANY of these, extend benefits
  };
};

/** === Rules that encode your finalized behavior === */
export const PASS_POLICY: Rule[] = [
  /**
   * (Implicit default handled in resolver)
   * Everyone can stake with [100,0,0], no referral box, no pages.
   * We add this in code so you don’t have to maintain a rule here.
   */

  /**
   * ▪️ TIER 1 (id 1)
   * Referee gets referral box + pages + [100,0,0].
   * If referrer may-have id 3 or 4 → also allow [80,20,0].
   */
  // ▪️ TIER 1 (id 1) — base
  {
    ownerPassIds: [1],
    appliesTo: "referee",
    referralBox: true,
    compositions: [[100, 0, 0]],
    pages: { myClaims: true, referrals: true, starJourney: true },
  },

  // ▪️ TIER 1 (id 1) — additive unlock if referrer has 3 OR 4
  {
    ownerPassIds: [1],
    appliesTo: "referee",
    compositions: [[80, 20, 0]],
    requires: { referrerMayHave: [3, 4] }, // soft OR: grant if referrer has any of these
  },

  /**
   * ▪️ TIER 2 (id 2)
   * Referee gets referral box + both compositions outright.
   */
  {
    ownerPassIds: [2],
    appliesTo: "referee",
    referralBox: true,
    compositions: [
      [100, 0, 0],
      [80, 20, 0],
    ],
    pages: { myClaims: true, referrals: true, starJourney: true },
  },

  /**
   * ▪️ TIER 3 (id 3)
   * Referee sees [100,0,0] & [80,20,0] only if referrer also has 3 (hard requirement).
   */
  {
    ownerPassIds: [3],
    appliesTo: "referee",
    referralBox: true,
    compositions: [
      [100, 0, 0],
      [80, 20, 0],
    ],
    pages: { myClaims: true, referrals: true, starJourney: true },
    requires: { referrerMustHave: [3] },
  },

  /**
   * ▪️ TIER 4 (id 4)
   * Same as 3 but can extend benefits to referees of any tier via soft “may-have”.
   */
  {
    ownerPassIds: [4],
    appliesTo: "referee",
    referralBox: true,
    compositions: [
      [100, 0, 0],
      [80, 20, 0],
    ],
    pages: { myClaims: true, referrals: true, starJourney: true },
    requires: { referrerMayHave: [4] },
  },

  /**
   * ▪️ REFERRER propagation with TIER 3 or 4
   * If referrer (owner) has id 3 or 4 and referee has id 1,
   * grant [80,20,0] to the referee as well.
   */
  {
    ownerPassIds: [3, 4],
    appliesTo: "both",
    compositions: [
      [100, 0, 0],
      [80, 20, 0],
    ],
    pages: { myClaims: true, referrals: true, starJourney: true },
    propagate: {
      ownerMustHave: [3, 4],
      counterpartyMustHave: [1],
    },
  },
];
