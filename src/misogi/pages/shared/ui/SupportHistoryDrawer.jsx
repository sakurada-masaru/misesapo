import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './support-history-drawer.css';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const SUPPORT_HISTORY_CATEGORIES = [
  { value: 'ops', label: '運用' },
  { value: 'claim', label: 'クレーム' },
  { value: 'request', label: '要望' },
  { value: 'schedule', label: '日程' },
  { value: 'billing', label: '請求' },
  { value: 'other', label: 'その他' },
];

function clampStr(v, max) {
  const s = String(v || '');
  if (!max) return s;
  return s.length > max ? s.slice(0, max) : s;
}

function parseYmdToInt(ymd) {
  const s = String(ymd || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Number(`${m[1]}${m[2]}${m[3]}`);
}

function sortSupportHistoryNewestFirst(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const keyed = arr.map((it, idx) => {
    const key = parseYmdToInt(it?.date);
    return { it, idx, key: key == null ? -1 : key };
  });
  keyed.sort((a, b) => {
    if (a.key !== b.key) return b.key - a.key;
    return a.idx - b.idx;
  });
  return keyed.map((x) => x.it);
}

function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getCurrentUserName() {
  try {
    const u = JSON.parse(localStorage.getItem('cognito_user') || '{}') || {};
    return String(u?.name || u?.displayName || u?.username || u?.email || '').trim();
  } catch {
    return '';
  }
}

function normalizeSupportHistory(arr) {
  const list = Array.isArray(arr) ? arr : [];
  return sortSupportHistoryNewestFirst(list
    .map((it) => {
      const legacyNote = clampStr(it?.note || '', 200);
      const topic = clampStr(it?.topic || '', 60) || (legacyNote ? clampStr(legacyNote, 60) : '');
      return {
        date: clampStr(it?.date || '', 20),
        category: clampStr(it?.category || 'ops', 20),
        requested_by: clampStr(it?.requested_by || it?.from || '', 40),
        handled_by: clampStr(it?.handled_by || it?.by || '', 80),
        topic,
        action: clampStr(it?.action || '', 120),
        outcome: clampStr(it?.outcome || '', 120),
      };
    })
    .filter((it) => it.date || it.topic || it.action || it.outcome || it.requested_by || it.handled_by));
}

async function fetchTenpo(tenpoId, headers) {
  if (!tenpoId) return null;
  const base = MASTER_API_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}/master/tenpo/${encodeURIComponent(tenpoId)}`, {
    headers: headers || {},
    cache: 'no-store',
  });
  if (res.ok) return res.json();
  // Some envs used to be unstable; surface as null to avoid freezing callers.
  return null;
}

async function saveTenpoSupportHistory(tenpoId, nextSupportHistory, headers) {
  const base = MASTER_API_BASE.replace(/\/$/, '');
  const getRes = await fetch(`${base}/master/tenpo/${encodeURIComponent(tenpoId)}`, {
    headers: headers || {},
    cache: 'no-store',
  });
  if (!getRes.ok) {
    const text = await getRes.text().catch(() => '');
    throw new Error(`店舗取得に失敗 (${getRes.status}) ${text}`.trim());
  }
  const tenpo = await getRes.json();
  const prevKarte = (tenpo?.karte_detail && typeof tenpo.karte_detail === 'object') ? tenpo.karte_detail : {};
  const nextKarte = { ...prevKarte, support_history: normalizeSupportHistory(nextSupportHistory) };

  const putRes = await fetch(`${base}/master/tenpo/${encodeURIComponent(tenpoId)}`, {
    method: 'PUT',
    headers: { ...(headers || {}), 'Content-Type': 'application/json' },
    body: JSON.stringify({ karte_detail: nextKarte }),
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    throw new Error(`保存に失敗 (${putRes.status}) ${text}`.trim());
  }
  return putRes.json();
}

export default function SupportHistoryDrawer({
  open,
  onClose,
  tenpoId,
  tenpoLabel,
  getAuthHeaders,
  canEdit = false,
}) {
  const headers = useMemo(() => (getAuthHeaders ? (getAuthHeaders() || {}) : {}), [getAuthHeaders]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tenpo, setTenpo] = useState(null);
  const [supportHistory, setSupportHistory] = useState([]);

  useEffect(() => {
    if (!open) return;
    if (!tenpoId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const tp = await fetchTenpo(tenpoId, headers);
        if (cancelled) return;
        setTenpo(tp || null);
        setSupportHistory(normalizeSupportHistory(tp?.karte_detail?.support_history));
      } catch (e) {
        if (cancelled) return;
        setTenpo(null);
        setSupportHistory([]);
        setError(e?.message || '読み込みに失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tenpoId, headers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const add = useCallback(() => {
    const handledBy = getCurrentUserName();
    setSupportHistory((prev) => {
      const cur = Array.isArray(prev) ? prev.slice() : [];
      cur.unshift({
        date: todayDate(),
        category: 'ops',
        requested_by: '',
        handled_by: clampStr(handledBy, 80),
        topic: '',
        action: '',
        outcome: '',
      });
      return cur;
    });
  }, []);

  const update = useCallback((idx, patch) => {
    setSupportHistory((prev) => {
      const cur = Array.isArray(prev) ? prev.slice() : [];
      if (!cur[idx]) return prev;
      const it = { ...(cur[idx] || {}) };
      const p = patch || {};
      const touchedDate = p.date !== undefined;
      if (touchedDate) it.date = clampStr(p.date, 20);
      if (p.category !== undefined) it.category = clampStr(p.category, 20);
      if (p.requested_by !== undefined) it.requested_by = clampStr(p.requested_by, 40);
      if (p.handled_by !== undefined) it.handled_by = clampStr(p.handled_by, 120);
      if (p.topic !== undefined) it.topic = clampStr(p.topic, 60);
      if (p.action !== undefined) it.action = clampStr(p.action, 120);
      if (p.outcome !== undefined) it.outcome = clampStr(p.outcome, 120);
      cur[idx] = it;
      return touchedDate ? sortSupportHistoryNewestFirst(cur) : cur;
    });
  }, []);

  const remove = useCallback((idx) => {
    setSupportHistory((prev) => {
      const cur = Array.isArray(prev) ? prev.slice() : [];
      return cur.filter((_, i) => i !== idx);
    });
  }, []);

  const save = useCallback(async () => {
    if (!tenpoId) return;
    setSaving(true);
    setError('');
    try {
      const updated = await saveTenpoSupportHistory(tenpoId, supportHistory, headers);
      setTenpo(updated);
      setSupportHistory(normalizeSupportHistory(updated?.karte_detail?.support_history));
    } catch (e) {
      setError(e?.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [tenpoId, supportHistory, headers]);

  if (!open) return null;

  const displayName = String(tenpo?.name || tenpoLabel || '').trim();
  const displayAddress = String(tenpo?.address || '').trim();
  const displayPhone = String(tenpo?.phone || '').trim();

  return (
    <div className="shd-overlay" role="dialog" aria-modal="true" aria-label="対応履歴">
      <div className="shd-backdrop" onClick={() => onClose?.()} />
      <div className="shd-drawer">
        <div className="shd-head">
          <div className="shd-title">
            <div className="k">対応履歴</div>
            <div className="v">
              {displayName ? displayName : (tenpoId || '')}
            </div>
            {(displayAddress || displayPhone) ? (
              <div className="sub">
                {displayAddress ? <span className="seg">{displayAddress}</span> : null}
                {displayPhone ? <span className="seg">{displayPhone}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="shd-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onClose?.()}>閉じる</button>
            {canEdit ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={add}>追加</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {loading ? <div className="shd-muted">読み込み中...</div> : null}
        {error ? <div className="shd-error">{error}</div> : null}

        {!loading && !error && supportHistory.length === 0 ? (
          <div className="shd-muted">対応履歴はまだありません。</div>
        ) : null}

        <div className="shd-body">
          {supportHistory.map((h, i) => (
            <div key={`${h.date}-${i}`} className="shd-card">
              <div className="shd-card-head">
                <div className="shd-card-title">
                  <span className="date">{h.date || '—'}</span>
                  <span className="dot">•</span>
                  <span className="cat">
                    {(SUPPORT_HISTORY_CATEGORIES.find((c) => c.value === h.category)?.label) || h.category || '-'}
                  </span>
                </div>
                {canEdit ? (
                  <button type="button" className="shd-x" onClick={() => remove(i)} aria-label="削除">×</button>
                ) : null}
              </div>

              {canEdit ? (
                <div className="shd-grid">
                  <label className="f">
                    <div className="lbl">日付</div>
                    <input type="date" value={h.date || ''} onChange={(e) => update(i, { date: e.target.value })} />
                  </label>
                  <label className="f">
                    <div className="lbl">区分</div>
                    <select value={h.category || 'ops'} onChange={(e) => update(i, { category: e.target.value })}>
                      {SUPPORT_HISTORY_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="f full">
                    <div className="lbl">起点（誰から）</div>
                    <input value={h.requested_by || ''} onChange={(e) => update(i, { requested_by: e.target.value })} />
                  </label>
                  <label className="f full">
                    <div className="lbl">対応（誰が）</div>
                    <input value={h.handled_by || ''} onChange={(e) => update(i, { handled_by: e.target.value })} />
                  </label>
                  <label className="f full">
                    <div className="lbl">要件（何の件）</div>
                    <input value={h.topic || ''} onChange={(e) => update(i, { topic: e.target.value })} />
                  </label>
                  <label className="f full">
                    <div className="lbl">対応（何をした）</div>
                    <input value={h.action || ''} onChange={(e) => update(i, { action: e.target.value })} />
                  </label>
                  <label className="f full">
                    <div className="lbl">結果（どうなった）</div>
                    <input value={h.outcome || ''} onChange={(e) => update(i, { outcome: e.target.value })} />
                  </label>
                </div>
              ) : (
                <div className="shd-read">
                  <div className="row"><span className="k">起点</span><span className="v">{h.requested_by || '—'}</span></div>
                  <div className="row"><span className="k">対応</span><span className="v">{h.handled_by || '—'}</span></div>
                  <div className="row"><span className="k">要件</span><span className="v">{h.topic || '—'}</span></div>
                  <div className="row"><span className="k">対応内容</span><span className="v">{h.action || '—'}</span></div>
                  <div className="row"><span className="k">結果</span><span className="v">{h.outcome || '—'}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
