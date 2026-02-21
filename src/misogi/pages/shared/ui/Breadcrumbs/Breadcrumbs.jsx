import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './breadcrumbs.css';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';

function isEntrancePath(pathname) {
  const p = String(pathname || '/');
  if (p === '/' || p === '/portal' || p === '/entrance') return true;
  if (p === '/admin/entrance') return true;
  if (/^\/jobs\/[^/]+\/entrance$/.test(p)) return true;
  return false;
}

function isWorkerReportPath(pathname) {
  const p = String(pathname || '/');
  // 現場の報告画面は余計なUIを増やさない（AGENTS.md ルール優先）
  if (/^\/jobs\/[^/]+\/report$/.test(p)) return true;
  return false;
}

function labelForPath(pathname) {
  const p = String(pathname || '/');

  // Admin
  if (p === '/admin') return '管理TOP';
  if (p === '/admin/kadai') return 'Kadaiリスト';
  if (p === '/admin/houkoku') return '報告一覧';
  if (p.startsWith('/admin/houkoku/')) return '報告詳細';
  if (p === '/admin/yotei') return '予定';
  if (p === '/admin/ugoki') return 'UGOKI';
  if (p === '/admin/yakusoku') return 'YAKUSOKU';
  if (p === '/admin/torihikisaki-touroku') return '顧客登録';
  if (p === '/admin/torihikisaki-meibo') return '取引先名簿';
  if (p === '/admin/jinzai-meibo') return '人材名簿';
  if (p.startsWith('/admin/tenpo/')) return '店舗カルテ';
  if (p === '/admin/master/torihikisaki') return '取引先マスタ';
  if (p === '/admin/master/yagou') return '屋号マスタ';
  if (p === '/admin/master/tenpo') return '店舗マスタ';
  if (p === '/admin/master/souko') return '顧客ストレージ';
  if (p === '/admin/master/jinzai') return '人材マスタ';
  if (p === '/admin/master/jinzai-busho') return '人材部署';
  if (p === '/admin/master/jinzai-shokushu') return '人材職種';
  if (p === '/admin/master/service') return 'サービスマスタ';
  if (p === '/admin/master/zaiko') return '在庫管理DB';
  if (p === '/admin/master/zaiko-order') return '在庫発注フォーム';

  // Jobs (v2)
  if (/^\/jobs\/[^/]+\/yotei$/.test(p)) return '予定';

  // Sales / Office / Cleaning / Dev (minimal)
  if (p.startsWith('/sales/')) return '営業';
  if (p.startsWith('/office/')) return '事務';
  if (p.startsWith('/jobs/sales/')) return '営業';
  if (p.startsWith('/jobs/office/')) return '事務';
  if (p.startsWith('/jobs/cleaning/')) return '清掃';
  if (p.startsWith('/jobs/dev/')) return '開発';

  // Fallback: last segment
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Page';
}

function crumbsForPath(pathname) {
  const p = String(pathname || '/');
  const crumbs = [{ to: '/', label: 'Portal' }];

  if (p.startsWith('/admin')) {
    crumbs.push({ to: '/admin/entrance', label: '管理' });
  } else if (p.startsWith('/sales')) {
    crumbs.push({ to: '/jobs/sales/entrance', label: '営業' });
  } else if (p.startsWith('/office')) {
    crumbs.push({ to: '/jobs/office/entrance', label: '事務' });
  } else if (p.startsWith('/jobs/sales')) {
    crumbs.push({ to: '/jobs/sales/entrance', label: '営業' });
  } else if (p.startsWith('/jobs/office')) {
    crumbs.push({ to: '/jobs/office/entrance', label: '事務' });
  } else if (p.startsWith('/jobs/cleaning')) {
    crumbs.push({ to: '/jobs/cleaning/entrance', label: '清掃' });
  } else if (p.startsWith('/jobs/dev')) {
    crumbs.push({ to: '/jobs/dev/entrance', label: '開発' });
  }

  const currentLabel = labelForPath(p);
  crumbs.push({ to: p, label: currentLabel });

  // Remove consecutive duplicates by `to` (keep the last occurrence)
  const compact = [];
  for (const c of crumbs) {
    const prev = compact[compact.length - 1];
    if (prev && prev.to === c.to) {
      compact[compact.length - 1] = c;
    } else {
      compact.push(c);
    }
  }
  return compact;
}

export default function Breadcrumbs() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location?.pathname || '/';

  const hidden = isEntrancePath(pathname) || isWorkerReportPath(pathname);
  const crumbs = useMemo(() => crumbsForPath(pathname), [pathname]);
  const onBack = () => {
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  if (hidden) {
    return (
      <nav className="breadcrumbs breadcrumbs-lang-only" aria-label="ヘッダーメニュー">
        <button type="button" className="breadcrumbs-back" onClick={onBack} aria-label="一つ前の画面に戻る">
          ← 戻る
        </button>
        <div className="breadcrumbs-lang-wrap">
          <HamburgerMenu />
        </div>
      </nav>
    );
  }

  return (
    <nav className="breadcrumbs" aria-label="パンくず">
      <button type="button" className="breadcrumbs-back" onClick={onBack} aria-label="一つ前の画面に戻る">
        ← 戻る
      </button>
      <div className="breadcrumbs-main">
        {crumbs.map((c, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <span key={`${c.to}-${idx}`} className="breadcrumbs-item">
              {isLast ? (
                <span className="breadcrumbs-current">{c.label}</span>
              ) : (
                <Link className="breadcrumbs-link" to={c.to}>{c.label}</Link>
              )}
              {!isLast ? <span className="breadcrumbs-sep" aria-hidden="true">/</span> : null}
            </span>
          );
        })}
      </div>
      <div className="breadcrumbs-controls-wrap">
        <HamburgerMenu />
      </div>
    </nav>
  );
}
