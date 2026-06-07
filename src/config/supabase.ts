import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../sync/db-types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when build-time env provided real credentials. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The Supabase client, or null when unconfigured. A null client means the
 * dashboard runs in pure offline/local-only mode (no auth UI, no sync) so the
 * app never breaks just because cloud creds are absent.
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

/**
 * Loosely-typed view of the client for write paths. The generated table types
 * resolve `Insert` to `never` for upsert payloads built dynamically, so writes
 * go through this alias while reads keep full typing via `supabase`.
 */
export const sbWrite: SupabaseClient | null = supabase as SupabaseClient | null;
