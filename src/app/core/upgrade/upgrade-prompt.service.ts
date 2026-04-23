import { Injectable, signal } from '@angular/core';
import { Tier } from '../types';

export interface UpgradeRequest {
  feature: string;
  requiredTier: Tier;
}

@Injectable({ providedIn: 'root' })
export class UpgradePromptService {
  readonly current = signal<UpgradeRequest | null>(null);

  open(feature: string, requiredTier: Tier): void {
    this.current.set({ feature, requiredTier });
  }

  close(): void {
    this.current.set(null);
  }
}