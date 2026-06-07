// First-login merge-up: upload a device's local-only data to the cloud.
// Runs once per device per account (local flag), so a second device's unique
// local data is merged up instead of being silently overwritten by the pull.
// Must run AFTER pullAll() so shadows mark which keys the cloud already has.
import { supabase, sbWrite } from '../config/supabase';
import { readLocal } from '../storage/local';
import { enqueue, getShadow } from '../storage/queue';
import { listTrackedLocalKeys } from './mappers';

const MARKER_KEY = 'migrated';

/** Per-device, per-account flag so every new device merges its local data up. */
function deviceMigratedKey(userId: string): string {
  return `__sync_migrated__${userId}`;
}

export function isDeviceMigrated(userId: string): boolean {
  return localStorage.getItem(deviceMigratedKey(userId)) === '1';
}

/**
 * Upload only the local keys that the pull did NOT reconcile — an empty shadow
 * means the cloud lacks that key, so it is local-only and must be pushed up.
 * Cloud-present keys are left exactly as the pull resolved them (cloud has a
 * real timestamp; legacy local data does not). Returns the number of keys
 * queued. Must run AFTER pullAll() so shadows are populated.
 */
export async function migrateLocalData(userId: string): Promise<number> {
  if (!supabase) return 0;
  const keys = listTrackedLocalKeys();
  const now = new Date().toISOString();
  let queued = 0;
  for (const key of keys) {
    const value = readLocal(key);
    if (value == null) continue;
    if (await getShadow(key)) continue; // cloud already has it → keep pull result
    await enqueue({ key, value, updatedAt: now });
    queued++;
  }
  // Account marker kept for back-compat/info; gating is now the device flag.
  await sbWrite!
    .from('settings')
    .upsert(
      { user_id: userId, key: MARKER_KEY, payload: now, updated_at: now, deleted: false },
      { onConflict: 'user_id,key' },
    );
  localStorage.setItem(deviceMigratedKey(userId), '1');
  return queued;
}
