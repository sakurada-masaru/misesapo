import React, { useEffect, useMemo, useState } from 'react';
import CleaningWorkerChrome from '../../../shared/ui/Cleaning/CleaningWorkerChrome';
import { normalizeGatewayBase } from '../../../shared/api/gatewayBase';
import manualJp from '../../../../../data/cleaning-manual.json';
import manualEn from '../../../../../data/cleaning-manual-en.json';
import './cleaning-manual-page.css';

const LANG_STORAGE_KEY = 'cleaning-manual-language';
const MASTER_FALLBACK_BASE = 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod';
const EMPTY_MANUAL = { kitchen: [], aircon: [], floor: [], other: [] };

const CATEGORY_META = {
  kitchen: { jp: '厨房設備', en: 'Kitchen' },
  aircon: { jp: '空調設備', en: 'Air Conditioning' },
  floor: { jp: 'フロア', en: 'Floor' },
  other: { jp: 'その他', en: 'Other' },
};

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

const MASTER_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, MASTER_FALLBACK_BASE);

function asList(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v) return [v];
  return [];
}

function imageUrl(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = String(import.meta.env.BASE_URL || '/');
  return `${base.replace(/\/+$/, '/')}${raw.replace(/^\/+/, '')}`;
}

function categoryLabel(key, lang) {
  const meta = CATEGORY_META[key];
  if (!meta) return key;
  return lang === 'en' ? meta.en : meta.jp;
}

function entryTitle(entry, index) {
  const t = String(entry?.title || '').trim();
  if (t) return t;
  return `No.${index + 1}`;
}

function normalizeManualData(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_MANUAL };
  const normalized = {};
  const keys = new Set([...Object.keys(EMPTY_MANUAL), ...Object.keys(raw)]);
  keys.forEach((key) => {
    normalized[key] = Array.isArray(raw[key]) ? raw[key] : [];
  });
  return normalized;
}

function fallbackManualData(lang) {
  return normalizeManualData(lang === 'en' ? manualEn : manualJp);
}

function readManualLanguage() {
  try {
    const stored = String(localStorage.getItem(LANG_STORAGE_KEY) || '').toLowerCase().trim();
    return stored === 'en' ? 'en' : 'jp';
  } catch {
    return 'jp';
  }
}

async function fetchManualData(lang, signal) {
  const suffix = lang === 'en' ? '-en' : '';
  const candidates = [];
  const addCandidate = (url) => {
    if (!url) return;
    if (!candidates.includes(url)) candidates.push(url);
  };

  addCandidate(`${MASTER_API_BASE}/cleaning-manual${suffix}`);
  if (suffix) addCandidate(`${MASTER_API_BASE}/cleaning-manual`);

  if (import.meta.env?.DEV || isLocalUiHost()) {
    addCandidate(`/api/cleaning-manual${suffix}`);
    if (suffix) addCandidate('/api/cleaning-manual');
  }

  let lastError = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return normalizeManualData(data);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('manual data fetch failed');
}

