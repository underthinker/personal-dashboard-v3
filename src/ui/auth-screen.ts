// Auth overlay: register / login / verify-pending / forgot-password.
// Self-contained styling (scoped) so it never depends on unknown legacy CSS,
// while reusing the app's accent token when present.
import { login, register, requestPasswordReset, resendVerification } from '../auth/auth';

type Mode = 'login' | 'register' | 'verify' | 'forgot';

const STYLE_ID = 'ikigai-auth-style';
const CSS = `
.ikauth-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  background:rgba(10,10,14,.72);backdrop-filter:blur(6px);font-family:Geist,system-ui,sans-serif;padding:20px}
.ikauth-card{width:100%;max-width:380px;background:var(--surface,#16161c);color:var(--text,#e9e9ef);
  border:1px solid var(--border,rgba(255,255,255,.08));border-radius:16px;padding:28px;
  box-shadow:0 20px 60px rgba(0,0,0,.5)}
.ikauth-title{font-size:20px;font-weight:600;margin:0 0 4px}
.ikauth-sub{font-size:13px;opacity:.65;margin:0 0 20px;line-height:1.5}
.ikauth-field{display:block;margin-bottom:12px}
.ikauth-field input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;
  border:1px solid var(--border,rgba(255,255,255,.12));background:var(--bg,#0e0e12);color:inherit;font-size:14px}
.ikauth-field input:focus{outline:none;border-color:var(--accent,#d1809b)}
.ikauth-btn{width:100%;padding:11px;border:none;border-radius:10px;background:var(--accent,#d1809b);
  color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px}
.ikauth-btn:disabled{opacity:.6;cursor:default}
.ikauth-row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:13px}
.ikauth-link{color:var(--accent,#d1809b);cursor:pointer;background:none;border:none;font-size:13px;padding:0}
.ikauth-msg{font-size:13px;margin:10px 0 0;line-height:1.4}
.ikauth-msg.err{color:#ff8989}
.ikauth-msg.ok{color:#7fd18f}
.ikauth-foot{margin-top:18px;text-align:center}
.ikauth-foot button{font-size:12px;opacity:.6}
`;

export class AuthScreen {
  private root: HTMLDivElement | null = null;
  private mode: Mode = 'login';
  private pendingEmail = '';
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

  show(mode: Mode = 'login'): void {
    this.ensureStyle();
    this.mode = mode;
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
    switch (this.mode) {
      case 'login':
        this.renderLogin(card);
        break;
      case 'register':
        this.renderRegister(card);
        break;
      case 'verify':
        this.renderVerify(card);
        break;
      case 'forgot':
        this.renderForgot(card);
        break;
    }
    this.root.replaceChildren(card);
  }

  private field(label: string, type: string, id: string, value = ''): string {
    return `<label class="ikauth-field"><input id="${id}" type="${type}" placeholder="${label}" value="${value}" autocomplete="${type === 'password' ? 'current-password' : 'email'}"/></label>`;
  }

  private msg(card: HTMLElement, text: string, kind: 'err' | 'ok'): void {
    let el = card.querySelector<HTMLParagraphElement>('.ikauth-msg');
    if (!el) {
      el = document.createElement('p');
      el.className = 'ikauth-msg';
      card.querySelector('.ikauth-btn')?.insertAdjacentElement('afterend', el);
    }
    el.textContent = text;
    el.className = `ikauth-msg ${kind}`;
  }

  private val(card: HTMLElement, id: string): string {
    return (card.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '').trim();
  }

  private renderLogin(card: HTMLElement): void {
    card.innerHTML = `
      <h2 class="ikauth-title">Welcome back</h2>
      <p class="ikauth-sub">Sign in to sync your dashboard across devices.</p>
      ${this.field('Email', 'email', 'ik-email', this.pendingEmail)}
      ${this.field('Password', 'password', 'ik-pass')}
      <button class="ikauth-btn" id="ik-submit">Sign in</button>
      <div class="ikauth-row">
        <button class="ikauth-link" id="ik-forgot">Forgot password?</button>
        <button class="ikauth-link" id="ik-toreg">Create account</button>
      </div>
      <div class="ikauth-foot"><button class="ikauth-link" id="ik-offline">Continue offline</button></div>`;
    const submit = card.querySelector<HTMLButtonElement>('#ik-submit')!;
    submit.onclick = async () => {
      const email = this.val(card, 'ik-email');
      const pass = this.val(card, 'ik-pass');
      if (!email || !pass) return this.msg(card, 'Enter email and password.', 'err');
      submit.disabled = true;
      const r = await login(email, pass);
      submit.disabled = false;
      if (!r.ok) {
        if (r.needsVerification) {
          this.pendingEmail = email;
          this.mode = 'verify';
          return this.render();
        }
        return this.msg(card, r.error ?? 'Sign in failed.', 'err');
      }
      // success: onAuthChange in main.ts hides the overlay.
    };
    card.querySelector<HTMLButtonElement>('#ik-toreg')!.onclick = () => {
      this.mode = 'register';
      this.render();
    };
    card.querySelector<HTMLButtonElement>('#ik-forgot')!.onclick = () => {
      this.mode = 'forgot';
      this.render();
    };
    card.querySelector<HTMLButtonElement>('#ik-offline')!.onclick = () => {
      this.hide();
      this.onOfflineContinue();
    };
  }

