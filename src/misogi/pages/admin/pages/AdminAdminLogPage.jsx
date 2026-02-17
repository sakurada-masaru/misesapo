import React, { useMemo, useState } from 'react';
import AdminMasterBase from './AdminMasterBase';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

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

function extractKadaiIds(text) {
  const raw = String(text || '');
  const matches = raw.match(/KADAI#[A-Za-z0-9_-]+/gi) || [];
  const normalized = matches.map((v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^kadai#/i.test(s)) return `KADAI#${s.slice(6)}`;
    return s;
  }).filter(Boolean);
  return Array.from(new Set(normalized));
}

function computeRelatedKadaiIds(model) {
  const text = [
    String(model?.name || ''),
    String(model?.request || ''),
    String(model?.tomorrow_plan || ''),
  ].join('\n');
  return extractKadaiIds(text);
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
  const [detailDrafts, setDetailDrafts] = useState({});
  const [tomorrowDrafts, setTomorrowDrafts] = useState({});
  const [rowSelectedTask, setRowSelectedTask] = useState({});
  const [creatingFromRowId, setCreatingFromRowId] = useState('');
  const [creatingFromModal, setCreatingFromModal] = useState(false);

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

  const normalizeTaskOptions = (parents) => {
    const items = Array.isArray(parents?.kadai) ? parents.kadai : [];
    const filtered = items.filter((x) => String(x?.category || '') !== 'admin_log');
    const mapped = filtered.map((x) => ({
      value: String(x?.kadai_id || ''),
      label: `${String(x?.kadai_id || '')} ${String(x?.name || '').trim() || '課題'}`.trim(),
      item: x,
    })).filter((x) => x.value);
    return mapped.slice(0, 500);
  };

  const createKadaiFromLog = async (source) => {
    const src = source && typeof source === 'object' ? source : {};
    const title = String(src.name || '').trim();
    const request = String(src.request || '').trim();
    const tomorrow = String(src.tomorrow_plan || '').trim();
    const reportedBy = String(src.reported_by || '').trim() || '管理';
    const body = tomorrow || request || title || '管理ログ起票';
    const name = title || body.split('\n').map((v) => String(v || '').trim()).filter(Boolean)[0] || '管理ログ起票';
    const payload = {
      name: name.slice(0, 80),
      category: 'create_request',
      flow_stage: 'other',
      status: 'open',
      task_state: 'mikanryo',
      source: 'internal',
      reported_at: todayYmd(),
      reported_by: reportedBy,
      target_to: '',
      request: body,
      jotai: 'yuko',
    };
    const res = await fetch(`${MASTER_API_BASE.replace(/\/$/, '')}/master/kadai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.message || data?.error || `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return data;
  };

  return (
    <AdminMasterBase
      title="管理ログ提出（日誌/PR）"
      pageClassName="admin-admin-log-page"
      resource="kadai"
      idKey="kadai_id"
      fixedQuery={{ category: 'admin_log', jotai: 'yuko' }}
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
        m.related_kadai_ids = computeRelatedKadaiIds(m).join(', ');
        return m;
      }}
      renderModalExtra={({ editing, setEditing, parents }) => {
        const ids = computeRelatedKadaiIds(editing || {});
        const hasIds = ids.length > 0;
        const taskOptions = normalizeTaskOptions(parents || {});
        const modalSelectedId = String(editing?.selected_kadai_id || '');
        const selectedTask = taskOptions.find((x) => x.value === modalSelectedId)?.item || null;
        return (
          <>
            <div className="admin-log-related-box">
              <div className="admin-log-related-head">
                <div>課題番号（自動読み取り）</div>
                <button
                  type="button"
                  onClick={() => {
                    setEditing((prev) => ({
                      ...(prev || {}),
                      related_kadai_ids: computeRelatedKadaiIds(prev || {}).join(', '),
                    }));
                  }}
                >
                  読み取り更新
                </button>
              </div>
              {hasIds ? (
                <div className="admin-log-related-tags">
                  {ids.map((id) => (
                    <a key={id} className="admin-log-related-tag" href={`#/admin/kadai?focus=${encodeURIComponent(id)}`}>
                      {id}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="admin-log-related-empty">課題番号が見つかりません</div>
              )}
            </div>

            <div className="admin-log-related-box">
              <div className="admin-log-related-head">
                <div>既存課題を明日の予定へ貼り付け</div>
              </div>
              <div className="admin-log-task-picker">
                <select
                  value={modalSelectedId}
                  onChange={(e) => setEditing((prev) => ({ ...(prev || {}), selected_kadai_id: e.target.value }))}
                >
                  <option value="">課題を選択</option>
                  {taskOptions.map((opt) => (
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
                      next.tomorrow_plan = appendTaskToPlan(next.tomorrow_plan, selectedTask);
                      next.related_kadai_ids = computeRelatedKadaiIds(next).join(', ');
                      return next;
                    });
                  }}
                >
                  明日の予定へ貼り付け
                </button>
                <button
                  type="button"
                  disabled={creatingFromModal}
                  onClick={async () => {
                    try {
                      setCreatingFromModal(true);
                      const created = await createKadaiFromLog(editing || {});
                      setEditing((prev) => {
                        const next = { ...(prev || {}) };
                        next.tomorrow_plan = appendTaskToPlan(next.tomorrow_plan, created);
                        next.related_kadai_ids = computeRelatedKadaiIds(next).join(', ');
                        return next;
                      });
                    } catch (e) {
                      window.alert(`課題作成に失敗しました: ${String(e?.message || e)}`);
                    } finally {
                      setCreatingFromModal(false);
                    }
                  }}
                >
                  {creatingFromModal ? '課題作成中...' : 'このログから課題を作成'}
                </button>
              </div>
            </div>
          </>
        );
      }}
      localSearch={{
        label: '検索',
        placeholder: '日付/提出者/PR本文/明日の予定/課題番号で検索',
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
      renderRowDetail={({ row, rowId, onInlineFieldChange, inlineSaving }) => {
        const draft = Object.prototype.hasOwnProperty.call(detailDrafts, rowId)
          ? detailDrafts[rowId]
          : String(row?.request || '');
        const tomorrowDraft = Object.prototype.hasOwnProperty.call(tomorrowDrafts, rowId)
          ? tomorrowDrafts[rowId]
          : String(row?.tomorrow_plan || '');
        const bodySaving = !!inlineSaving?.[`${rowId}:request`];
        const tomorrowSaving = !!inlineSaving?.[`${rowId}:tomorrow_plan`];
        const titleSaving = !!inlineSaving?.[`${rowId}:name`];
        const relatedSaving = !!inlineSaving?.[`${rowId}:related_kadai_ids`];
        const taskOptions = normalizeTaskOptions({ kadai: [] });
        const relatedIds = (() => {
          const fromField = String(row?.related_kadai_ids || '').trim();
          if (fromField) {
            return Array.from(new Set(
              fromField
                .split(/[,\s]+/)
                .map((v) => String(v || '').trim())
                .filter((v) => /^KADAI#/i.test(v))
                .map((v) => (/^kadai#/i.test(v) ? `KADAI#${v.slice(6)}` : v))
            ));
          }
          return computeRelatedKadaiIds({
            name: row?.name,
            request: draft,
            tomorrow_plan: tomorrowDraft,
          });
        })();

        const saveRelatedIds = (nameValue, bodyValue, tomorrowValue) => {
          const joined = computeRelatedKadaiIds({
            name: nameValue,
            request: bodyValue,
            tomorrow_plan: tomorrowValue,
          }).join(', ');
          onInlineFieldChange('related_kadai_ids', joined);
        };

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
                <div className="k">課題番号</div>
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
                      onChange={(e) => {
                        const nextName = e.target.value;
                        onInlineFieldChange('name', nextName);
                        saveRelatedIds(nextName, draft, tomorrowDraft);
                      }}
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
                    placeholder="明日の予定を入力（例: KADAI#xxxx）"
                    style={{
                      minHeight: 220,
                      overflow: 'hidden',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>
              <div className="kadai-detail-note-actions">
                <button
                  type="button"
                  disabled={bodySaving}
                  onClick={() => {
                    onInlineFieldChange('request', draft);
                    saveRelatedIds(row?.name, draft, tomorrowDraft);
                  }}
                >
                  {bodySaving ? '保存中...' : '本文を保存'}
                </button>
                <button
                  type="button"
                  disabled={tomorrowSaving}
                  onClick={() => {
                    onInlineFieldChange('tomorrow_plan', tomorrowDraft);
                    saveRelatedIds(row?.name, draft, tomorrowDraft);
                  }}
                >
                  {tomorrowSaving ? '保存中...' : '明日の予定を保存'}
                </button>
                <button
                  type="button"
                  disabled={relatedSaving}
                  onClick={() => saveRelatedIds(row?.name, draft, tomorrowDraft)}
                >
                  {relatedSaving ? '読み取り中...' : '課題番号を読み取り'}
                </button>
                <button
                  type="button"
                  disabled={creatingFromRowId === rowId}
                  onClick={async () => {
                    try {
                      setCreatingFromRowId(rowId);
                      const created = await createKadaiFromLog({
                        name: row?.name,
                        request: draft,
                        tomorrow_plan: tomorrowDraft,
                        reported_by: row?.reported_by,
                      });
                      const nextTomorrow = appendTaskToPlan(tomorrowDraft, created);
                      setTomorrowDrafts((prev) => ({ ...prev, [rowId]: nextTomorrow }));
                      onInlineFieldChange('tomorrow_plan', nextTomorrow);
                      saveRelatedIds(row?.name, draft, nextTomorrow);
                    } catch (e) {
                      window.alert(`課題作成に失敗しました: ${String(e?.message || e)}`);
                    } finally {
                      setCreatingFromRowId('');
                    }
                  }}
                >
                  {creatingFromRowId === rowId ? '課題作成中...' : 'このログから課題を作成'}
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
          label: '課題番号（自動読み取り）',
          modalColSpan: 4,
          readOnly: true,
          render: (v) => {
            const raw = String(v || '').trim();
            const clipped = clipText(raw, 48);
            return <span title={raw || ''}>{clipped || '-'}</span>;
          },
        },
      ]}
    />
  );
}
