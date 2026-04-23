import { Injectable } from '@angular/core';
import { Tier, tierRank } from '../types';

const KEY_PREFIX = 'sf_sim_runs_';

const LIMITS: Record<Tier, number> = {
  free: 3,
  bronze: 3,
  silver: 10,
  gold: Infinity,
  platinum: Infinity,
  diamond: Infinity,
  admin: Infinity,
};

export interface RateLimitStatus {
  used: number;
  limit: number;
  remaining: number;
  blocked: boolean;
}

/**
 * Client-side monthly rate limiter for simulation runs.
 *
 * Honor-system — bypassable by clearing storage. Replaced by server-side
 * enforcement once the backend repo provisions tier gating. Matches the
 * current app.html key convention (`sf_sim_runs_YYYY-MM`).
 */
@Injectable({ providedIn: 'root' })
export class RateLimitService {
  currentKey(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${KEY_PREFIX}${y}-${m}`;
  }

  read(): number {
    try {
      const raw = localStorage.getItem(this.currentKey());
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  check(tier: Tier): RateLimitStatus {
    const used = this.read();
    const limit = this.limitFor(tier);
    const remaining = Math.max(0, limit - used);
    return {
      used,
      limit,
      remaining,
      blocked: remaining <= 0 && limit !== Infinity,
    };
  }

  increment(): void {
    const next = this.read() + 1;
    try {
      localStorage.setItem(this.currentKey(), String(next));
    } catch {
      /* ignore — honor-system anyway */
    }
  }

  reset(): void {
    try {
      localStorage.removeItem(this.currentKey());
    } catch {
      /* ignore */
    }
  }

  private limitFor(tier: Tier): number {
    // Gold+ unlimited (see LIMITS map). Resolve via rank so unknown tiers are safe.
    return tierRank(tier) >= tierRank('gold') ? Infinity : LIMITS[tier] ?? 3;
  }
}
