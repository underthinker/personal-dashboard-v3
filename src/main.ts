// Cloud-sync bootstrap. Wires auth -> engine -> UI on top of the existing
// vanilla dashboard without modifying any feature module. Loaded once via a
// module <script> in index.html. If Supabase is unconfigured, the app stays in
// pure local-only mode and nothing here interferes.
import { logout, onAuthChange } from './auth/auth';
import { isSupabaseConfigured } from './config/supabase';
import { installInterceptor } from './storage/local';
import { engine } from './sync/engine';
import { AuthScreen } from './ui/auth-screen';
import { SyncStatusIndicator } from './ui/sync-status';

function boot(): void {
  const indicator = new SyncStatusIndicator();
  indicator.mount();
  engine.onState((s) => indicator.update(s));

  if (!isSupabaseConfigured) {
    // No cloud creds: local-only. Indicator already reads "Local only".
    return;
  }

  // Marker the vanilla layer reads to know sync is available (e.g. the
  // onboarding checklist shows its "Sign in to sync" step only when set).
  document.documentElement.dataset.supabase = '';

  // Capture localStorage writes from the legacy modules for the queue.
  installInterceptor((e) => engine.handleCapture(e));

  // Remember when the user chose "Continue offline" so we don't re-prompt the
  // sign-in overlay on every reload. Cleared on an explicit sign-out.
  const OFFLINE_OPTOUT_KEY = 'ikigai_offline_optout_v1';

  const authScreen = new AuthScreen({
    onOfflineContinue: () => {
      localStorage.setItem(OFFLINE_OPTOUT_KEY, '1');
    },
  });

  // The legacy onboarding checklist dispatches this when the user clicks
  // "Sign in to sync" — show the auth screen on demand, not at boot.
  window.addEventListener('ikigai:request-sign-in', () => authScreen.show());

  // First-run setup (the inline #setupBg wizard in index.html) must complete
  // before the sign-in overlay appears. Keys mirror that wizard's storage.
  const setupPending = (): boolean =>
    !localStorage.getItem('dashboard_setup_v1') && !localStorage.getItem('sidebar_user_name_v1');

  const showAuthScreen = (): void => {
    if (localStorage.getItem(OFFLINE_OPTOUT_KEY)) return;
    if (setupPending()) {
      window.addEventListener('ikigai:setup-done', () => authScreen.show(), { once: true });
    } else {
      authScreen.show();
    }
  };

  indicator.setHandlers({
    onSignOut: async () => {
      localStorage.removeItem(OFFLINE_OPTOUT_KEY);
      const r = await logout(); // on success, triggers onAuthChange(null)
      if (!r.ok) indicator.flashError(r.error ?? 'Sign out failed.');
    },
    onSignIn: () => {
      localStorage.removeItem(OFFLINE_OPTOUT_KEY);
      authScreen.show();
    },
  });

  let currentUser: string | null = null;
  onAuthChange((session) => {
    const uid = session?.user?.id ?? null;
    if (uid && uid !== currentUser) {
      currentUser = uid;
      // Signal the vanilla onboarding checklist that auth completed.
      localStorage.setItem('ob_auth_done_v1', '1');
      authScreen.hide();
      void engine.start(uid);
    } else if (!uid && currentUser) {
      currentUser = null;
      void engine.stop();
      showAuthScreen();
    } else if (!uid && !currentUser) {
      // First load, no session: stay local-only. User can sign in via
      // the sync status indicator or the onboarding checklist.
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
