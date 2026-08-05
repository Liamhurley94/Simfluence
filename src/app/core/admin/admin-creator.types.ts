export type PlatformSyncStatus = 'resolving' | 'resolved' | 'synced' | 'offline';

/** One creator to add — matches admin-add-creator's per-item request body. */
export interface AddCreatorInput {
  name: string;
  genre: string;
  platforms: { youtube?: string; twitch?: string };
  bio?: string;
  language?: string;
  color?: string;
  /** Present when adding from discovery: the candidate's just-fetched stats.
   *  The backend births the youtube_creators row fully synced from it. */
  statsSeed?: import('./admin-discovery.types').StatsSeed;
}

export interface AddCreatorResult {
  created: Array<{ id: number; name: string; platforms: string[] }>;
  /** Status of the on-add hydration kicks – 'failed' means stats/GFI will
   *  self-heal overnight (or via Sync unsynced) instead of landing in ~a minute. */
  kicks?: { youtube: KickStatus; gfi: KickStatus; twitch: KickStatus };
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

export type KickStatus = 'ok' | 'failed' | 'skipped';

/** admin_sync_unsynced() RPC result – creator counts per dispatched set. */
export interface SyncUnsyncedResult {
  youtube: number;
  gfi: number;
  twitch: number;
  rates: number;
}
