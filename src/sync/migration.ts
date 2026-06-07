// First-login migration: upload an existing local-only user's data to the cloud.
// Idempotent via a 'migrated' marker stored in the settings table (so it runs
// once per account, not once per device).
import { supabase, sbWrite } from '../config/supabase';
import { readLocal } from '../storage/local';
import { enqueue } from '../storage/queue';
import { listTrackedLocalKeys } from './mappers';

const MARKER_KEY = 'migrated';

export async function isAccountMigrated(userId: string): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase
    .from('settings')
    .select('key')
    .eq('user_id', userId)
    .eq('key', MARKER_KEY)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/**
 * Enqueue every tracked local key as a mutation so the normal push path uploads
 * it, then write the migration marker. Returns number of keys queued.
 */
export async function migrateLocalData(userId: string): Promise<number> {
  if (!supabase) return 0;
  const keys = listTrackedLocalKeys();
  const now = new Date().toISOString();
  for (const key of keys) {
    const value = readLocal(key);
    if (value == null) continue;
    await enqueue({ key, value, updatedAt: now });
  }
  // Marker is written directly (not via the queue) so re-runs short-circuit.
  await sbWrite!
    .from('settings')
    .upsert(
      { user_id: userId, key: MARKER_KEY, payload: now, updated_at: now, deleted: false },
      { onConflict: 'user_id,key' },
    );
  return keys.length;
}
