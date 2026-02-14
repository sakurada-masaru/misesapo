import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './global-back-button.css';

function safeHistoryBackAvailable() {
  try {
    // Browser-dependent; keep it best-effort.
    return typeof window !== 'undefined' && window.history && window.history.length > 1;
  } catch {
    return false;
  }
}

export default function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  const fallbackTo = useMemo(() => {
    const p = String(location?.pathname || '/');
    if (p.startsWith('/admin')) return '/admin/entrance';
    if (p.startsWith('/sales')) return '/';
    if (p.startsWith('/office')) return '/';
    if (p.startsWith('/jobs/')) return '/';
    return '/';
  }, [location?.pathname]);

  const onBack = useCallback(() => {
    if (safeHistoryBackAvailable()) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  }, [navigate, fallbackTo]);

  return (
    <button
      type="button"
      className="global-back-btn"
      onClick={onBack}
      title="ひとつ前のページへ戻る"
    >
      ← 戻る
    </button>
  );
}

