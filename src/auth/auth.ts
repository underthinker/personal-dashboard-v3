// Authentication layer — a thin, typed wrapper over supabase.auth.
// Supabase handles session persistence (localStorage) and token auto-refresh.
// Sign-in is OAuth-only (Google / GitHub); no email/password.
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

export type OAuthProvider = 'google' | 'github';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** Begin OAuth flow. Redirects the browser to the provider, then back to origin. */
export async function signInWithProvider(provider: OAuthProvider): Promise<AuthResult> {
  try {
    // Return to the current path (minus any query/hash) so OAuth works even when
    // the app is served from a sub-path, not just the bare origin.
    const redirectTo = window.location.href.split('?')[0].split('#')[0];
    const { error } = await client().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function logout(): Promise<AuthResult> {
  if (!supabase) return { ok: true };
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const s = await getSession();
  return s?.user ?? null;
}

export type AuthChangeHandler = (session: Session | null) => void;

/** Subscribe to auth state changes. Fires immediately with the current session. */
export function onAuthChange(handler: AuthChangeHandler): () => void {
  if (!supabase) {
    handler(null);
    return () => {};
  }
  void getSession().then(handler);
  const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error';
}
