import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminMasterBase from './AdminMasterBase';

const SUBMITTER_FILTER_ALL = '__ALL__';

function todayYmd() {
  try {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const JINZAI_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-jinzai'
    : (import.meta.env?.VITE_JINZAI_API_BASE || '/api-jinzai');

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizeYmd(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Find YYYY-MM-DD or YYYY/MM/DD anywhere (allow suffix like "(We)" or time).
  const m1 = raw.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const mo = String(Number(m1[2]) || 0).padStart(2, '0');
    const d = String(Number(m1[3]) || 0).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  // Allow compact YYYYMMDD (ex: 20260218) anywhere.
  const m2 = raw.match(/(\d{4})(\d{2})(\d{2})/);
  if (m2) {
    const y = m2[1];
    const mo = String(Number(m2[2]) || 0).padStart(2, '0');
    const d = String(Number(m2[3]) || 0).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  // Allow Japanese date "YYYY年M月D日" anywhere.
  const m3 = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m3) {
    const y = m3[1];
    const mo = String(Number(m3[2]) || 0).padStart(2, '0');
    const d = String(Number(m3[3]) || 0).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  // Fallback: Date parse (handles RFC3339-ish).
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  return '';
}

function shiftMonth(ymd, delta) {
  const raw = String(ymd || todayYmd());
  const [ys, ms] = raw.split('-');
  const y = Number(ys || 0);
  const m = Number(ms || 1);
  const d = new Date(y, Math.max(0, m - 1 + Number(delta || 0)), 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function monthLabelFromYm(ym) {
  const [y, m] = String(ym || '').split('-');
  return `${y || ''}年${Number(m || 0)}月`;
}

function monthDays(ymd) {
  const raw = String(ymd || todayYmd());
  const [ys, ms] = raw.split('-');
  const y = Number(ys || 0);
  const m = Number(ms || 1);
  const last = new Date(y, m, 0).getDate();
  const result = [];
  for (let i = 1; i <= last; i += 1) {
    result.push(`${ys}-${String(ms).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  return result;
}

function authHeaders() {
  const legacyAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.token || '';
    } catch {
      return '';
    }
  })();
  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('cognito_access_token') ||
    localStorage.getItem('token') ||
    legacyAuth ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jinzaiDisplayName(item) {
  if (!item || typeof item !== 'object') return '';
  const direct = [item.name, item.full_name, item.display_name, item.jinzai_name];
  for (const v of direct) {
    const s = String(v || '').trim();
    if (s) return s;
  }
  const sei = String(item.sei || item.last_name || '').trim();
  const mei = String(item.mei || item.first_name || '').trim();
  return `${sei}${mei}`.trim();
}

function normalizeRoleList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      // noop
    }
  }
  return [raw.toLowerCase()];
}

function isAdminRoleMember(item) {
  const directRole = String(item?.role || item?.custom_role || '').trim().toLowerCase();
  const roleTokens = [
    directRole,
    ...normalizeRoleList(item?.yakuwari),
    ...normalizeRoleList(item?.roles),
  ].filter(Boolean);

  return roleTokens.some((r) => (
    r === 'admin'
    || r === 'headquarters'
    || r === 'superadmin'
    || r === 'owner'
    || r === 'kanri'
    || r === '管理'
  ));
}

function clipText(value, limit) {
  const s = String(value || '').trim();
  if (!s) return '-';
  if (s.length <= limit) return s;
  return `${s.slice(0, limit)}…`;
}

function parseRelatedIds(value) {
  return Array.from(new Set(
    String(value || '')
      .split(/[,\s]+/)
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v) => /^KADAI#/i.test(v))
      .map((v) => (/^kadai#/i.test(v) ? `KADAI#${v.slice(6)}` : v))
  ));
}

function formatJpDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]/g, '');
}

function isAdminLogRow(row) {
  const listScopeToken = normalizeToken(row?.list_scope);
  const categoryToken = normalizeToken(row?.category);
  const sourceToken = normalizeToken(row?.source);
  const tagToken = normalizeToken(row?.log_type || row?.type || row?.kind);

  const allow = new Set([
    'kanrilog',
    'adminlog',
    'admindiary',
    'diary',
    '管理ログ',
    '管理日誌',
  ].map((v) => normalizeToken(v)));

  return allow.has(listScopeToken) || allow.has(categoryToken) || allow.has(sourceToken) || allow.has(tagToken);
}

function timestampOf(row) {
  const raw = String(row?.updated_at || row?.reported_at || row?.date || row?.created_at || '').trim();
  if (!raw) return 0;
  const t = Date.parse(raw);
  if (Number.isFinite(t)) return t;
  const ymd = normalizeYmd(raw);
  if (!ymd) return 0;
  const fallback = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(fallback) ? fallback : 0;
}

function reportDateOf(row) {
  return normalizeYmd(row?.reported_at || row?.date || row?.created_at || '');
}

export default function AdminAdminLogPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const t = todayYmd();
    return `${t.slice(0, 7)}-01`;
  });
  const [allAdminLogs, setAllAdminLogs] = useState([]);
  const [monthListLoading, setMonthListLoading] = useState(false);
  const [selectedSubmitter, setSelectedSubmitter] = useState(SUBMITTER_FILTER_ALL);
  const [submitterCandidates, setSubmitterCandidates] = useState([]);
  const [submitterLoading, setSubmitterLoading] = useState(false);
  const [detailDrafts, setDetailDrafts] = useState({});
  const [tomorrowDrafts, setTomorrowDrafts] = useState({});
  // related_kadai_ids は自由入力（検索/タグ運用は廃止）
  const selectedYm = useMemo(() => {
    const ymd = normalizeYmd(selectedMonth) || todayYmd();
    return ymd.slice(0, 7);
  }, [selectedMonth]);

  const fetchAdminLogItems = useCallback(async () => {
    setMonthListLoading(true);
    try {
      const fetchCollection = async (resource, jotai) => {
        const path = `${MASTER_API_BASE}/master/${resource}?limit=5000&jotai=${encodeURIComponent(String(jotai || ''))}`;
        const controller = new AbortController();
        const timeoutMs = 12000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(path, {
            signal: controller.signal,
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
          });
          if (!res.ok) throw new Error(`${resource} HTTP ${res.status}`);
          const data = await res.json();
          return getItems(data);
        } catch (e) {
          if (e?.name === 'AbortError') throw new Error(`${resource} timeout`);
          throw e;
        } finally {
          clearTimeout(timer);
        }
      };

      const settled = await Promise.allSettled([
        fetchCollection('kanri_log', 'yuko'),
        fetchCollection('kanri_log', 'torikeshi'),
      ]);

      const take = (idx) => (settled[idx]?.status === 'fulfilled' ? settled[idx].value : []);
      const kanriRowsRaw = [...take(0), ...take(1)].filter((row) => isAdminLogRow(row));
      const merged = kanriRowsRaw.map((row) => ({ ...row, _legacy_source: '' }));
      merged.sort((a, b) => {
        const ad = reportDateOf(a);
        const bd = reportDateOf(b);
        const dateCmp = String(bd || '').localeCompare(String(ad || ''));
        if (dateCmp !== 0) return dateCmp;
        const diff = timestampOf(b) - timestampOf(a);
        if (diff !== 0) return diff;
        return String(b?.kanri_log_id || '').localeCompare(String(a?.kanri_log_id || ''));
      });
      setAllAdminLogs(merged);
      return merged;
    } catch (e) {
      setAllAdminLogs([]);
      throw e;
    } finally {
      setMonthListLoading(false);
    }
  }, []);

  const monthLabel = useMemo(() => {
    const [y, m] = String(selectedYm || '').split('-');
    return `${y || ''}年${Number(m || 0)}月`;
  }, [selectedYm]);
  const monthList = useMemo(() => {
    const map = new Map();
    (allAdminLogs || []).forEach((row) => {
      const reportedAt = normalizeYmd(row?.reported_at || row?.date || row?.created_at || '');
      if (!reportedAt) return;
      const ym = reportedAt.slice(0, 7);
      const prev = map.get(ym) || { ym, count: 0, latestDate: '' };
      prev.count += 1;
      if (!prev.latestDate || reportedAt > prev.latestDate) prev.latestDate = reportedAt;
      map.set(ym, prev);
    });
    return Array.from(map.values()).sort((a, b) => String(b.ym).localeCompare(String(a.ym)));
  }, [allAdminLogs]);

  const monthlyRows = useMemo(() => {
    return (allAdminLogs || []).filter((row) => {
      if (!isAdminLogRow(row)) return false;
      const reportedAt = normalizeYmd(row?.reported_at || row?.date || row?.created_at || '');
      const ym = reportedAt ? reportedAt.slice(0, 7) : '';
      return ym === selectedYm;
    });
  }, [allAdminLogs, selectedYm]);

  const submitterSummary = useMemo(() => {
    const map = new Map();
    monthlyRows.forEach((row) => {
      const name = String(row?.reported_by || '').trim() || '未設定';
      map.set(name, (map.get(name) || 0) + 1);
    });
    const knownSubmitters = new Set(
      (allAdminLogs || [])
        .map((row) => String(row?.reported_by || '').trim())
        .filter(Boolean)
    );
    const pool = new Set([
      ...submitterCandidates,
      ...knownSubmitters,
      ...Array.from(map.keys()),
    ]);
    return Array.from(pool.values())
      .map((name) => ({ name, count: Number(map.get(name) || 0) }))
      .sort((a, b) => {
        const c = Number(b.count || 0) - Number(a.count || 0);
        if (c !== 0) return c;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
      });
  }, [allAdminLogs, monthlyRows, submitterCandidates]);
  const submitterSelectOptions = useMemo(() => {
    const knownSubmitters = (allAdminLogs || [])
      .map((row) => String(row?.reported_by || '').trim())
      .filter(Boolean);
    const pool = new Set([
      ...submitterCandidates,
      ...knownSubmitters,
    ]);
    return Array.from(pool.values())
      .sort((a, b) => String(a).localeCompare(String(b), 'ja'))
      .map((name) => ({ value: name, label: name }));
  }, [allAdminLogs, submitterCandidates]);

  useEffect(() => {
    if (selectedSubmitter === SUBMITTER_FILTER_ALL) return;
    if (submitterSummary.some((x) => x.name === selectedSubmitter)) return;
    setSelectedSubmitter(SUBMITTER_FILTER_ALL);
  }, [selectedSubmitter, submitterSummary]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSubmitterLoading(true);
      try {
        const path = `${JINZAI_API_BASE}/jinzai?limit=2000&jotai=yuko`;
        const res = await fetch(path, {
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) throw new Error(`jinzai HTTP ${res.status}`);
        const data = await res.json();
        const rows = getItems(data);
        const names = rows
          .filter(isAdminRoleMember)
          .map(jinzaiDisplayName)
          .map((v) => String(v || '').trim())
          .filter(Boolean);
        const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'ja'));
        if (!cancelled) setSubmitterCandidates(uniq);
      } catch {
        if (!cancelled) setSubmitterCandidates([]);
      } finally {
        if (!cancelled) setSubmitterLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!monthList.length) return;
    if (monthList.some((m) => m.ym === selectedYm)) return;
    setSelectedMonth(`${monthList[0].ym}-01`);
  }, [monthList, selectedYm]);

  const appendTaskToPlan = (baseText, task) => {
    const current = String(baseText || '').trim();
    const taskId = String(task?.kadai_id || '').trim();
    const taskTitle = String(task?.name || '').trim() || 'タスク';
    if (!taskId) return current;
    const line = `- ${taskId} ${taskTitle}`;
    if (!current) return line;
    if (current.includes(taskId)) return current;
    return `${current}\n${line}`;
  };

  return (
    <AdminMasterBase
      title="管理日誌提出"
      pageClassName="admin-admin-log-page"
      resource="kanri_log"
      idKey="kanri_log_id"
      listLimit={1000}
      loadItemsOverride={fetchAdminLogItems}
      canEditRow={(row) => !row?._legacy_source}
      canDeleteRow={(row) => !row?._legacy_source}
      clientFilter={(row) => {
        const reportedAt = normalizeYmd(row?.reported_at || row?.date || row?.created_at || '');
        const ym = reportedAt ? reportedAt.slice(0, 7) : '';
        const inMonth = ym === selectedYm;
        if (!(inMonth && isAdminLogRow(row))) return false;
        if (selectedSubmitter === SUBMITTER_FILTER_ALL) return true;
        const submitterName = String(row?.reported_by || '').trim() || '未設定';
        return submitterName === selectedSubmitter;
      }}
      renderHeaderExtra={() => (
        <div className="admin-log-date-strip" aria-label="管理日誌 月別一覧">
          <div className="admin-log-date-inline">
            <div className="admin-log-month-switch" aria-label="管理日誌 月切替">
              <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}>← 前月</button>
              <button type="button" onClick={() => setSelectedMonth(`${todayYmd().slice(0, 7)}-01`)}>今月</button>
              <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}>翌月 →</button>
            </div>
            <div className="admin-log-date-strip-head">{monthLabel} 提出分一覧</div>
          </div>
          <div className="admin-log-monthly-list" aria-label="管理日誌 過去月次一覧">
            <div className="admin-log-monthly-list-head">過去提出（月次）</div>
            <div className="admin-log-monthly-list-scroll">
              {monthListLoading ? (
                <div className="admin-log-monthly-empty">読み込み中...</div>
              ) : monthList.length ? (
                monthList.map((m) => {
                  const active = selectedYm === m.ym;
                  return (
                    <button
                      key={m.ym}
                      type="button"
                      className={`admin-log-monthly-chip${active ? ' active' : ''}`}
                      onClick={() => setSelectedMonth(`${m.ym}-01`)}
                    >
                      <span>{monthLabelFromYm(m.ym)}</span>
                      <span>{m.count}件</span>
                    </button>
                  );
                })
              ) : (
                <div className="admin-log-monthly-empty">月次データはありません</div>
              )}
            </div>
          </div>
          <div className="admin-log-submitter-list" aria-label="管理日誌 提出者別集計">
            <div className="admin-log-monthly-list-head">提出者別（月内）</div>
            <div className="admin-log-submitter-scroll">
              {monthListLoading || submitterLoading ? (
                <div className="admin-log-monthly-empty">読み込み中...</div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`admin-log-submitter-chip${selectedSubmitter === SUBMITTER_FILTER_ALL ? ' active' : ''}`}
                    onClick={() => setSelectedSubmitter(SUBMITTER_FILTER_ALL)}
                  >
                    <span>全員</span>
                    <span>{monthlyRows.length}件</span>
                  </button>
                  {submitterSummary.map((s) => {
                    const active = selectedSubmitter === s.name;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        className={`admin-log-submitter-chip${active ? ' active' : ''}`}
                        onClick={() => setSelectedSubmitter(s.name)}
                      >
                        <span>{s.name}</span>
                        <span>{s.count}件</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      fixedNewValues={{
        list_scope: 'kanri_log',
        category: 'kanri_log',
        log_type: 'kanri_log',
        status: 'open',
        task_state: 'mikanryo',
        source: 'kanri_log',
        reported_at: todayYmd(),
        reported_by: '管理',
        jotai: 'yuko',
      }}
      normalizeEditingModel={(model) => {
        const m = { ...(model || {}) };
        m.list_scope = 'kanri_log';
        m.category = 'kanri_log';
        m.log_type = 'kanri_log';
        m.source = 'kanri_log';
        const body = String(m.request || '').trim();
        if (!String(m.name || '').trim()) {
          const first = body
            ? body.split('\n').map((v) => String(v).trim()).filter(Boolean)[0] || ''
            : '';
          m.name = first ? first.slice(0, 60) : `管理日誌 ${String(m.reported_at || todayYmd())}`;
        }
        m.related_kadai_ids = parseRelatedIds(m.related_kadai_ids).join(', ');
        return m;
      }}
      renderModalExtra={({ editing, setEditing, parents }) => {
        return (
          <div className="admin-log-related-box">
            <div className="admin-log-related-head">
              <div>関連タスク（自由入力）</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <textarea
                value={String(editing?.related_kadai_ids || '')}
                onChange={(e) => setEditing((prev) => ({ ...(prev || {}), related_kadai_ids: e.target.value }))}
                placeholder="例: KADAI#0001, KADAI#0002"
                style={{ width: '100%', minHeight: 84 }}
              />
            </div>
          </div>
        );
      }}
      localSearch={{
        label: '検索',
        placeholder: '日付/提出者/日誌本文/明日の予定/関連タスクで検索',
        keys: [
          'kanri_log_id',
          'reported_at',
          'reported_by',
          'work_time',
          'request',
          'tomorrow_plan',
          'related_kadai_ids',
          'name',
        ],
      }}
      showJotaiColumn={false}
      showJotaiEditor={false}
      enableRowDetail
      rowDetailKeys={[
        'reported_at',
        'reported_by',
        'work_time',
        'updated_at',
      ]}
      renderRowDetail={({ row, rowId, onInlineFieldChange, inlineSaving, parents }) => {
        const draft = Object.prototype.hasOwnProperty.call(detailDrafts, rowId)
          ? detailDrafts[rowId]
          : String(row?.request || '');
        const tomorrowDraft = Object.prototype.hasOwnProperty.call(tomorrowDrafts, rowId)
          ? tomorrowDrafts[rowId]
          : String(row?.tomorrow_plan || '');
        const bodySaving = !!inlineSaving?.[`${rowId}:request`];
        const tomorrowSaving = !!inlineSaving?.[`${rowId}:tomorrow_plan`];
        const titleSaving = !!inlineSaving?.[`${rowId}:name`];
        const relatedIds = parseRelatedIds(row?.related_kadai_ids);
        const isLegacy = !!row?._legacy_source;

        if (isLegacy) {
          return (
            <div className="kadai-detail-two-col">
              <div className="kadai-detail-left">
                <div className="kadai-detail-row">
                  <div className="k">日付</div>
                  <div className="v">{String(row?.reported_at || '-')}</div>
                </div>
                <div className="kadai-detail-row">
                  <div className="k">提出者</div>
                  <div className="v">{String(row?.reported_by || '-')}</div>
                </div>
                <div className="kadai-detail-row">
                  <div className="k">稼働時間</div>
                  <div className="v">{String(row?.work_time || '-')}</div>
                </div>
                <div className="kadai-detail-row">
                  <div className="k">更新日時</div>
                  <div className="v">{formatJpDateTime(row?.updated_at)}</div>
                </div>
                <div className="kadai-detail-row">
                  <div className="k">旧ID</div>
                  <div className="v">{String(row?._legacy_kadai_id || '-')}</div>
                </div>
              </div>

              <div className="kadai-detail-right">
                <div className="kadai-detail-right-top">
                  <div className="kadai-detail-row">
                    <div className="k">PRタイトル</div>
                    <div className="v">{String(row?.name || '-')}</div>
                  </div>
                </div>

                <div className="admin-log-note-grid">
                  <div>
                    <div className="kadai-detail-note-head">日誌本文</div>
                    <div className="admin-log-readonly-block">{String(row?.request || '-')}</div>
                  </div>
                  <div>
                    <div className="kadai-detail-note-head">明日の予定</div>
                    <div className="admin-log-readonly-block">{String(row?.tomorrow_plan || '-')}</div>
                  </div>
                </div>

                <div className="admin-log-related-box">
                  <div className="admin-log-related-head">
                    <div>関連タスク</div>
                  </div>
                  <div className="admin-log-readonly-block" style={{ minHeight: 84 }}>
                    {relatedIds.length ? relatedIds.join(', ') : '-'}
                  </div>
                </div>

                <div className="admin-log-readonly-note">
                  旧管理ログ（kadai）を参照表示しています。編集は新しい管理日誌で行ってください。
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="kadai-detail-two-col">
            <div className="kadai-detail-left">
              <div className="kadai-detail-row">
                <div className="k">日付</div>
                <div className="v">{String(row?.reported_at || '-')}</div>
              </div>
              <div className="kadai-detail-row">
                <div className="k">提出者</div>
                <div className="v">{String(row?.reported_by || '-')}</div>
              </div>
              <div className="kadai-detail-row">
                <div className="k">稼働時間</div>
                <div className="v">{String(row?.work_time || '-')}</div>
              </div>
              <div className="kadai-detail-row">
                <div className="k">更新日時</div>
                <div className="v">{formatJpDateTime(row?.updated_at)}</div>
              </div>
              <div className="kadai-detail-row">
                <div className="k">関連タスク</div>
                <div className="v">
                  {relatedIds.length ? relatedIds.join(', ') : '-'}
                </div>
              </div>
            </div>

            <div className="kadai-detail-right">
              <div className="kadai-detail-right-top">
                <div className="kadai-detail-row">
                  <div className="k">PRタイトル</div>
                  <div className="v">
                    <input
                      value={String(row?.name || '')}
                      onChange={(e) => onInlineFieldChange('name', e.target.value)}
                      disabled={titleSaving}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="admin-log-note-grid">
                <div>
                  <div className="kadai-detail-note-head">日誌本文</div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDetailDrafts((prev) => ({ ...prev, [rowId]: e.target.value }))}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${Math.max(220, el.scrollHeight)}px`;
                    }}
                    ref={(el) => {
                      if (!el) return;
                      el.style.height = 'auto';
                      el.style.height = `${Math.max(220, el.scrollHeight)}px`;
                    }}
                    placeholder="本文を入力"
                    style={{
                      minHeight: 220,
                      overflow: 'hidden',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div>
                  <div className="kadai-detail-note-head">明日の予定</div>
                  <textarea
                    value={tomorrowDraft}
                    onChange={(e) => setTomorrowDrafts((prev) => ({ ...prev, [rowId]: e.target.value }))}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${Math.max(220, el.scrollHeight)}px`;
                    }}
                    ref={(el) => {
                      if (!el) return;
                      el.style.height = 'auto';
                      el.style.height = `${Math.max(220, el.scrollHeight)}px`;
                    }}
                    placeholder="明日の予定を入力"
                    style={{
                      minHeight: 220,
                      overflow: 'hidden',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div className="admin-log-related-box">
                <div className="admin-log-related-head">
                  <div>関連タスク（自由入力）</div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={String(row?.related_kadai_ids || '')}
                    onChange={(e) => onInlineFieldChange('related_kadai_ids', e.target.value)}
                    placeholder="例: KADAI#0001, KADAI#0002"
                    style={{ width: '100%', minHeight: 84 }}
                  />
                </div>
              </div>

              <div className="kadai-detail-note-actions">
                <button
                  type="button"
                  disabled={bodySaving}
                  onClick={() => onInlineFieldChange('request', draft)}
                >
                  {bodySaving ? '保存中...' : '本文を保存'}
                </button>
                <button
                  type="button"
                  disabled={tomorrowSaving}
                  onClick={() => onInlineFieldChange('tomorrow_plan', tomorrowDraft)}
                >
                  {tomorrowSaving ? '保存中...' : '明日の予定を保存'}
                </button>
              </div>
            </div>
          </div>
        );
      }}
      filters={[]}
      fields={[
        {
          key: 'reported_at',
          label: '日付(YYYY-MM-DD)',
          required: true,
        },
        {
          key: 'reported_by',
          label: '提出者',
          type: 'select',
          options: submitterSelectOptions,
          valueKey: 'value',
          labelKey: 'label',
          required: true,
        },
        {
          key: 'work_time',
          label: '稼働時間',
        },
        {
          key: 'name',
          label: 'PRタイトル',
          modalColSpan: 4,
          required: true,
          render: (v) => {
            const raw = String(v || '').trim();
            const clipped = clipText(raw, 28);
            return <span title={raw || ''}>{clipped}</span>;
          },
        },
        {
          key: 'request',
          label: '日誌本文',
          type: 'textarea',
          rows: 22,
          modalColSpan: 4,
          enableTools: true,
          required: true,
          render: (v) => {
            const raw = String(v || '').trim().replace(/\s+/g, ' ');
            const clipped = clipText(raw, 42);
            return <span title={raw || ''}>{clipped}</span>;
          },
        },
        {
          key: 'tomorrow_plan',
          label: '明日の予定',
          type: 'textarea',
          rows: 22,
          modalColSpan: 4,
          enableTools: true,
          render: (v) => {
            const raw = String(v || '').trim().replace(/\s+/g, ' ');
            const clipped = clipText(raw, 42);
            return <span title={raw || ''}>{clipped}</span>;
          },
        },
        {
          key: 'related_kadai_ids',
          label: '関連タスク',
          modalColSpan: 4,
          render: (v) => {
            const raw = parseRelatedIds(v).join(', ');
            const clipped = clipText(raw, 48);
            return <span title={raw || ''}>{clipped || '-'}</span>;
          },
        },
      ]}
    />
  );
}
