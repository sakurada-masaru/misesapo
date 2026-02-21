import React, { useMemo, useState } from 'react';
import AdminMasterBase from './AdminMasterBase';

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

function buildAdminSubmitterOptions(parents) {
  const list = Array.isArray(parents?.jinzai) ? parents.jinzai : [];
  const names = list
    .filter(isAdminRoleMember)
    .map(jinzaiDisplayName)
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'ja'));
  return uniq.map((name) => ({ value: name, label: name }));
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

function mergeRelatedIds(currentValue, addingId) {
  const now = parseRelatedIds(currentValue);
  const add = String(addingId || '').trim();
  if (!add) return now.join(', ');
  const normalizedAdd = /^kadai#/i.test(add) ? `KADAI#${add.slice(6)}` : add;
  if (!/^KADAI#/i.test(normalizedAdd)) return now.join(', ');
  return Array.from(new Set([...now, normalizedAdd])).join(', ');
}

function filterTaskOptions(taskOptions, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return taskOptions;
  return taskOptions.filter((opt) => (
    String(opt?.label || '').toLowerCase().includes(q)
    || String(opt?.value || '').toLowerCase().includes(q)
  ));
}

function normalizeTaskOptions(parents) {
  const items = Array.isArray(parents?.kadai) ? parents.kadai : [];
  const filtered = items.filter((x) => !isAdminLogRow(x));
  const mapped = filtered.map((x) => ({
    value: String(x?.kadai_id || ''),
    label: `${String(x?.kadai_id || '')} ${String(x?.name || '').trim() || '課題'}`.trim(),
    item: x,
  })).filter((x) => x.value);
  return mapped.slice(0, 500);
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

export default function AdminAdminLogPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const t = todayYmd();
    return `${t.slice(0, 7)}-01`;
  });
  const [detailDrafts, setDetailDrafts] = useState({});
  const [tomorrowDrafts, setTomorrowDrafts] = useState({});
  // related_kadai_ids は自由入力（検索/タグ運用は廃止）
  const selectedYm = useMemo(() => {
    const ymd = normalizeYmd(selectedMonth) || todayYmd();
    return ymd.slice(0, 7);
  }, [selectedMonth]);
  const monthLabel = useMemo(() => {
    const [y, m] = String(selectedYm || '').split('-');
    return `${y || ''}年${Number(m || 0)}月`;
  }, [selectedYm]);

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
      fixedQuery={{ jotai: 'yuko' }}
      clientFilter={(row) => {
        const reportedAt = normalizeYmd(row?.reported_at || row?.date || row?.created_at || '');
        const ym = reportedAt ? reportedAt.slice(0, 7) : '';
        const inMonth = ym === selectedYm;
        return inMonth && isAdminLogRow(row);
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
      parentSources={{
        jinzai: {
          apiBase: '/api-jinzai',
          resourceBasePath: '',
          resource: 'jinzai',
          query: { limit: 2000, jotai: 'yuko' },
        },
        kadai: {
          resource: 'kadai',
          query: { limit: 500, jotai: 'yuko' },
        },
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
          options: buildAdminSubmitterOptions,
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
          modalColSpan: 2,
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
          modalColSpan: 2,
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
