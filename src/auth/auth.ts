// Authentication layer — a thin, typed wrapper over supabase.auth.
// Supabase handles session persistence (localStorage) and token auto-refresh.
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsVerification?: boolean;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function register(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await client().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: error.message };
    // When email confirmation is on, no session is returned until verified.
    const needsVerification = !data.session;
    return { ok: true, needsVerification };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await client().auth.signInWithPassword({ email, password });
    if (error) {
      const needsVerification = /confirm|verif/i.test(error.message);
      return { ok: false, error: error.message, needsVerification };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function logout(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function resendVerification(email: string): Promise<AuthResult> {
  try {
    const { error } = await client().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  try {
    const { error } = await client().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
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
