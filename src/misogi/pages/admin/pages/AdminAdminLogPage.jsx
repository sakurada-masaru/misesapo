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
  const filtered = items.filter((x) => String(x?.category || '') !== 'admin_log');
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

export default function AdminAdminLogPage() {
  const [selectedDate, setSelectedDate] = useState(todayYmd());
  const [detailDrafts, setDetailDrafts] = useState({});
  const [tomorrowDrafts, setTomorrowDrafts] = useState({});
  const [rowSelectedTask, setRowSelectedTask] = useState({});
  const [rowTaskSearch, setRowTaskSearch] = useState({});
  const [modalTaskSearch, setModalTaskSearch] = useState('');
  const dayList = useMemo(() => monthDays(selectedDate), [selectedDate]);
  const monthLabel = useMemo(() => {
    const [y, m] = String(selectedDate || '').split('-');
    return `${y || ''}年${Number(m || 0)}月`;
  }, [selectedDate]);

  const appendTaskToPlan = (baseText, task) => {
    const current = String(baseText || '').trim();
    const taskId = String(task?.kadai_id || '').trim();
    const taskTitle = String(task?.name || '').trim() || '課題';
    if (!taskId) return current;
    const line = `- ${taskId} ${taskTitle}`;
    if (!current) return line;
    if (current.includes(taskId)) return current;
    return `${current}\n${line}`;
  };

  return (
    <AdminMasterBase
      title="管理ログ提出（日誌/PR）"
      pageClassName="admin-admin-log-page"
      resource="kadai"
      idKey="kadai_id"
      fixedQuery={{ category: 'admin_log', jotai: 'yuko', reported_at: selectedDate }}
      renderHeaderExtra={() => (
        <div className="admin-log-date-strip" aria-label="管理ログ 日付選択">
          <div className="admin-log-date-inline">
            <div className="admin-log-month-switch" aria-label="管理ログ 月切替">
              <button
                type="button"
                onClick={() => setSelectedDate(shiftMonth(selectedDate, -1))}
                title="前月"
              >
                ← 前月
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(todayYmd())}
                title="今月"
              >
                今月
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(shiftMonth(selectedDate, 1))}
                title="翌月"
              >
                翌月 →
              </button>
            </div>
            <div className="admin-log-date-strip-head">{monthLabel} 日付選択</div>
            <div className="admin-log-date-scroll">
              {dayList.map((d) => {
                const day = String(d).slice(-2).replace(/^0/, '');
                const isActive = d === selectedDate;
                const isToday = d === todayYmd();
                return (
                  <button
                    key={d}
                    type="button"
                    className={`admin-log-date-chip ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
                    onClick={() => setSelectedDate(d)}
                    title={d}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      fixedNewValues={{
        category: 'admin_log',
        status: 'open',
        task_state: 'mikanryo',
        source: 'internal',
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
        const body = String(m.request || '').trim();
        if (!String(m.name || '').trim()) {
          const first = body
            ? body.split('\n').map((v) => String(v).trim()).filter(Boolean)[0] || ''
            : '';
          m.name = first ? first.slice(0, 60) : `管理ログ ${String(m.reported_at || todayYmd())}`;
        }
        m.related_kadai_ids = parseRelatedIds(m.related_kadai_ids).join(', ');
        return m;
      }}
      renderModalExtra={({ editing, setEditing, parents }) => {
        const ids = parseRelatedIds(editing?.related_kadai_ids);
        const taskOptions = normalizeTaskOptions(parents || {});
        const filteredTaskOptions = filterTaskOptions(taskOptions, modalTaskSearch);
        const modalSelectedId = String(editing?.selected_kadai_id || '');
        const selectedTask = taskOptions.find((x) => x.value === modalSelectedId)?.item || null;
        return (
          <div className="admin-log-related-box">
            <div className="admin-log-related-head">
              <div>関連課題（検索して追加）</div>
            </div>
            <div className="admin-log-task-picker">
              <input
                type="text"
                placeholder="課題番号/タイトルで検索"
                value={modalTaskSearch}
                onChange={(e) => setModalTaskSearch(e.target.value)}
              />
              <select
                value={modalSelectedId}
                onChange={(e) => setEditing((prev) => ({ ...(prev || {}), selected_kadai_id: e.target.value }))}
              >
                <option value="">課題を選択</option>
                {filteredTaskOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedTask}
                onClick={() => {
                  if (!selectedTask) return;
                  setEditing((prev) => {
                    const next = { ...(prev || {}) };
                    next.related_kadai_ids = mergeRelatedIds(next.related_kadai_ids, selectedTask.kadai_id);
                    return next;
                  });
                }}
              >
                関連課題に追加
              </button>
              <button
                type="button"
                disabled={!selectedTask}
                onClick={() => {
                  if (!selectedTask) return;
                  setEditing((prev) => {
                    const next = { ...(prev || {}) };
                    next.tomorrow_plan = appendTaskToPlan(next.tomorrow_plan, selectedTask);
                    return next;
                  });
                }}
              >
                明日の予定へ貼り付け
              </button>
            </div>
            {ids.length ? (
              <div className="admin-log-related-tags">
                {ids.map((id) => (
                  <a key={id} className="admin-log-related-tag" href={`#/admin/kadai?focus=${encodeURIComponent(id)}`}>
                    {id}
                  </a>
                ))}
              </div>
            ) : (
              <div className="admin-log-related-empty">関連課題は未設定です</div>
            )}
          </div>
        );
      }}
      localSearch={{
        label: '検索',
        placeholder: '日付/提出者/PR本文/明日の予定/関連課題で検索',
        keys: [
          'kadai_id',
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
        const taskOptions = normalizeTaskOptions(parents || {});
        const query = String(rowTaskSearch[rowId] || '');
        const filteredTaskOptions = filterTaskOptions(taskOptions, query);
        const selectedTaskId = String(rowSelectedTask[rowId] || '');
        const selectedTask = taskOptions.find((x) => x.value === selectedTaskId)?.item || null;
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
                <div className="k">関連課題</div>
                <div className="v">
                  {relatedIds.length ? (
                    <div className="admin-log-related-tags in-detail">
                      {relatedIds.map((id) => (
                        <a key={id} className="admin-log-related-tag" href={`#/admin/kadai?focus=${encodeURIComponent(id)}`}>
                          {id}
                        </a>
                      ))}
                    </div>
                  ) : '-'}
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
                  <div className="kadai-detail-note-head">PR本文（日誌）</div>
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
                  <div>関連課題を検索</div>
                </div>
                <div className="admin-log-task-picker">
                  <input
                    type="text"
                    placeholder="課題番号/タイトルで検索"
                    value={query}
                    onChange={(e) => setRowTaskSearch((prev) => ({ ...prev, [rowId]: e.target.value }))}
                  />
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setRowSelectedTask((prev) => ({ ...prev, [rowId]: e.target.value }))}
                  >
                    <option value="">課題を選択</option>
                    {filteredTaskOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedTask}
                    onClick={() => {
                      if (!selectedTask) return;
                      onInlineFieldChange('related_kadai_ids', mergeRelatedIds(row?.related_kadai_ids, selectedTask.kadai_id));
                    }}
                  >
                    関連課題に追加
                  </button>
                  <button
                    type="button"
                    disabled={!selectedTask}
                    onClick={() => {
                      if (!selectedTask) return;
                      const nextTomorrow = appendTaskToPlan(tomorrowDraft, selectedTask);
                      setTomorrowDrafts((prev) => ({ ...prev, [rowId]: nextTomorrow }));
                      onInlineFieldChange('tomorrow_plan', nextTomorrow);
                    }}
                  >
                    明日の予定へ貼り付け
                  </button>
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
          label: 'PR本文（日誌）',
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
          label: '関連課題',
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
