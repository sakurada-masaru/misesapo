import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/useAuth';
import '../../shared/styles/components.css';

const API_BASE =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    ? '/api'
    : (import.meta.env?.VITE_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod');

/**
 * 玄関（Portal）の稼働日・非稼働日設定
 * - 非稼働日を日付リストで管理
 * - Portal で本日が非稼働日のとき「本日は休業日です」を表示
 */
export default function AdminPortalOperatingDaysPage() {
  const { user, isAuthenticated, getToken } = useAuth();
  const [nonOperatingDates, setNonOperatingDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = API_BASE.replace(/\/$/, '');
      const res = await fetch(`${base}/settings/portal-operating-days`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setNonOperatingDates(Array.isArray(data.non_operating_dates) ? data.non_operating_dates : []);
    } catch (e) {
      setError('取得に失敗しました');
      setNonOperatingDates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (newDates) => {
    const token = getToken();
    if (!token) {
      setError('認証が必要です');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const base = API_BASE.replace(/\/$/, '');
      const res = await fetch(`${base}/settings/portal-operating-days`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ non_operating_dates: newDates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setNonOperatingDates(data.non_operating_dates || newDates);
    } catch (e) {
      setError(e.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [getToken]);

  const handleAdd = () => {
    const d = addDate.trim();
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setError('日付は YYYY-MM-DD 形式で入力してください');
      return;
    }
    if (nonOperatingDates.includes(d)) {
      setError('既に登録されています');
      return;
    }
    const next = [...nonOperatingDates, d].sort();
    setAddDate('');
    setError(null);
    save(next);
  };

  const handleRemove = (date) => {
    const next = nonOperatingDates.filter((x) => x !== date);
    save(next);
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="report-page" style={{ padding: 24, textAlign: 'center' }}>
        <p>認証が必要です</p>
        <Link to="/">Portal へ戻る</Link>
      </div>
    );
  }

  return (
    <div className="report-page" data-job="admin" style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link to="/admin/entrance" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← 管理エントランス</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem', marginBottom: 8 }}>玄関の稼働日設定</h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 24 }}>
        非稼働日（休業日）に設定した日は、Portal（玄関）で「本日は休業日です」と表示されます。入室は可能です。
      </p>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 8, color: 'var(--text)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="date"
          value={addDate}
          onChange={(e) => setAddDate(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel-bg)', color: 'var(--text)' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || loading}
          style={{ padding: '10px 16px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 8, cursor: saving || loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
        >
          {saving ? '保存中...' : '非稼働日を追加'}
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>読み込み中...</p>
      ) : (
        <>
          <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>非稼働日一覧（{nonOperatingDates.length}件）</h2>
          {nonOperatingDates.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>登録されていません。上で日付を追加してください。</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {nonOperatingDates.map((date) => (
                <li
                  key={date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    marginBottom: 6,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{date}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(date)}
                    disabled={saving}
                    style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 6, color: 'var(--text)', cursor: saving ? 'not-allowed' : 'pointer' }}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
