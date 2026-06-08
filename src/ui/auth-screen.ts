// Auth overlay: OAuth sign-in (Google / GitHub) or continue offline.
// Self-contained styling (scoped) so it never depends on unknown legacy CSS,
// while reusing the app's accent token when present.
import { signInWithProvider, type OAuthProvider } from '../auth/auth';

const STYLE_ID = 'ikigai-auth-style';
const CSS = `
@keyframes ikauth-overlay-in{from{opacity:0}to{opacity:1}}
@keyframes ikauth-card-in{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
@keyframes ikauth-item-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ikauth-glow{0%,100%{transform:translate(-12%,-8%) scale(1)}50%{transform:translate(12%,8%) scale(1.25)}}
.ikauth-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  background:rgba(10,10,14,.72);backdrop-filter:blur(6px);font-family:Geist,system-ui,sans-serif;padding:20px;
  animation:ikauth-overlay-in .35s ease both}
.ikauth-card{position:relative;overflow:hidden;width:100%;max-width:380px;background:var(--surface,#16161c);color:var(--text,#e9e9ef);
  border:1px solid var(--border,rgba(255,255,255,.08));border-radius:16px;padding:28px;
  box-shadow:0 20px 60px rgba(0,0,0,.5);
  animation:ikauth-card-in .5s cubic-bezier(.16,1,.3,1) both}
.ikauth-card::before{content:"";position:absolute;top:-40%;left:-20%;width:140%;height:120%;z-index:0;pointer-events:none;
  background:radial-gradient(50% 50% at 30% 30%,color-mix(in srgb,var(--accent,#d1809b) 28%,transparent),transparent 70%);
  filter:blur(40px);opacity:.6;animation:ikauth-glow 9s ease-in-out infinite}
.ikauth-card>*{position:relative;z-index:1}
.ikauth-title{font-size:20px;font-weight:600;margin:0 0 4px;animation:ikauth-item-in .5s ease both .1s}
.ikauth-sub{font-size:13px;opacity:.65;margin:0 0 20px;line-height:1.5;animation:ikauth-item-in .5s ease both .16s}
.ikauth-oauth{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:11px;
  border:1px solid var(--border,rgba(255,255,255,.14));border-radius:10px;background:var(--bg,#0e0e12);
  color:inherit;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;
  transition:border-color .2s ease,transform .15s ease,box-shadow .2s ease;animation:ikauth-item-in .5s ease both}
#ik-google{animation-delay:.22s}
#ik-github{animation-delay:.28s}
.ikauth-oauth:hover{border-color:var(--accent,#d1809b);transform:translateY(-1px);
  box-shadow:0 6px 18px color-mix(in srgb,var(--accent,#d1809b) 22%,transparent)}
.ikauth-oauth:active{transform:translateY(0)}
.ikauth-oauth:disabled{opacity:.6;cursor:default;transform:none;box-shadow:none}
.ikauth-oauth svg{width:18px;height:18px;flex:none}
.ikauth-msg{font-size:13px;margin:10px 0 0;line-height:1.4;animation:ikauth-item-in .3s ease both}
.ikauth-msg.err{color:#ff8989}
.ikauth-foot{margin-top:18px;text-align:center;animation:ikauth-item-in .5s ease both .34s}
.ikauth-link{color:var(--accent,#d1809b);cursor:pointer;background:none;border:none;font-size:12px;padding:0;opacity:.6;transition:opacity .2s ease}
.ikauth-link:hover{opacity:1}
@media (prefers-reduced-motion:reduce){
  .ikauth-overlay,.ikauth-card,.ikauth-card::before,.ikauth-title,.ikauth-sub,.ikauth-oauth,.ikauth-msg,.ikauth-foot{animation:none}
}
`;

const GOOGLE_ICON = `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>`;
const GITHUB_ICON = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1a11 11 0 0 0-3.48 21.44c.55.1.75-.24.75-.53v-1.86c-3.06.67-3.71-1.47-3.71-1.47-.5-1.28-1.23-1.62-1.23-1.62-1-.69.08-.67.08-.67 1.1.08 1.69 1.14 1.69 1.14.98 1.69 2.58 1.2 3.21.92.1-.71.39-1.2.7-1.47-2.44-.28-5-1.22-5-5.44 0-1.2.43-2.18 1.14-2.95-.11-.28-.49-1.4.11-2.92 0 0 .93-.3 3.05 1.13a10.6 10.6 0 0 1 5.56 0c2.12-1.43 3.05-1.13 3.05-1.13.6 1.52.22 2.64.11 2.92.71.77 1.14 1.75 1.14 2.95 0 4.23-2.57 5.16-5.02 5.43.4.34.75 1.01.75 2.04v3.03c0 .3.2.64.76.53A11 11 0 0 0 12 1z"/></svg>`;

export class AuthScreen {
  private root: HTMLDivElement | null = null;
  private onOfflineContinue: () => void;

  constructor(opts: { onOfflineContinue: () => void }) {
    this.onOfflineContinue = opts.onOfflineContinue;
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  show(): void {
    this.ensureStyle();
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.className = 'ikauth-overlay';
      document.body.appendChild(this.root);
    }
    this.render();
  }

  hide(): void {
    this.root?.remove();
    this.root = null;
  }

  private render(): void {
    if (!this.root) return;
    const card = document.createElement('div');
    card.className = 'ikauth-card';
    card.innerHTML = `
      <h2 class="ikauth-title">Sign in</h2>
      <p class="ikauth-sub">Sync your dashboard across devices.</p>
      <button class="ikauth-oauth" id="ik-google">${GOOGLE_ICON}<span>Continue with Google</span></button>
      <button class="ikauth-oauth" id="ik-github">${GITHUB_ICON}<span>Continue with GitHub</span></button>
      <div class="ikauth-foot"><button class="ikauth-link" id="ik-offline">Continue offline</button></div>`;

    this.wireProvider(card, 'ik-google', 'google');
    this.wireProvider(card, 'ik-github', 'github');
    card.querySelector<HTMLButtonElement>('#ik-offline')!.onclick = () => {
      this.hide();
      this.onOfflineContinue();
    };
    this.root.replaceChildren(card);
  }

  private wireProvider(card: HTMLElement, id: string, provider: OAuthProvider): void {
    const btn = card.querySelector<HTMLButtonElement>(`#${id}`)!;
    btn.onclick = async () => {
      card.querySelectorAll<HTMLButtonElement>('.ikauth-oauth').forEach((b) => (b.disabled = true));
      const r = await signInWithProvider(provider);
      // On success the browser redirects to the provider; nothing more to do.
      if (!r.ok) {
        card.querySelectorAll<HTMLButtonElement>('.ikauth-oauth').forEach((b) => (b.disabled = false));
        this.msg(card, r.error ?? 'Sign in failed.');
      }
    };
  }

  private msg(card: HTMLElement, text: string): void {
    let el = card.querySelector<HTMLParagraphElement>('.ikauth-msg');
    if (!el) {
      el = document.createElement('p');
      el.className = 'ikauth-msg err';
      card.querySelector('.ikauth-foot')?.insertAdjacentElement('beforebegin', el);
    }
    el.textContent = text;
  }
}