export default function CleaningManualPage() {
  const [lang] = useState(() => readManualLanguage());
  const [manualData, setManualData] = useState(() => fallbackManualData(lang));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeCategory, setActiveCategory] = useState('kitchen');

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setIsLoading(true);
    setLoadError('');

    fetchManualData(lang, controller.signal)
      .then((data) => {
        if (!mounted) return;
        setManualData(data);
      })
      .catch(() => {
        if (!mounted) return;
        setManualData(fallbackManualData(lang));
        setLoadError(
          lang === 'en'
            ? 'Failed to load latest manual. Showing bundled data.'
            : '最新マニュアルの取得に失敗したため、同梱データを表示しています。',
        );
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [lang]);

  const categoryKeys = useMemo(
    () => Object.keys(CATEGORY_META).filter((key) => Array.isArray(manualData?.[key])),
    [manualData],
  );

  useEffect(() => {
    if (!categoryKeys.includes(activeCategory)) {
      setActiveCategory(categoryKeys[0] || '');
    }
  }, [activeCategory, categoryKeys]);

  const entries = useMemo(() => {
    const list = manualData?.[activeCategory];
    return Array.isArray(list) ? list : [];
  }, [manualData, activeCategory]);

  return (
    <div className="app-fullscreen cleaning-worker-app with-cleaning-nav-hotbar cleaning-manual-react-app">
      <CleaningWorkerChrome showNavHotbar />

      <main className="cleaning-manual-react-page" data-job="cleaning">
        <header className="cleaning-manual-react-head">
          <div className="cleaning-manual-react-title">
            <p className="cleaning-manual-react-kicker">{lang === 'en' ? 'Cleaning Standard Manual' : '清掃基準マニュアル'}</p>
            <h1>{lang === 'en' ? 'Field Procedure Library' : '作業手順ライブラリ'}</h1>
          </div>
        </header>
        <nav className="cleaning-manual-react-tabs" aria-label={lang === 'en' ? 'Manual categories' : 'カテゴリ'}>
          {categoryKeys.map((key) => {
            const active = key === activeCategory;
            const count = Array.isArray(manualData?.[key]) ? manualData[key].length : 0;
            return (
              <button
                key={key}
                type="button"
                className={active ? 'active' : ''}
                onClick={() => setActiveCategory(key)}
              >
                <span>{categoryLabel(key, lang)}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </nav>

        <section className="cleaning-manual-react-scroll" aria-live="polite">
          {isLoading ? (
            <p className="cleaning-manual-react-status">
              {lang === 'en' ? 'Loading latest manual...' : '最新マニュアルを読み込み中...'}
            </p>
          ) : null}
          {loadError ? (
            <p className="cleaning-manual-react-status is-error">{loadError}</p>
          ) : null}

          <section className="cleaning-manual-react-list">
            {entries.map((entry, index) => {
              const badImages = asList(entry?.badImage);
              const goodImages = asList(entry?.goodImage);
              return (
                <article className="cleaning-manual-react-card" key={`${activeCategory}-${index}`}>
                  <header className="card-head">
                    <h2>{entryTitle(entry, index)}</h2>
                    <span className="category-tag">{categoryLabel(activeCategory, lang)}</span>
                  </header>

                  {entry?.risk ? (
                    <section className="risk-block">
                      <h3>{lang === 'en' ? 'Risk Focus' : 'リスクフォーカス'}</h3>
                      <p>{String(entry.risk)}</p>
                    </section>
                  ) : null}

                  <div className="comparison-grid">
                    <section className="state-block bad">
                      <h3>{lang === 'en' ? 'NG' : 'NG（避ける対応）'}</h3>
                      <p>{String(entry?.bad || '-')}</p>
                      {badImages.length ? (
                        <div className="image-row">
                          {badImages.map((img, i) => (
                            <img key={`${index}-bad-${i}`} src={imageUrl(img)} alt={`${entryTitle(entry, index)} bad ${i + 1}`} loading="lazy" />
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section className="state-block good">
                      <h3>{lang === 'en' ? 'OK' : 'OK（推奨対応）'}</h3>
                      <p>{String(entry?.good || '-')}</p>
                      {goodImages.length ? (
                        <div className="image-row">
                          {goodImages.map((img, i) => (
                            <img key={`${index}-good-${i}`} src={imageUrl(img)} alt={`${entryTitle(entry, index)} good ${i + 1}`} loading="lazy" />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  </div>

                  {(entry?.qa1q || entry?.qa1a || entry?.qa2q || entry?.qa2a) ? (
                    <section className="qa-block">
                      <h3>{lang === 'en' ? 'Check Questions' : '確認Q&A'}</h3>
                      {entry?.qa1q ? (
                        <div className="qa-item">
                          <p className="q">{String(entry.qa1q)}</p>
                          <p className="a">{String(entry?.qa1a || '-')}</p>
                        </div>
                      ) : null}
                      {entry?.qa2q ? (
                        <div className="qa-item">
                          <p className="q">{String(entry.qa2q)}</p>
                          <p className="a">{String(entry?.qa2a || '-')}</p>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </article>
              );
            })}
          </section>
        </section>
      </main>
    </div>
  );
}
