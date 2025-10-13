// src/types/referrals.ts
export type RefRow = { addr: string; totalYY: bigint };
export type LevelBucket = { level: number; rows: RefRow[]; totalYY: bigint };

