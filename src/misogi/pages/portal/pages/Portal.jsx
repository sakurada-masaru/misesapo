import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';
import { JOBS } from '../../shared/utils/constants';

/** ダミー: 認証ユーザー（role: admin | multi | single:sales 等） */
const DUMMY_USER = { id: 'dummy', name: 'テストユーザー', role: 'multi' };

/**
 * 大前提（ナビゲーション）
 * - Portal = ジョブを選ぶシステムの玄関
 * - エントランス = 各部署の窓口
 * - 各部署のホットバーはエントランスになくてはならない（ジョブ切替はエントランスから）
 */
const JOB_ENTRANCE_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];

/**
 * Misogi Portal（認証仮・業務開始意思表示・role により遷移）
 * - role=admin → /admin
 * - role=multi → job選択（営業/清掃/事務/開発/管理 ボタン）
 * - role=single:sales 等 → /jobs/sales/entrance へ直接
 */
export default function Portal() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const user = DUMMY_USER;

  function handleStart() {
    setStarted(true);
    if (user.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (user.role.startsWith('single:')) {
      const job = user.role.replace('single:', '');
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

      {!started ? (
        <button
          type="button"
          className="start-btn entrance-login-btn"
          onClick={handleStart}
          aria-label="業務開始意思表示（ログイン）"
          style={{ marginTop: 40, position: 'relative', zIndex: 200 }}
        >
          <PowerIcon />
          <span className="start-btn-label">LOGIN</span>
        </button>
      ) : user.role === 'multi' || !user.role.startsWith('single:') ? (
        <>
          <p className="job-selector-label" style={{ marginTop: 24, marginBottom: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
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

      <p style={{ marginTop: 16 }}>
        <Link to="/">Portal（トップ）に戻る</Link>
        {' · '}
        <Link to="/sales/store/demo">営業カルテ</Link>
      </p>
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
