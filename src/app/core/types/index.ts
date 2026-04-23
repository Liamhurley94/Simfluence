export type Tier = 'free' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'admin';

export const TIER_LEVELS: Record<Tier, number> = {
  free: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
  admin: 99,
};

export function tierRank(tier: Tier | null | undefined): number {
  if (!tier) return 0;
  return TIER_LEVELS[tier] ?? 0;
}