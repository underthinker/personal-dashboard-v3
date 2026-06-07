// Shared sync-layer types (client side).
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'signedout';

export type SyncTable = 'entries' | 'settings' | 'habits' | 'profiles';

/**
 * A queued local mutation. We store the raw localStorage key + value so the
 * mapper is the single source of truth for translating into table rows at
 * push time. value === null means the key was removed (tombstone).
 */
export interface Mutation {
  id?: number; // IndexedDB autoincrement
  key: string;
  value: string | null;
  updatedAt: string; // ISO timestamp (client clock)
}

/** Per-table incremental pull cursor (max updated_at successfully applied). */
export interface Cursor {
  table: SyncTable;
  lastPulledAt: string; // ISO; '' means never pulled
}

/** Engine -> UI event payloads. */
export interface SyncStateEvent {
  status: SyncStatus;
  pending: number;
  lastError?: string;
  lastSyncedAt?: string;
}
