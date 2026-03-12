import React, { useEffect, useMemo, useState } from 'react';
import CleaningWorkerChrome from '../../../shared/ui/Cleaning/CleaningWorkerChrome';
import manualJp from '../../../../../data/cleaning-manual.json';
import manualEn from '../../../../../data/cleaning-manual-en.json';
import './cleaning-manual-page.css';

const LANG_STORAGE_KEY = 'cleaning-manual-language';

const CATEGORY_META = {
  kitchen: { jp: '厨房設備', en: 'Kitchen' },
  aircon: { jp: '空調設備', en: 'Air Conditioning' },
  floor: { jp: 'フロア', en: 'Floor' },
  other: { jp: 'その他', en: 'Other' },
};

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

export default function CleaningManualPage() {
  const [lang, setLang] = useState(() => {
    const stored = String(localStorage.getItem(LANG_STORAGE_KEY) || 'jp').toLowerCase();
    return stored === 'en' ? 'en' : 'jp';
  });
  const [activeCategory, setActiveCategory] = useState('kitchen');

  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);

  const manualData = useMemo(() => (lang === 'en' ? manualEn : manualJp), [lang]);
  const categoryKeys = useMemo(() => Object.keys(manualData || {}), [manualData]);

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
        <header className="cleaning-manual-react-header">
          <div>
            <p className="cleaning-manual-react-kicker">{lang === 'en' ? 'Cleaning Standard Manual' : '清掃基準マニュアル'}</p>
            <h1>{lang === 'en' ? 'Field Procedure Library' : '作業手順ライブラリ'}</h1>
          </div>
          <div className="cleaning-manual-react-lang">
            <button
              type="button"
              className={lang === 'jp' ? 'active' : ''}
              onClick={() => setLang('jp')}
            >
              日本語
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'active' : ''}
              onClick={() => setLang('en')}
            >
              English
            </button>
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

        <section className="cleaning-manual-react-list" aria-live="polite">
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
      </main>
    </div>
  );
}
