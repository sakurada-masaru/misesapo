import React, { useMemo, useState } from 'react';
import AdminMasterBase from './AdminMasterBase';

const REQUEST_OPTIONS = [
  { value: '確認', label: '確認' },
  { value: '対応', label: '対応' },
  { value: '承認', label: '承認' },
  { value: '作成', label: '作成' },
  { value: '修正', label: '修正' },
  { value: '変更', label: '変更' },
  { value: '実施', label: '実施' },
  { value: '提出', label: '提出' },
];

const FLOW_STAGE_OPTIONS = [
  { value: 'sales', label: '営業/提案' },
  { value: 'yakusoku', label: '契約' },
  { value: 'yotei', label: '予定' },
  { value: 'shigoto', label: '作業' },
  { value: 'houkoku', label: '報告' },
  { value: 'seikyu', label: '請求/支払' },
  { value: 'master', label: 'マスタ管理' },
  { value: 'other', label: 'その他' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: '未着手' },
  { value: 'in_progress', label: '対応中' },
  { value: 'blocked', label: '保留' },
];

const TASK_STATE_OPTIONS = [
  { value: 'mikanryo', label: '未完了' },
  { value: 'done', label: '完了' },
];

const STATUS_LABEL_MAP = Object.fromEntries(
  STATUS_OPTIONS.map((opt) => [String(opt.value), String(opt.label)])
);
const TASK_STATE_LABEL_MAP = Object.fromEntries(
  TASK_STATE_OPTIONS.map((opt) => [String(opt.value), String(opt.label)])
);
const FLOW_STAGE_LABEL_MAP = Object.fromEntries(
  FLOW_STAGE_OPTIONS.map((opt) => [String(opt.value), String(opt.label)])
);
const KADAI_SCOPE_OPTIONS = [
  { value: 'general', label: '緑リスト', tone: 'green' },
  { value: 'admin', label: '赤リスト', tone: 'red' },
];

const TARGET_DEPARTMENTS = [
  '運営本部',
  '組織運営本部',
  '経営管理本部',
  '営業部',
  '清掃事業部',
  '開発部',
  '経理部',
  '人事部',
  'オペレーション部',
];

function normalizeNameList(value) {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || '').trim()).filter(Boolean);
  }
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x || '').trim()).filter(Boolean);
      }
    } catch {}
  }
  return [raw];
}

function formatSingleOrDash(value) {
  const list = normalizeNameList(value);
  return list[0] || '-';
}

function formatTargetFull(value) {
  const list = normalizeNameList(value);
  if (!list.length) return '-';
  return list.join(' / ');
}

function formatTargetSummary(value) {
  const list = normalizeNameList(value);
  if (!list.length) return '-';
  if (list.length === 1) return list[0];
  return `${list[0]} ...`;
}

function renderMetaTag(text, cls = '') {
  const s = String(text || '').trim();
  if (!s || s === '-') return '-';
  const className = ['kadai-meta-tag', cls].filter(Boolean).join(' ');
  return <span className={className}>{s}</span>;
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
  if (sei || mei) return `${sei}${mei}`.trim();
  return '';
}

