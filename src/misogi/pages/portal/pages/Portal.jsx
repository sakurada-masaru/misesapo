import React, { useState, useEffect, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';
import { JOBS } from '../../shared/utils/constants';
import { useAuth } from '../../shared/auth/useAuth';

const SignInModal = React.lazy(() => import('../../shared/auth/SignInModal'));

const API_BASE =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    ? '/api'
    : (import.meta.env?.VITE_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod');

/**
 * 大前提（ナビゲーション）
 * - Portal = ジョブを選ぶシステムの玄関
 * - エントランス = 各部署の窓口
 * - 各部署のホットバーはエントランスになくてはならない（ジョブ切替はエントランスから）
 */
const JOB_ENTRANCE_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];

/**
 * workers リスト（GET /api/workers）の role ごとのエントランス振り分け。
 * docs/spec/WORKERS_LIST_REFERENCE.md の role に合わせる。
 */
const ROLE_TO_ENTRANCE = {
  admin: '/admin/entrance',
  sales: '/jobs/sales/entrance',
  office: '/jobs/office/entrance',
  staff: '/jobs/cleaning/entrance',
  cleaning: '/jobs/cleaning/entrance',
  developer: '/jobs/dev/entrance',
  dev: '/jobs/dev/entrance',
  operation: '/admin/entrance',
  human_resources: '/admin/entrance',
  // headquarters は ROLE_TO_ENTRANCE に含めない → 入室時にジョブ選択を表示（全ジョブに権限あり）
};

/**
 * Misogi Portal（認証・業務開始意思表示・role により遷移）
 * - 未認証: 「ログイン」→ サインインページへ（ログイン後に Portal へ戻る）
 * - 認証済: 「入室」→ role に応じて ROLE_TO_ENTRANCE で振り分け、該当なしはジョブ選択
 */
export default function Portal() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, refresh, logout, getToken, authz } = useAuth();
  const [started, setStarted] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [nonOperatingDates, setNonOperatingDates] = useState([]);

  const effectiveUser = user ?? { id: 'guest', name: '', role: '' };

  useEffect(() => {
    if (isLoading) return;
    const { isAdmin, isDev } = authz || {};
    const token = getToken();

    // ログインしていない、またはトークンがない場合は取得しない（403回避）
    // また、一般ユーザー（清掃員など）は設定取得の権限がないためスキップ
    if (!isAuthenticated || !token || (!isAdmin && !isDev)) {
      // すでに空なら何もしない（無限ループ防止）
      setNonOperatingDates(prev => prev.length === 0 ? prev : []);
      return;
    }

    const headers = { 'Authorization': `Bearer ${String(token).trim()}` };
    const base = API_BASE.replace(/\/$/, '');

    fetch(`${base}/settings/portal-operating-days`, {
      cache: 'no-store',
      headers
    })
      .then((res) => {
        // 403 Forbidden の場合は、単に空として扱う（管理権限不足など）
        if (res.status === 403) return { non_operating_dates: [] };
        return res.ok ? res.json() : { non_operating_dates: [] };
      })
      .then((data) => {
        const nextDates = Array.isArray(data.non_operating_dates) ? data.non_operating_dates : [];
        // 値が同じなら更新しない
        setNonOperatingDates(prev => JSON.stringify(prev) === JSON.stringify(nextDates) ? prev : nextDates);
      })
      .catch(() => {
        setNonOperatingDates(prev => prev.length === 0 ? prev : []);
      });
  }, [isLoading, isAuthenticated, getToken, authz]);

  const today = typeof window !== 'undefined' ? new Date().toISOString().slice(0, 10) : '';
  const isNonOperatingToday = today && nonOperatingDates.includes(today);

  function handleEnter() {
    setStarted(true);
    const role = (effectiveUser.role && String(effectiveUser.role).trim()) || '';
    // workers リストの role で振り分け
    const path = ROLE_TO_ENTRANCE[role];
    if (path) {
      navigate(path);
      return;
    }
    // single:xxx 形式の互換
    if (role.startsWith('single:')) {
      const job = role.replace('single:', '');
      const singlePath = job === 'admin' ? '/admin/entrance' : (JOB_ENTRANCE_KEYS.includes(job) ? `/jobs/${job}/entrance` : null);
      if (singlePath) {
        navigate(singlePath);
        return;
      }
    }
    // 該当なし: ジョブ選択を表示
  }

  if (isLoading) {
    return (
      <div className="entrance-page">
        <div className="logo-section">
          <div className="logo-main">
            <span className="initial-glow" aria-hidden="true">M</span>ISOGI
          </div>
        </div>
        <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: '0.9rem' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="entrance-page">
      <div className="logo-section">
        <div className="logo-main">
          <span className="initial-glow" aria-hidden="true">M</span>ISOGI
        </div>
        <div className="logo-sub">
          MISESAPO INTELLIGENT SYSTEM FOR<br />OPERATIONAL GUIDANCE &amp; INTERFACE
        </div>
      </div>

      <Visualizer active={false} />

      {isNonOperatingToday && (
        <p className="portal-non-operating-banner" style={{ marginTop: 16, marginBottom: 0, padding: '12px 20px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 12, color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600 }}>
          本日は休業日です
        </p>
      )}

      {!isAuthenticated ? (
        <>
          <p className="job-selector-label" style={{ marginTop: 24, marginBottom: 8, fontSize: '0.9rem', color: 'var(--muted)' }}>
            ログインして業務を開始してください
          </p>
          <button
            type="button"
            className="start-btn entrance-login-btn"
            onClick={() => setShowSignInModal(true)}
            aria-label="ログイン"
            style={{ marginTop: 16, position: 'relative', zIndex: 200 }}
          >
            <PowerIcon />
            <span className="start-btn-label">ログイン</span>
          </button>
        </>
      ) : !started ? (
        <>
          {effectiveUser.role && (
            <p className="job-selector-label" style={{ marginTop: 16, marginBottom: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
              現在のロール: {effectiveUser.role}
            </p>
          )}
          <button
            type="button"
            className="start-btn entrance-login-btn"
            onClick={handleEnter}
            aria-label="業務開始（入室）"
            style={{ marginTop: 40, position: 'relative', zIndex: 200 }}
          >
            <PowerIcon />
            <span className="start-btn-label">入室</span>
          </button>
        </>
      ) : (() => {
        const role = (effectiveUser.role && String(effectiveUser.role).trim()) || '';
        const hasDirectEntrance = !!ROLE_TO_ENTRANCE[role] || (role.startsWith('single:') && (() => { const j = role.replace('single:', ''); return j === 'admin' || JOB_ENTRANCE_KEYS.includes(j); })());
        return started && !hasDirectEntrance;
      })() ? (
        <>
          {effectiveUser.name && (
            <p className="job-selector-label" style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--muted)' }}>
              {effectiveUser.name} さん
            </p>
          )}
          {effectiveUser.role && (
            <p className="job-selector-label" style={{ marginTop: 4, marginBottom: 4, fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.9 }}>
              現在のロール: {effectiveUser.role}
            </p>
          )}
          <p className="job-selector-label" style={{ marginTop: 8, marginBottom: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
            ジョブを選んで入室
          </p>
          <div className="job-selector">
            {JOB_ENTRANCE_KEYS.map((key) => {
              const job = JOBS[key];
              if (!job) return null;
              const to = key === 'admin' ? '/admin/entrance' : `/jobs/${key}/entrance`;
              return (
                <Link
                  key={key}
                  to={to}
                  className="job-btn"
                  style={{ ['--job-btn-color']: job.color }}
                >
                  <span className="job-btn-dot" style={{ background: job.color }} aria-hidden="true" />
                  {job.label}
                </Link>
              );
            })}
          </div>
        </>
      ) : null}

      <p style={{ marginTop: 16, fontSize: '0.85rem' }}>
        <Link to="/">Portal（トップ）に戻る</Link>
        {isAuthenticated && (
          <>
            {' · '}
            <button
              type="button"
              onClick={logout}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--job-sales)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}
            >
              ログアウト
            </button>
          </>
        )}
        {' · '}
        <Link to="/sales/store/demo">営業カルテ</Link>
      </p>

      {showSignInModal && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg)' }}>読み込み中...</div>}>
          <SignInModal
            onClose={() => setShowSignInModal(false)}
            onSuccess={() => {
              refresh();
              setShowSignInModal(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/** 電源アイコン（ログインボタン用） */
function PowerIcon() {
  return (
    <svg
      viewBox="0 0 1160 1280"
      preserveAspectRatio="xMidYMid meet"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      <g transform="translate(0, 1280) scale(0.1, -0.1)">
        <path d="M5620 12785 c-244 -39 -488 -168 -656 -348 -171 -184 -270 -392 -309 -647 -22 -143 -22 -4877 0 -5020 20 -132 49 -229 100 -338 170 -358 489 -599 872 -657 562 -85 1094 247 1272 793 64 195 61 59 61 2712 0 2655 3 2517 -61 2713 -178 545 -720 880 -1279 792z" />
        <path d="M2510 10355 c-8 -2 -49 -9 -90 -15 -208 -34 -430 -150 -588 -308 -553 -551 -926 -1059 -1231 -1672 -383 -772 -576 -1556 -597 -2430 -34 -1339 407 -2662 1235 -3710 272 -345 645 -717 986 -986 713 -559 1565 -950 2448 -1123 406 -80 677 -105 1127 -105 467 0 735 26 1170 114 2252 455 4055 2258 4510 4510 88 436 113 696 114 1165 0 376 -10 532 -55 840 -160 1102 -637 2138 -1371 2972 -154 175 -260 284 -272 280 -6 -3 -49 26 -96 64 -101 82 -287 178 -410 213 -283 80 -614 42 -867 -100 -678 -379 -808 -1289 -261 -1832 46 -45 109 -101 141 -125 104 -76 320 -369 469 -634 421 -753 543 -1634 343 -2478 -296 -1249 -1271 -2245 -2518 -2575 -490 -129 -1017 -149 -1528 -60 -480 84 -977 291 -1383 574 -309 216 -631 533 -852 841 -455 633 -683 1413 -643 2197 39 763 313 1458 811 2055 105 126 149 171 336 349 220 209 338 471 349 777 6 159 -5 248 -49 392 -54 179 -151 339 -288 475 -174 175 -389 285 -630 325 -82 13 -264 19 -310 10z" />
      </g>
    </svg>
  );
}
