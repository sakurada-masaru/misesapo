import './shared/styles/00_tokens.css';
import './shared/styles/10_zindex.css';
import './shared/styles/20_overlays.css';
import './shared/styles/30_layout.css';
import './shared/styles/components.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { I18nProvider } from './shared/i18n/I18nProvider';

function redirectPathToHashRoute() {
  if (typeof window === 'undefined') return false;
  const pathname = String(window.location.pathname || '');
  const hash = String(window.location.hash || '');
  if (hash.startsWith('#/')) return false;
  if (hash) return false;
  const base = '/misogi';
  if (!pathname.startsWith(`${base}/`)) return false;
  if (pathname === `${base}/`) return false;
  const subPath = pathname.slice(base.length);
  if (/\.[a-zA-Z0-9]+$/.test(subPath)) return false;
  const search = String(window.location.search || '');
  const target = `${base}/#${subPath}${search}`;
  window.location.replace(target);
  return true;
}

function resolveInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem('misogi-v2-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const redirectedToHashRoute =
  typeof document !== 'undefined' ? redirectPathToHashRoute() : false;

if (typeof document !== 'undefined' && !redirectedToHashRoute) {
  document.documentElement.setAttribute('data-theme', resolveInitialTheme());
}

// DevTools / UI freeze mitigation:
// Some pages emit very chatty console.log() (sometimes with big objects). This can hang Chrome
// (including in production) when logs are heavy. Default to silencing log/info/debug unless enabled.
if (typeof window !== 'undefined') {
  try {
    const enabled = String(localStorage.getItem('misogi_debug') || '') === '1';
    window.__MISOGI_DEBUG__ = enabled;
    if (!enabled) {
      const noop = () => { };
      // Keep warn/error to preserve signal while making DevTools usable.
      console.log = noop;
      console.info = noop;
      console.debug = noop;
    }
  } catch {
    // ignore
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:1rem;color:red">#root が見つかりません。</p>';
} else {
  try {
    if (!redirectedToHashRoute) {
      ReactDOM.createRoot(rootEl).render(
        <I18nProvider>
          <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </HashRouter>
        </I18nProvider>
      );
    }
  } catch (e) {
    rootEl.innerHTML = '<div style="padding:1rem;color:red"><p>起動エラー:</p><pre>' + (e && e.message) + '</pre></div>';
    console.error(e);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    // Stability-first: disable SW for MISOGI.
    // SW caching has been causing "it doesn't change" and hard-freeze style incidents in admin flows.
    // Always attempt to unregister existing registrations under this origin.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          try {
            // Be conservative: unregister everything on this origin.
            await reg.unregister();
          } catch {
            // ignore per-reg failure
          }
        })
      );
      console.log("SW unregistered");
    } catch (err) {
      console.log("SW unregister failed:", err);
    }

    // Do not register a new SW (both dev and prod).
    return;
  });
}