function buildActorOptions(parents) {
  const base = TARGET_DEPARTMENTS.map((name) => ({ value: name, label: `【部署】${name}` }));
  const people = Array.isArray(parents?.jinzai) ? parents.jinzai : [];
  const personNames = [...new Set(people.map(jinzaiDisplayName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
  const personOptions = personNames.map((name) => ({ value: name, label: `【個人】${name}` }));
  return [...base, ...personOptions];
}

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

function daysSinceYmd(ymd) {
  const s = String(ymd || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return -1;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const base = new Date(y, mo, d);
  if (Number.isNaN(base.getTime())) return -1;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
}

function fmtUpdateLog(row) {
  const rawAt = String(row?.updated_at || '').trim();
  const who = String(row?.updated_by || row?.reported_by || '').trim();
  let at = rawAt;
  if (rawAt) {
    const d = new Date(rawAt);
    if (!Number.isNaN(d.getTime())) {
      at = d.toLocaleString('ja-JP', { hour12: false });
    }
  }
  if (at && who) return `最終更新: ${at} / 操作: ${who}`;
  if (at) return `最終更新: ${at}`;
  if (who) return `操作: ${who}`;
  return '最終更新: -';
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getCurrentRole() {
  try {
    const token =
      localStorage.getItem('idToken') ||
      localStorage.getItem('cognito_id_token') ||
      localStorage.getItem('id_token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('cognito_access_token') ||
      localStorage.getItem('token') ||
      '';
    const payload = decodeJwtPayload(token);
    const role = String(payload?.['custom:role'] || '').trim();
    if (role) return role;
  } catch {}
  try {
    const legacy = JSON.parse(localStorage.getItem('misesapo_auth') || '{}');
    const role = String(legacy?.role || '').trim();
    if (role) return role;
  } catch {}
  return '';
}

export default function AdminKadaiListPage() {
  const [detailDrafts, setDetailDrafts] = useState({});
  const [kadaiScopeTab, setKadaiScopeTab] = useState('general');
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [deleteUiUnlocked, setDeleteUiUnlocked] = useState(false);
  const currentRole = useMemo(() => getCurrentRole(), []);
  const isAdminOrAbove = currentRole === 'admin' || currentRole === 'headquarters';
  const deleteSecret = 'MandC280408';
  const activeScope = isAdminOrAbove ? kadaiScopeTab : 'general';
  const visibleTabs = isAdminOrAbove ? KADAI_SCOPE_OPTIONS : KADAI_SCOPE_OPTIONS.filter((x) => x.value === 'general');
  const pageClassName = activeScope === 'admin' ? 'kadai-admin-glow' : 'kadai-general-glow';
  const appendDraftText = (rowId, snippet) => {
    setDetailDrafts((prev) => {
      const curr = String(prev?.[rowId] ?? '');
      const joiner = curr.endsWith('\n') || curr.length === 0 ? '' : '\n';
      return { ...prev, [rowId]: `${curr}${joiner}${snippet}` };
    });
  };

  return (
    <AdminMasterBase
      title="Kadaiリスト"
      onTitleClick={() => {
        if (deleteUiUnlocked) return;
        setTitleClickCount((prev) => {
          const next = prev + 1;
          if (next >= 6) {
            setDeleteUiUnlocked(true);
            return 0;
          }
          return next;
        });
      }}
      pageClassName={pageClassName}
      resource="kadai"
      idKey="kadai_id"
      canDeleteRow={() => deleteUiUnlocked}
      enableBulkDelete={deleteUiUnlocked}
      beforeDelete={async () => {
        if (!deleteSecret) {
          window.alert('削除キー未設定です。');
          return false;
        }
        const input = window.prompt('削除キーを入力してください');
        if (input === null) return false;
        if (String(input).trim() !== deleteSecret) {
          window.alert('削除キーが一致しません。');
          return false;
        }
        return true;
      }}
      beforeBulkDelete={async () => {
        if (!deleteSecret) {
          window.alert('削除キー未設定です。');
          return false;
        }
        const input = window.prompt('一括削除キーを入力してください');
        if (input === null) return false;
        if (String(input).trim() !== deleteSecret) {
          window.alert('削除キーが一致しません。');
          return false;
        }
        return true;
      }}
      headerTabs={visibleTabs}
      activeHeaderTab={activeScope}
      onHeaderTabChange={(v) => setKadaiScopeTab(v === 'admin' ? 'admin' : 'general')}
      clientFilter={(row) => {
        const scope = String(row?.list_scope || 'general').trim() || 'general';
        if (scope === 'admin' && !isAdminOrAbove) return false;
        return scope === activeScope;
      }}
      localSearch={{
        label: '統合検索',
        placeholder: '業務フロー段階/課題/要望など',
        keys: [
          'flow_stage',
          'list_scope',
          'kadai_id',
          'category',
          'status',
          'task_state',
          'reported_at',
          'reported_by',
          'target_to',
          'request',
          'fact',
        ],
      }}
      filters={[
        {
          key: 'flow_stage',
          label: '業務フロー段階',
          options: FLOW_STAGE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'request',
          label: '要望',
          options: REQUEST_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'status',
          label: '状況',
          options: STATUS_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'task_state',
          label: '状態',
          options: TASK_STATE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'reported_by',
          label: '依頼者',
          options: buildActorOptions,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'target_to',
          label: '対象者',
          options: buildActorOptions,
          valueKey: 'value',
          labelKey: 'label',
        },
      ]}
      fixedNewValues={{
        flow_stage: 'yotei',
        list_scope: activeScope,
        category: '',
        request: '確認',
        status: 'open',
        task_state: 'mikanryo',
        jotai: 'yuko',
        reported_at: todayYmd(),
      }}
      parentSources={{
        jinzai: {
          resource: 'jinzai',
          query: { limit: 2000, jotai: 'yuko' },
        },
      }}
      normalizeEditingModel={(model) => {
        const m = { ...(model || {}) };
        const categoryText = String(m.category ?? '').trim();
        if (!String(m.name || '').trim()) {
          m.name = categoryText || '未分類';
        }
        const rawScope = String(m.list_scope || '').trim();
        if (!rawScope) m.list_scope = activeScope;
        if (!isAdminOrAbove) m.list_scope = 'general';
        if (Array.isArray(m.target_to)) {
          m.target_to = m.target_to.map((x) => String(x || '').trim()).filter(Boolean);
        } else if (String(m.target_to || '').trim()) {
          m.target_to = normalizeNameList(m.target_to);
        } else {
          m.target_to = [];
        }
        if (!String(m.task_state ?? '').trim()) m.task_state = 'mikanryo';
        if (!String(m.request ?? '').trim()) m.request = '確認';
        if (!String(m.jotai ?? '').trim()) m.jotai = 'yuko';
        return m;
      }}
      showJotaiColumn={false}
      showJotaiEditor={false}
      enableRowDetail
      rowDetailKeys={[
        'reported_at',
        'flow_stage',
        'reported_by',
        'target_to',
        'category',
        'request',
        'status',
        'task_state',
      ]}
      renderRowDetail={({ row, rowId, items, onInlineFieldChange, inlineSaving }) => {
        const draft = Object.prototype.hasOwnProperty.call(detailDrafts, rowId)
          ? detailDrafts[rowId]
          : String(row?.detail_note || '');
        const saveKey = `${rowId}:detail_note`;
        const saving = !!inlineSaving?.[saveKey];
        const requester = formatSingleOrDash(row?.reported_by);
        const target = formatTargetFull(row?.target_to);
        const logText = String(row?.detail_note || '').trim();
        const byKey = new Map((items || []).map((it) => [it.key, it]));
        const leftKeys = ['reported_at', 'flow_stage', 'reported_by', 'target_to', 'status', 'task_state'];
        const rightTopKeys = ['category', 'request'];
        const leftItemsRaw = leftKeys.map((k) => byKey.get(k)).filter(Boolean);
        const requesterItem = byKey.get('reported_by');
        const targetItem = byKey.get('target_to');
        const leftItems = leftItemsRaw.filter((it) => it.key !== 'reported_by' && it.key !== 'target_to');
        const rightTopItems = rightTopKeys.map((k) => byKey.get(k)).filter(Boolean);
        const onReply = async () => {
          const body = String(draft || '').trim();
          if (!body) return;
          const stamp = new Date().toLocaleString('ja-JP', { hour12: false });
          const dayLabel = new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
          const line = `${stamp} ${target} → ${requester}`;
          const tail = `${dayLabel}返答`;
          const merged = logText ? `${logText}\n${line}\n${body}\n${tail}` : `${line}\n${body}\n${tail}`;
          await onInlineFieldChange('detail_note', merged);
          setDetailDrafts((prev) => ({ ...prev, [rowId]: '' }));
        };
        return (
          <div className="kadai-detail-two-col">
            <div className="kadai-detail-left">
              {leftItems.map((it) => (
                <React.Fragment key={`${rowId}-detail-${it.key}`}>
                  <div className="kadai-detail-row">
                    <div className="k">{it.label}</div>
                    {it.key === 'status' ? (
                      <select
                        className="kadai-detail-inline-select"
                        value={String(row?.status || 'open')}
                        disabled={!!inlineSaving?.[`${rowId}:status`]}
                        onChange={(e) => onInlineFieldChange('status', e.target.value)}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={`status-opt-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : null}
                    {it.key === 'task_state' ? (
                      <>
                        <select
                          className="kadai-detail-inline-select"
                          value={String(row?.task_state || 'mikanryo')}
                          disabled={!!inlineSaving?.[`${rowId}:task_state`]}
                          onChange={(e) => onInlineFieldChange('task_state', e.target.value)}
                        >
                          {TASK_STATE_OPTIONS.map((opt) => (
                            <option key={`task-state-opt-${opt.value}`} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </>
                    ) : null}
                    {it.key !== 'status' && it.key !== 'task_state' ? (
                      <div className="v">{it.value}</div>
                    ) : null}
                  </div>
                  {it.key === 'flow_stage' && (requesterItem || targetItem) ? (
                    <div className="kadai-detail-row kadai-detail-row-actor-flow">
                      <div className="k">{requesterItem?.label || '③依頼者'} / {targetItem?.label || '④対象者'}</div>
                      <div className="v actor-flow-line">
                        <span>{requesterItem?.value || '-'}</span>
                        <span className="arrow">{' → '}</span>
                        <span>{targetItem?.value || '-'}</span>
                      </div>
                    </div>
                  ) : null}
                  {it.key === 'task_state' ? (
                    <div className="kadai-detail-sublog">{fmtUpdateLog(row)}</div>
                  ) : null}
                </React.Fragment>
              ))}
            </div>
            <div className="kadai-detail-right">
              <div className="kadai-detail-right-top">
                {rightTopItems.map((it, idx) => (
                  <React.Fragment key={`${rowId}-detail-top-${it.key}`}>
                    <div className="kadai-detail-row">
                      <div className="k">{it.label}</div>
                      <div className="v">{it.value}</div>
                    </div>
                    {idx < rightTopItems.length - 1 ? (
                      <div className="kadai-detail-flow-arrow mini" aria-hidden="true">↓</div>
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
              <div className="kadai-detail-flow-arrow" aria-hidden="true">↓</div>
              <div className="kadai-detail-log-view">
                {logText || '返答ログはまだありません'}
              </div>
              <div className="kadai-detail-note-head">{'返答内容'}</div>
              <div className="kadai-detail-editor-tools">
                <button type="button" onClick={() => appendDraftText(rowId, '## 見出し')}>見出し</button>
                <button type="button" onClick={() => appendDraftText(rowId, '- 箇条書き')}>箇条書き</button>
                <button type="button" onClick={() => appendDraftText(rowId, '- [ ] チェック項目')}>チェック</button>
                <button type="button" onClick={() => appendDraftText(rowId, '> 引用')}>引用</button>
                <button type="button" onClick={() => appendDraftText(rowId, `日時: ${new Date().toLocaleString('ja-JP', { hour12: false })}`)}>日時</button>
              </div>
              <textarea
                value={draft}
                placeholder="対象者は依頼者へ返す内容を入力してください。"
                onChange={(e) => setDetailDrafts((prev) => ({ ...prev, [rowId]: e.target.value }))}
              />
              <div className="kadai-detail-note-actions">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onInlineFieldChange('detail_note', draft)}
                >
                  {saving ? '保存中...' : '下書き保存'}
                </button>
                <button
                  type="button"
                  className="reply"
                  disabled={saving || !String(draft || '').trim()}
                  onClick={onReply}
                >
                  {saving ? '保存中...' : '返答する'}
                </button>
              </div>
            </div>
          </div>
        );
      }}
      fields={[
        {
          key: 'reported_at',
          label: '①起票日（いつ）',
          columnLabel: '①起票日',
          required: true,
          render: (v, row) => {
            const ymd = String(v || '').trim();
            const elapsedDays = daysSinceYmd(ymd);
            const isDone = String(row?.task_state || '').trim() === 'done';
            const showAlert = elapsedDays >= 3 && !isDone;
            return (
              <span className="kadai-reported-at-cell">
                <span>{ymd || '-'}</span>
                {showAlert ? (
                  <span className="kadai-fire-alert" title={`起票から${elapsedDays}日経過`}>🔥</span>
                ) : null}
              </span>
            );
          },
        },
        {
          key: 'flow_stage',
          label: '②業務フロー段階（どこで）',
          columnLabel: '②業務フロー段階',
          type: 'select',
          options: FLOW_STAGE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'yotei',
          format: (v) => FLOW_STAGE_LABEL_MAP[String(v || '')] || (v || '-'),
          required: true,
        },
        {
          key: 'reported_by',
          label: '③依頼者（誰が）',
          columnLabel: '③依頼者',
          type: 'select',
          options: buildActorOptions,
          valueKey: 'value',
          labelKey: 'label',
          required: true,
          format: (v) => {
            const s = formatSingleOrDash(v);
            return s === '-' ? s : `${s} →`;
          },
          render: (v) => renderMetaTag(formatSingleOrDash(v), 'is-requester'),
        },
        {
          key: 'target_to',
          label: '④対象者（誰に）',
          columnLabel: '④対象者',
          type: 'multi_select',
          overlay: true,
          options: buildActorOptions,
          valueKey: 'value',
          labelKey: 'label',
          required: true,
          format: (v) => {
            const s = formatTargetFull(v);
            return s === '-' ? s : `→ ${s}`;
          },
          render: (v) => renderMetaTag(formatTargetSummary(v), 'is-target'),
        },
        {
          key: 'category',
          label: '⑤課題（何を）',
          columnLabel: '⑤課題',
          required: true,
        },
        {
          key: 'request',
          label: '⑥要望（どうする）',
          columnLabel: '⑥要望',
          type: 'select',
          options: REQUEST_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: '確認',
          required: true,
          format: (v) => {
            const key = String(v || '').trim();
            const hit = REQUEST_OPTIONS.find((x) => x.value === key);
            return hit?.label || key || '-';
          },
          render: (v) => renderMetaTag(String(v || '').trim() || '-', 'is-category'),
        },
        {
          key: 'status',
          label: '⑦状況（いまの状態）',
          columnLabel: '⑦状況',
          type: 'select',
          inlineEdit: true,
          options: STATUS_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'open',
          format: (v) => STATUS_LABEL_MAP[String(v || '')] || (v || '-'),
          render: (v) => {
            const key = String(v || '');
            const label = STATUS_LABEL_MAP[key] || (v || '-');
            const cls = {
              open: 'kadai-status-badge is-open',
              in_progress: 'kadai-status-badge is-progress',
              blocked: 'kadai-status-badge is-blocked',
            }[key] || 'kadai-status-badge';
            return <span className={cls}>{label}</span>;
          },
        },
        {
          key: 'task_state',
          label: '⑧状態',
          columnLabel: '⑧状態',
          type: 'select',
          inlineEdit: true,
          options: TASK_STATE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'mikanryo',
          format: (v) => {
            const key = String(v || '').trim();
            return TASK_STATE_LABEL_MAP[key] || key || '-';
          },
          render: (v) => {
            const key = String(v || '').trim();
            const label = TASK_STATE_LABEL_MAP[key] || key || '-';
            const cls = key === 'done' ? 'kadai-status-badge is-done' : 'kadai-status-badge is-open';
            return <span className={cls}>{label}</span>;
          },
        },
      ]}
    />
  );
}
