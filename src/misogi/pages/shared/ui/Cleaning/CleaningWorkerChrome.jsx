import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Hotbar from '../Hotbar/Hotbar';
import { useAuth } from '../../auth/useAuth';
import './cleaning-worker-chrome.css';

const NAV_HOTBAR_ACTIONS = [
  { id: 'report', label: '報告', to: '/jobs/cleaning/houkoku', icon: 'report' },
  { id: 'plan', label: '予定', to: '/jobs/cleaning/yotei', icon: 'plan' },
  { id: 'tools', label: 'ツール', to: '/jobs/cleaning/availability-declare', icon: 'tools' },
  { id: 'settings', label: '設定', to: '/jobs/cleaning/entrance', icon: 'settings' },
];

const YOTEI_DETAIL_HOTBAR_ACTIONS = [
  { id: 'detail', label: '詳細', icon: 'preview' },
  { id: 'history', label: '履歴', icon: 'history' },
  { id: 'report', label: '報告', icon: 'report' },
  { id: 'tools', label: 'ツール', icon: 'tools' },
];

const BRIEFING_UNLOCK_STORAGE_KEY = 'misogi-v2-cleaning-briefing-unlocked';
const BRIEFING_DECLARATION_ACCEPTED_STORAGE_KEY = 'misogi-v2-cleaning-briefing-declaration-accepted';

function activeByPath(pathname) {
  const p = String(pathname || '/');
  if (/^\/jobs\/cleaning\/(?:houkoku|report)(?:\/|$)/.test(p)) return 'report';
  if (/^\/jobs\/cleaning\/(?:yotei|schedule|clients)(?:\/|$)/.test(p)) return 'plan';
  if (/^\/jobs\/cleaning\/availability-declare(?:\/|$)/.test(p)) return 'tools';
  if (/^\/jobs\/cleaning\/mypage(?:\/|$)/.test(p)) return 'settings';
  if (/^\/jobs\/cleaning\/entrance(?:\/|$)/.test(p)) return 'settings';
  return '';
}

function normalizeDetailTab(v) {
  const tab = String(v || '').toLowerCase();
  if (tab === 'detail' || tab === 'history' || tab === 'report' || tab === 'tools') return tab;
  return '';
}

function normId(v) {
  return String(v || '').trim().toLowerCase();
}

function isBriefingUnlocked(yoteiId) {
  const key = normId(yoteiId);
  if (!key) return false;
  try {
    const raw = localStorage.getItem(BRIEFING_UNLOCK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && parsed[key] === true;
  } catch {
    return false;
  }
}

function isDeclarationAccepted(yoteiId) {
  const key = normId(yoteiId);
  if (!key) return false;
  try {
    const raw = localStorage.getItem(BRIEFING_DECLARATION_ACCEPTED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && parsed[key] === true;
  } catch {
    return false;
  }
}

export default function CleaningWorkerChrome({ showNavHotbar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const pathname = location?.pathname || '/';
  const search = location?.search || '';
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const isYoteiSingleView = useMemo(() => (
    /^\/jobs\/cleaning\/yotei(?:\/|$)/.test(pathname) && String(query.get('view') || '').toLowerCase() === 'single'
  ), [pathname, query]);
  const briefingCheckedByQuery = String(query.get('briefing_checked') || '') === '1';
  const focusYoteiId = String(query.get('yotei_id') || '');
  const briefingChecked = useMemo(() => {
    if (!isYoteiSingleView) return false;
    if (briefingCheckedByQuery) return true;
    return isBriefingUnlocked(focusYoteiId);
  }, [isYoteiSingleView, briefingCheckedByQuery, focusYoteiId, search]);
  const declarationAccepted = useMemo(() => {
    if (!isYoteiSingleView) return true;
    return isDeclarationAccepted(focusYoteiId);
  }, [isYoteiSingleView, focusYoteiId, search]);
  const active = useMemo(() => {
    if (isYoteiSingleView) {
      if (!declarationAccepted) return '';
      const tab = normalizeDetailTab(query.get('tab'));
      if (tab) return tab;
      if (briefingChecked) return 'detail';
      return '';
    }
    return activeByPath(pathname);
  }, [isYoteiSingleView, pathname, query, declarationAccepted, briefingChecked]);
  const showSingleBriefingHint = isYoteiSingleView && declarationAccepted && !briefingChecked && active !== 'detail';
  const hotbarActions = useMemo(() => {
    if (!isYoteiSingleView) return NAV_HOTBAR_ACTIONS;
    if (!declarationAccepted) {
      return YOTEI_DETAIL_HOTBAR_ACTIONS.map((a) => ({ ...a, disabled: true }));
    }
    return YOTEI_DETAIL_HOTBAR_ACTIONS.map((a) => ({
      ...a,
      disabled: !briefingChecked && a.id !== 'detail',
    }));
  }, [isYoteiSingleView, briefingChecked, declarationAccepted]);

  const onBack = () => {
    navigate('/jobs/cleaning/entrance');
  };

  const onAuth = () => {
    if (isAuthenticated) {
      logout?.();
      return;
    }
    navigate('/');
  };

  return (
    <>
      <nav className="cleaning-worker-topbar" aria-label="清掃ヘッダー">
        <button
          type="button"
          className="cleaning-worker-topbar-btn"
          onClick={onBack}
          aria-label="エントランス"
          title="エントランス"
        >
          ← エントランス
        </button>
        <button
          type="button"
          className="cleaning-worker-topbar-btn"
          onClick={onAuth}
          aria-label={isAuthenticated ? 'ログアウト' : 'ログイン'}
          title={isAuthenticated ? 'ログアウト' : 'ログイン'}
        >
          {isAuthenticated ? 'ログアウト' : 'ログイン'}
        </button>
      </nav>
      {showNavHotbar ? (
        <div className="cleaning-worker-nav-hotbar">
          {showSingleBriefingHint ? (
            <div className="cleaning-worker-hotbar-hint" role="status" aria-live="polite">
              <span className="hint-arrow" aria-hidden="true">↓</span>
              <span className="hint-text">詳細を押して確認を開始</span>
            </div>
          ) : null}
          <Hotbar
            actions={hotbarActions}
            active={active}
            onChange={(id) => {
              if (isYoteiSingleView) {
                if (!declarationAccepted) return;
                if (!briefingChecked && id !== 'detail') return;
                const next = new URLSearchParams(search);
                next.set('view', 'single');
                if (normalizeDetailTab(id)) next.set('tab', normalizeDetailTab(id));
                else next.delete('tab');
                navigate(`${pathname}?${next.toString()}`);
                return;
              }
              const action = NAV_HOTBAR_ACTIONS.find((a) => a.id === id);
              if (!action?.to) return;
              navigate(action.to);
            }}
            showFlowGuideButton={false}
          />
        </div>
      ) : null}
    </>
  );
}
