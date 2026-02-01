import React, { useState, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';
import { JOBS } from '../../shared/utils/constants';
import { useAuth } from '../../shared/auth/useAuth';

const SignInModal = React.lazy(() => import('../../shared/auth/SignInModal'));

/**
 * 大前提（ナビゲーション）
 * - Portal = ジョブを選ぶシステムの玄関
 * - エントランス = 各部署の窓口
 * - 各部署のホットバーはエントランスになくてはならない（ジョブ切替はエントランスから）
 */
const JOB_ENTRANCE_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];

/**
 * Misogi Portal（認証・業務開始意思表示・role により遷移）
 * - 未認証: 「ログイン」→ サインインページへ（ログイン後に Portal へ戻る）
 * - 認証済: 「入室」→ role=admin なら /admin/entrance、single:sales 等なら該当エントランス、それ以外はジョブ選択
 */
export default function Portal() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, refresh, logout } = useAuth();
  const [started, setStarted] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

  const effectiveUser = user ?? { id: 'guest', name: '', role: '' };

  function handleEnter() {
    setStarted(true);
    if (effectiveUser.role === 'admin') {
      navigate('/admin/entrance');
      return;
    }
    if (effectiveUser.role && String(effectiveUser.role).startsWith('single:')) {
      const job = String(effectiveUser.role).replace('single:', '');
      if (job === 'admin') {
        navigate('/admin/entrance');
        return;
      }
      if (JOB_ENTRANCE_KEYS.includes(job)) {
        navigate(`/jobs/${job}/entrance`);
        return;
      }
    }
    // multi or fallback: 画面に job 選択を表示
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
      ) : effectiveUser.role === 'multi' || !String(effectiveUser.role || '').startsWith('single:') ? (
        <>
          {effectiveUser.name && (
            <p className="job-selector-label" style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--muted)' }}>
              {effectiveUser.name} さん
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
