import './shared/styles/00_tokens.css';
import './shared/styles/10_zindex.css';
import './shared/styles/20_overlays.css';
import './shared/styles/30_layout.css';
import './shared/styles/components.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App.jsx';

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:1rem;color:red">#root が見つかりません。</p>';
} else {
  try {
    ReactDOM.createRoot(rootEl).render(
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    );
  } catch (e) {
    rootEl.innerHTML = '<div style="padding:1rem;color:red"><p>起動エラー:</p><pre>' + (e && e.message) + '</pre></div>';
    console.error(e);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    if (import.meta.env.DEV) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
        console.log("SW unregistered in dev mode");
      } catch (err) {
        console.log("SW unregister failed:", err);
      }
      return;
    }

    navigator.serviceWorker
      .register("/misogi/sw.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.log("SW registration failed:", err));
  });
}
