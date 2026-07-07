export type PlatformSyncStatus = 'resolving' | 'resolved' | 'synced' | 'offline';

/** One creator to add — matches admin-add-creator's per-item request body. */
export interface AddCreatorInput {
  name: string;
  genre: string;
  platforms: { youtube?: string; twitch?: string };
  bio?: string;
  language?: string;
  color?: string;
}

export interface AddCreatorResult {
  created: Array<{ id: number; name: string; platforms: string[] }>;
}

/**
 * An admin-added creator with its derived per-platform sync status. Mirrors the
 * admin-list-creators JSON shape. Progression per platform:
 * resolving (id unresolved) → resolved (id set, stats pending) → synced; or offline.
 */
export interface AddedCreator {
  id: number;
  name: string;
  genre: string;
  platforms: string[];
  addedAt: string;
  youtube: PlatformSyncStatus | null;
  twitch: PlatformSyncStatus | null;
  gfi: boolean;
  cpi: number | null;
}

export interface OfflineCreator {
  id: number;
  name: string | null;
  platform: string;
  offlineAt: string | null;
  reason: string | null;
}

export interface ListCreatorsResult {
  added: AddedCreator[];
  offline: OfflineCreator[];
}
