import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../api/gatewayBase';
import { useFlashTransition } from '../ReportTransition/reportTransition';
import Visualizer from '../Visualizer/Visualizer';
import '../../styles/components.css';

const API_BASE = (() => {
  if (typeof window !== 'undefined') {
    const h = String(window.location?.hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') return '/api';
  }
  return normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
})();

const STATUS_LABELS = {
  appointment: 'アポ',
  estimate: '見積',
  survey: '現調',
  screening: '審査',
  negotiating: '交渉',
};
const STATUS_OPTIONS = [
  { value: 'appointment', label: 'アポ' },
  { value: 'estimate', label: '見積' },
  { value: 'survey', label: '現調' },
  { value: 'screening', label: '審査' },
  { value: 'negotiating', label: '交渉' },
];

function readToken() {
  try {
    return (
      localStorage.getItem('cognito_id_token') ||
      JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token ||
      ''
    );
  } catch {
    return '';
  }
}

function ymd(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function pickStoreId(store) {
  return String(store?.id || store?.store_id || '').trim();
}

export default function SalesFirstResponsePage() {
  const navigate = useNavigate();
  const { startTransition } = useFlashTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stores, setStores] = useState([]);
  const [mode, setMode] = useState('overdue');
  const [q, setQ] = useState('');
  const [editingById, setEditingById] = useState({});
  const [draftById, setDraftById] = useState({});
  const [savingById, setSavingById] = useState({});
  const [saveErrorById, setSaveErrorById] = useState({});

  const today = todayYmd();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const token = readToken();
        const res = await fetch(`${API_BASE}/stores`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) throw new Error(`一次対応一覧の取得に失敗 (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          const items = Array.isArray(data) ? data : (data.items || []);
          setStores(items);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || '一次対応一覧の取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const candidates = useMemo(() => {
    return (stores || []).filter((s) => {
      const registrationType = String(s?.registration_type || '').toLowerCase();
      return (
        registrationType.includes('lead') ||
        String(s?.lead_status || '').trim() ||
        String(s?.next_action_date || '').trim() ||
        String(s?.next_action_content || '').trim()
      );
    });
  }, [stores]);

  const filtered = useMemo(() => {
    const query = String(q || '').trim().toLowerCase();
    const byMode = candidates.filter((s) => {
      const due = ymd(s?.next_action_date);
      if (mode === 'all') return true;
      if (mode === 'overdue') return !!due && due < today;
      if (mode === 'today') return due === today;
      if (mode === 'upcoming') return !!due && due > today;
      if (mode === 'unscheduled') return !due;
      return true;
    });
    const byQuery = !query ? byMode : byMode.filter((s) => {
      const hay = [
        s?.company_name,
        s?.brand_name,
        s?.name,
        s?.contact_person,
        s?.phone,
        s?.email,
        s?.next_action_content,
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return hay.includes(query);
    });
    return byQuery.sort((a, b) => {
      const da = ymd(a?.next_action_date);
      const db = ymd(b?.next_action_date);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
  }, [candidates, mode, q, today]);

  const countBy = useMemo(() => {
    const out = { all: candidates.length, overdue: 0, today: 0, upcoming: 0, unscheduled: 0 };
    for (const s of candidates) {
      const due = ymd(s?.next_action_date);
      if (!due) out.unscheduled += 1;
      else if (due < today) out.overdue += 1;
      else if (due === today) out.today += 1;
      else out.upcoming += 1;
    }
    return out;
  }, [candidates, today]);

  const beginEdit = (store) => {
    const id = pickStoreId(store);
    if (!id) return;
    setEditingById((prev) => ({ ...prev, [id]: true }));
    setSaveErrorById((prev) => ({ ...prev, [id]: '' }));
    setDraftById((prev) => ({
      ...prev,
      [id]: {
        lead_status: String(store?.lead_status || 'appointment'),
        next_action_date: ymd(store?.next_action_date),
        next_action_content: String(store?.next_action_content || ''),
      },
    }));
  };

  const cancelEdit = (store) => {
    const id = pickStoreId(store);
    if (!id) return;
    setEditingById((prev) => ({ ...prev, [id]: false }));
    setSaveErrorById((prev) => ({ ...prev, [id]: '' }));
  };

  const updateDraft = (id, key, value) => {
    setDraftById((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value,
      },
    }));
  };

  const saveResponse = async (store) => {
    const id = pickStoreId(store);
    if (!id) return;
    const draft = draftById[id] || {};
    const nextActionContent = String(draft?.next_action_content || '').trim();
    if (!nextActionContent) {
      setSaveErrorById((prev) => ({ ...prev, [id]: '次回対応内容は必須です。' }));
      return;
    }
    setSavingById((prev) => ({ ...prev, [id]: true }));
    setSaveErrorById((prev) => ({ ...prev, [id]: '' }));
    try {
      const token = readToken();
      const payload = {
        lead_status: String(draft?.lead_status || store?.lead_status || 'appointment'),
        next_action_date: String(draft?.next_action_date || ''),
        next_action_content: nextActionContent,
        updated_at: new Date().toISOString(),
      };
      const res = await fetch(`${API_BASE}/stores/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`保存失敗 (${res.status})`);
      let updated = null;
      try {
        updated = await res.json();
      } catch {
        updated = null;
      }
      setStores((prev) => (prev || []).map((it) => {
        if (pickStoreId(it) !== id) return it;
        return { ...it, ...payload, ...(updated && typeof updated === 'object' ? updated : {}) };
      }));
      setEditingById((prev) => ({ ...prev, [id]: false }));
    } catch (e) {
      setSaveErrorById((prev) => ({ ...prev, [id]: e?.message || '保存に失敗しました' }));
    } finally {
      setSavingById((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="report-page" data-job="sales">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>

      <div className="report-page-content" style={{ paddingTop: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <button
            onClick={() => startTransition('/jobs/sales/entrance')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--fg)',
              width: 40,
              height: 40,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              marginRight: 12,
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600 }}>一次対応インボックス</h1>
        </div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="会社名 / 店舗名 / 担当者 / 連絡先 / 次回対応で検索"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--fg)',
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              ['overdue', '期限超過'],
              ['today', '本日'],
              ['upcoming', '先日程'],
              ['unscheduled', '期限未設定'],
              ['all', 'すべて'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: mode === k ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.16)',
                  background: mode === k ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                  color: 'var(--fg)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {label} ({countBy[k] || 0})
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="job-entrance-dummy">読み込み中...</p> : null}
        {error ? <p style={{ color: '#fecaca', marginBottom: 12 }}>{error}</p> : null}

        {!loading && !filtered.length ? (
          <div style={{ padding: 16, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.04)' }}>
            一次対応が必要な案件はありません。
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 10, paddingBottom: 24 }}>
          {filtered.map((s, idx) => {
            const storeId = pickStoreId(s);
            const canEdit = !!storeId;
            const editing = !!editingById[storeId];
            const saving = !!savingById[storeId];
            const draft = draftById[storeId] || {
              lead_status: String(s?.lead_status || 'appointment'),
              next_action_date: ymd(s?.next_action_date),
              next_action_content: String(s?.next_action_content || ''),
            };
            const saveErr = String(saveErrorById[storeId] || '');
            const due = ymd(s?.next_action_date);
            const overdue = !!due && due < today;
            return (
              <section
                key={storeId || `row-${idx}`}
                style={{
                  border: overdue ? '1px solid rgba(239,68,68,0.55)' : '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{s?.company_name || s?.brand_name || '（会社名未設定）'}</div>
                    <div style={{ opacity: 0.85 }}>{s?.name || '（店舗名未設定）'}</div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      {s?.contact_person ? `担当: ${s.contact_person}` : '担当: -'} / {s?.phone || s?.email || '-'}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.2)' }}>
                    {STATUS_LABELS[s?.lead_status] || s?.lead_status || '未設定'}
                  </span>
                </div>

                <div style={{ marginTop: 8, fontSize: 12 }}>
                  次回対応: <strong style={{ color: overdue ? '#fca5a5' : 'inherit' }}>{due || '未設定'}</strong>
                  {s?.next_action_content ? ` / ${s.next_action_content}` : ''}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/leads/${encodeURIComponent(String(s?.id || ''))}`)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--fg)',
                      fontSize: 12,
                    }}
                  >
                    詳細
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/report-day?date=${today}`)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid #3b82f6',
                      background: 'rgba(59,130,246,0.18)',
                      color: 'var(--fg)',
                      fontSize: 12,
                    }}
                  >
                    日報記録
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => (editing ? cancelEdit(s) : beginEdit(s))}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--fg)',
                        fontSize: 12,
                      }}
                    >
                      {editing ? '入力を閉じる' : '対応結果入力'}
                    </button>
                  ) : null}
                </div>

                {editing ? (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(15,23,42,0.55)', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                        <span>進捗ステータス</span>
                        <select
                          value={draft.lead_status}
                          onChange={(e) => updateDraft(storeId, 'lead_status', e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'var(--fg)' }}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                        <span>次回対応日</span>
                        <input
                          type="date"
                          value={draft.next_action_date}
                          onChange={(e) => updateDraft(storeId, 'next_action_date', e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'var(--fg)' }}
                        />
                      </label>
                    </div>
                    <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                      <span>次回対応内容（必須）</span>
                      <textarea
                        rows={3}
                        value={draft.next_action_content}
                        onChange={(e) => updateDraft(storeId, 'next_action_content', e.target.value)}
                        placeholder="例: 2/26 16:00に見積書送付、2/27電話フォロー"
                        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'var(--fg)' }}
                      />
                    </label>
                    {saveErr ? <div style={{ color: '#fecaca', fontSize: 12 }}>{saveErr}</div> : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveResponse(s)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #3b82f6',
                          background: 'rgba(59,130,246,0.2)',
                          color: 'var(--fg)',
                          fontSize: 12,
                        }}
                      >
                        {saving ? '保存中...' : '対応結果を保存'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => cancelEdit(s)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--fg)',
                          fontSize: 12,
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
