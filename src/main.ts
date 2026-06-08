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

  // Capture localStorage writes from the legacy modules for the queue.
  installInterceptor((e) => engine.handleCapture(e));

  const authScreen = new AuthScreen({
    onOfflineContinue: () => {
      /* user chose local-only for this session */
    },
  });

  indicator.setHandlers({
    onSignOut: async () => {
      await logout(); // triggers onAuthChange(null)
    },
    onSignIn: () => authScreen.show(),
  });

  let currentUser: string | null = null;
  onAuthChange((session) => {
    const uid = session?.user?.id ?? null;
    if (uid && uid !== currentUser) {
      currentUser = uid;
      authScreen.hide();
      void engine.start(uid);
    } else if (!uid && currentUser) {
      currentUser = null;
      void engine.stop();
      authScreen.show();
    } else if (!uid && !currentUser) {
      // First load, no session: prompt sign-in (offline still available).
      authScreen.show();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