  private renderRegister(card: HTMLElement): void {
    card.innerHTML = `
      <h2 class="ikauth-title">Create account</h2>
      <p class="ikauth-sub">Your existing local data will be uploaded after you verify.</p>
      ${this.field('Email', 'email', 'ik-email', this.pendingEmail)}
      ${this.field('Password (min 6 chars)', 'password', 'ik-pass')}
      <button class="ikauth-btn" id="ik-submit">Create account</button>
      <div class="ikauth-row"><span></span>
        <button class="ikauth-link" id="ik-tologin">Have an account? Sign in</button></div>`;
    const submit = card.querySelector<HTMLButtonElement>('#ik-submit')!;
    submit.onclick = async () => {
      const email = this.val(card, 'ik-email');
      const pass = this.val(card, 'ik-pass');
      if (!email || pass.length < 6) return this.msg(card, 'Valid email and 6+ char password required.', 'err');
      submit.disabled = true;
      const r = await register(email, pass);
      submit.disabled = false;
      if (!r.ok) return this.msg(card, r.error ?? 'Registration failed.', 'err');
      this.pendingEmail = email;
      if (r.needsVerification) {
        this.mode = 'verify';
        this.render();
      }
      // else: auto signed-in, onAuthChange hides overlay.
    };
    card.querySelector<HTMLButtonElement>('#ik-tologin')!.onclick = () => {
      this.mode = 'login';
      this.render();
    };
  }

  private renderVerify(card: HTMLElement): void {
    card.innerHTML = `
      <h2 class="ikauth-title">Check your email</h2>
      <p class="ikauth-sub">We sent a verification link to <b>${this.pendingEmail}</b>. Confirm it, then sign in.</p>
      <button class="ikauth-btn" id="ik-resend">Resend email</button>
      <div class="ikauth-foot"><button class="ikauth-link" id="ik-tologin">Back to sign in</button></div>`;
    const resend = card.querySelector<HTMLButtonElement>('#ik-resend')!;
    resend.onclick = async () => {
      resend.disabled = true;
      const r = await resendVerification(this.pendingEmail);
      resend.disabled = false;
      this.msg(card, r.ok ? 'Verification email sent.' : r.error ?? 'Failed.', r.ok ? 'ok' : 'err');
    };
    card.querySelector<HTMLButtonElement>('#ik-tologin')!.onclick = () => {
      this.mode = 'login';
      this.render();
    };
  }

  private renderForgot(card: HTMLElement): void {
    card.innerHTML = `
      <h2 class="ikauth-title">Reset password</h2>
      <p class="ikauth-sub">Enter your email and we'll send a reset link.</p>
      ${this.field('Email', 'email', 'ik-email', this.pendingEmail)}
      <button class="ikauth-btn" id="ik-submit">Send reset link</button>
      <div class="ikauth-foot"><button class="ikauth-link" id="ik-tologin">Back to sign in</button></div>`;
    const submit = card.querySelector<HTMLButtonElement>('#ik-submit')!;
    submit.onclick = async () => {
      const email = this.val(card, 'ik-email');
      if (!email) return this.msg(card, 'Enter your email.', 'err');
      submit.disabled = true;
      const r = await requestPasswordReset(email);
      submit.disabled = false;
      this.msg(card, r.ok ? 'Reset link sent.' : r.error ?? 'Failed.', r.ok ? 'ok' : 'err');
    };
    card.querySelector<HTMLButtonElement>('#ik-tologin')!.onclick = () => {
      this.mode = 'login';
      this.render();
    };
  }
}
