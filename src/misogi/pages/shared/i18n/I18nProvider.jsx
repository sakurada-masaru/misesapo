import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translateJaToPt } from './ptJaMap';

const LANG_STORAGE_KEY = 'misogi_lang';
const I18nContext = createContext({ lang: 'ja', setLang: () => {}, t: (s) => s });

function loadLang() {
  try {
    const v = String(localStorage.getItem(LANG_STORAGE_KEY) || '').trim();
    if (v === 'pt-BR') return 'pt-BR';
  } catch {
    // noop
  }
  return 'ja';
}

function translateElementAttrs(el) {
  if (!el || !el.getAttribute) return;
  ['placeholder', 'title', 'aria-label'].forEach((k) => {
    const v = el.getAttribute(k);
    if (!v) return;
    const next = translateJaToPt(v);
    if (next !== v) el.setAttribute(k, next);
  });
}

function translateSubtree(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parentTag = String(node.parentElement?.tagName || '').toLowerCase();
    if (!['script', 'style', 'noscript'].includes(parentTag)) {
      const cur = node.nodeValue || '';
      const next = translateJaToPt(cur);
      if (next !== cur) node.nodeValue = next;
    }
    node = walker.nextNode();
  }
  const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
  elements.forEach((el) => translateElementAttrs(el));
}

function DomPtTranslator({ lang }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.setAttribute('lang', lang === 'pt-BR' ? 'pt-BR' : 'ja');
    if (lang !== 'pt-BR') return undefined;

    let rafId = 0;
    const schedule = (root) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => translateSubtree(root || document.body));
    };

    schedule(document.body);
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') {
          schedule(m.target?.parentElement || document.body);
          return;
        }
        if (m.addedNodes?.length) {
          m.addedNodes.forEach((n) => {
            if (n?.nodeType === 1) schedule(n);
            else schedule(document.body);
          });
          return;
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [lang]);
  return null;
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => loadLang());

  const setLang = (next) => {
    const v = next === 'pt-BR' ? 'pt-BR' : 'ja';
    setLangState(v);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, v);
    } catch {
      // noop
    }
  };

  const t = useMemo(() => {
    if (lang === 'pt-BR') return (s) => translateJaToPt(s);
    return (s) => s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return (
    <I18nContext.Provider value={value}>
      <DomPtTranslator lang={lang} />
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
