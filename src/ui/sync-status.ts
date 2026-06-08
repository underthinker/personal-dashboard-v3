// Sync status pill mounted in the sidebar: Synced / Syncing / Offline / Error,
// plus a sign-out action when authenticated.
import type { SyncStateEvent, SyncStatus } from '../sync/types';

const STYLE_ID = 'ikigai-syncstatus-style';
const CSS = `
.iksync{margin:10px 12px 4px;display:flex;align-items:center;gap:8px;font-family:Geist,system-ui,sans-serif;
  font-size:12px;color:var(--text,#e9e9ef)}
.iksync-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:#888}
.iksync[data-s="synced"] .iksync-dot{background:#7fd18f}
.iksync[data-s="syncing"] .iksync-dot{background:#e0b341;animation:iksync-pulse 1s infinite}
.iksync[data-s="offline"] .iksync-dot{background:#888}
.iksync[data-s="error"] .iksync-dot{background:#ff6b6b}
.iksync[data-s="signedout"] .iksync-dot{background:#666}
@keyframes iksync-pulse{0%,100%{opacity:1}50%{opacity:.3}}
.iksync-label{flex:1 1 auto;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iksync-act{background:none;border:none;color:var(--accent,#d1809b);cursor:pointer;font-size:12px;padding:0}
`;

const LABELS: Record<SyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync error',
  signedout: 'Local only',
};

export class SyncStatusIndicator {
  private el: HTMLDivElement | null = null;
  private label: HTMLSpanElement | null = null;
  private action: HTMLButtonElement | null = null;
  private onSignOut: (() => void) | null = null;
  private onSignIn: (() => void) | null = null;
  private lastState: SyncStateEvent | null = null;

  mount(): void {
    if (this.el) return;
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    const el = document.createElement('div');
    el.className = 'iksync';
    el.dataset.s = 'signedout';
    el.innerHTML = `<span class="iksync-dot"></span><span class="iksync-label">Local only</span><button class="iksync-act"></button>`;
    this.label = el.querySelector('.iksync-label');
    this.action = el.querySelector('.iksync-act');
    this.action!.onclick = () => {
      if (this.onSignOut && this.action!.dataset.role === 'out') this.onSignOut();
      else if (this.onSignIn) this.onSignIn();
    };

    const sidebar = document.querySelector('.sidebar');
    const userBlock = document.querySelector('.sidebar-user');
    if (sidebar && userBlock) sidebar.insertBefore(el, userBlock);
    else if (sidebar) sidebar.appendChild(el);
    else document.body.appendChild(el);
    this.el = el;
  }

  setHandlers(opts: { onSignOut: () => void; onSignIn: () => void }): void {
    this.onSignOut = opts.onSignOut;
    this.onSignIn = opts.onSignIn;
    // Initial state may have rendered before handlers existed; re-render so the
    // action button reflects the now-wired handlers.
    if (this.lastState) this.update(this.lastState);
  }

  /** Briefly show an error in the pill (e.g. a failed sign-out), then restore. */
  flashError(text: string): void {
    if (!this.el || !this.label) return;
    this.el.dataset.s = 'error';
    this.label.textContent = `Error: ${text}`;
    window.setTimeout(() => {
      if (this.lastState) this.update(this.lastState);
    }, 4000);
  }

  update(state: SyncStateEvent): void {
    this.lastState = state;
    if (!this.el) return;
    this.el.dataset.s = state.status;
    const authed = state.status !== 'signedout';
    let text = LABELS[state.status];
    if (state.status === 'syncing' && state.pending > 0) text = `Syncing ${state.pending}…`;
    if (state.status === 'error' && state.lastError) text = `Error: ${state.lastError}`;
    this.label!.textContent = text;
    // No handlers wired (Supabase unconfigured) -> hide the action so we never
    // render a dead "Sign in" button the user can click to no effect.
    const canAct = authed ? !!this.onSignOut : !!this.onSignIn;
    this.action!.hidden = !canAct;
    this.action!.textContent = authed ? 'Sign out' : 'Sign in';
    this.action!.dataset.role = authed ? 'out' : 'in';
  }
}
