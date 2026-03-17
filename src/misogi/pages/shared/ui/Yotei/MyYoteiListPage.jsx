import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import Visualizer from '../Visualizer/Visualizer';
import { apiFetch, getApiBase } from '../../api/client';
import { normalizeGatewayBase } from '../../api/gatewayBase';
import { useAuth } from '../../auth/useAuth';
import { JOBS } from '../../utils/constants';
import SupportHistoryDrawer from '../SupportHistoryDrawer';
import './my-yotei.css';

function fmtDate(d) {
  return dayjs(d).format('YYYY-MM-DD');
}

function safeStr(v) {
  return String(v == null ? '' : v).trim();
}

function buildDummyStoreUrl(tenpoId = '') {
  const id = encodeURIComponent(safeStr(tenpoId) || 'store');
  return `https://store.misesapo.local/${id}`;
}

function resolveStoreUrl(rawUrl, tenpoId = '') {
  const v = safeStr(rawUrl);
  if (!v) return buildDummyStoreUrl(tenpoId);
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function isValidYmd(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(safeStr(v));
}

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

function masterApiBase() {
  if (isLocalUiHost()) return '/api-master';
  return import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod';
}

function jinzaiApiBase() {
  if (isLocalUiHost()) return '/api-jinzai';
  return import.meta.env?.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod';
}

function yakusokuFallbackBase() {
  return normalizeGatewayBase(import.meta.env?.VITE_YAKUSOKU_API_BASE, getApiBase());
}

async function fetchYakusokuWithFallback(path, options = {}) {
  const primaryBase = String(getApiBase() || '').replace(/\/$/, '');
  const fallbackBase = String(yakusokuFallbackBase() || '').replace(/\/$/, '');

  try {
    const primaryRes = await fetch(`${primaryBase}${path}`, options);
    if (primaryRes.ok) return primaryRes;
    if (![401, 403, 404].includes(primaryRes.status)) return primaryRes;
    if (!fallbackBase || fallbackBase === primaryBase) return primaryRes;
    return await fetch(`${fallbackBase}${path}`, options);
  } catch (e) {
    if (!fallbackBase || fallbackBase === primaryBase) throw e;
    return await fetch(`${fallbackBase}${path}`, options);
  }
}

function normalizeIdentity(v) {
  return safeStr(v);
}

function normId(v) {
  return normalizeIdentity(v).toLowerCase();
}

function normalizeComparableId(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, '');
}

function expandComparableIds(v) {
  const out = [];
  const push = (raw) => {
    const normalized = normalizeComparableId(raw);
    if (!normalized) return;
    out.push(normalized);
    const hashPos = normalized.lastIndexOf('#');
    if (hashPos >= 0 && hashPos < normalized.length - 1) {
      out.push(normalized.slice(hashPos + 1));
    }
  };
  (Array.isArray(v) ? v : [v]).forEach(push);
  return Array.from(new Set(out));
}

function toIdList(v) {
  const normalizeArray = (arr) => (
    (arr || [])
      .map((x) => normalizeIdentity(x))
      .map((x) => safeStr(x))
      .filter(Boolean)
  );

  if (Array.isArray(v)) {
    return normalizeArray(
      v.flatMap((x) => {
        if (!x) return [];
        if (typeof x !== 'object') return [x];
        return [
          x?.jinzai_id,
          x?.worker_id,
          x?.sagyouin_id,
          x?.assigned_to,
          x?.cleaner_id,
          x?.user_id,
          x?.id,
          ...(Array.isArray(x?.members) ? x.members.flatMap((m) => [m?.jinzai_id]) : []),
        ].filter(Boolean);
      })
    );
  }
  if (v && typeof v === 'object') {
    return normalizeArray([
      v?.jinzai_id,
      v?.worker_id,
      v?.sagyouin_id,
      v?.assigned_to,
      v?.cleaner_id,
      v?.user_id,
      v?.id,
      ...(Array.isArray(v?.members) ? v.members.flatMap((m) => [m?.jinzai_id]) : []),
    ].filter(Boolean));
  }
  const s = normalizeIdentity(v);
  if (!s) return [];
  if (s.includes(',')) return normalizeArray(s.split(','));
  return normalizeArray([s]);
}

function extractParticipantIds(item) {
  return Array.from(new Set([
    ...toIdList(item?.jinzai_id),
    ...toIdList(item?.jinzai_ids),
    ...toIdList(item?.worker_id),
    ...toIdList(item?.sagyouin_id),
    ...toIdList(item?.sagyouin_ids),
    ...toIdList(item?.assigned_to),
    ...toIdList(item?.assignee_id),
    ...toIdList(item?.cleaner_id),
    ...toIdList(item?.cleaner_ids),
    ...toIdList(item?.worker_ids),
    ...toIdList(item?.workers),
    ...toIdList(item?.jinzai),
    ...toIdList(item?.worker),
    ...toIdList(item?.sagyouin),
    ...toIdList(item?.assignees),
    ...toIdList(item?.participants),
  ]));
}

function extractParticipantEntries(item) {
  const out = [];
  const pushEntry = (id, name) => {
    const rid = safeStr(id);
    const rname = safeStr(name);
    if (!rid && !rname) return;
    out.push({ id: rid, name: rname });
  };
  const fromList = (v) => {
    if (!Array.isArray(v)) return;
    v.forEach((x) => {
      if (!x) return;
      if (typeof x !== 'object') {
        pushEntry(x, '');
        return;
      }
      pushEntry(
        x?.jinzai_id || x?.worker_id || x?.sagyouin_id || x?.assigned_to || x?.cleaner_id || x?.user_id || x?.id || '',
        x?.name || x?.jinzai_name || x?.display_name || x?.worker_name || x?.sagyouin_name || ''
      );
      if (Array.isArray(x?.members)) {
        x.members.forEach((m) => pushEntry(
          m?.jinzai_id || m?.worker_id || m?.sagyouin_id || m?.assigned_to || m?.cleaner_id || m?.user_id || m?.id || '',
          m?.name || m?.jinzai_name || m?.display_name || m?.worker_name || m?.sagyouin_name || ''
        ));
      }
    });
  };
  fromList(item?.assignees);
  fromList(item?.participants);
  pushEntry(item?.jinzai_id || item?.worker_id || item?.sagyouin_id || item?.assigned_to || item?.cleaner_id || item?.user_id || '', item?.jinzai_name || item?.worker_name || item?.sagyouin_name || '');
  return out;
}

function containsJapaneseText(v) {
  return /[ぁ-んァ-ヶー一-龠々]/.test(safeStr(v));
}

function normalizeWorkTypeLabel(raw, yakusokuType = '') {
  const src = safeStr(raw);
  const yType = safeStr(yakusokuType).toLowerCase();
  if (src.includes('スポット') || src.includes('単発') || yType === 'tanpatsu' || yType === 'spot') {
    return 'スポット清掃';
  }
  if (!src && !yType) return '';
  return '定期清掃';
}

function serviceTagNames(item) {
  const out = [];
  const push = (v) => {
    const s = safeStr(v).replace(/\s*\([^)]*\)\s*$/g, '').trim();
    if (!s) return;
    if (!containsJapaneseText(s)) return;
    out.push(s);
  };
  push(item?.service_name);
  if (Array.isArray(item?.service_names)) item.service_names.forEach(push);
  if (Array.isArray(item?.services)) {
    item.services.forEach((s) => {
      if (!s) return;
      if (typeof s === 'object') {
        push(s?.name || s?.service_name || '');
      } else {
        push(s);
      }
    });
  }
  const entries = extractServiceEntries(item);
  entries.forEach((e) => push(e?.name));
  return Array.from(new Set(out));
}

function extractServiceEntries(item) {
  const out = [];
  const push = (id, name) => {
    const rid = safeStr(id);
    const rname = safeStr(name);
    if (!rid && !rname) return;
    out.push({ id: rid, name: rname });
  };
  push(item?.service_id || '', item?.service_name || '');
  if (Array.isArray(item?.service_ids)) item.service_ids.forEach((x) => push(x, ''));
  if (Array.isArray(item?.service_names)) item.service_names.forEach((x) => push('', x));
  if (Array.isArray(item?.services)) {
    item.services.forEach((s) => {
      if (!s) return;
      if (typeof s === 'object') {
        push(s?.service_id || s?.id || '', s?.name || s?.service_name || '');
      } else {
        push(s, '');
      }
    });
  }
  return out;
}

function serviceContentLines(item) {
  const out = [];
  const push = (v) => {
    const s = safeStr(v);
    if (s) out.push(s);
  };
  const pushFromAny = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach((x) => pushFromAny(x));
      return;
    }
    if (typeof v === 'object') {
      push(v?.name || v?.label || v?.title || v?.content || v?.detail || v?.text || '');
      if (Array.isArray(v?.tags)) v.tags.forEach((t) => pushFromAny(t));
      return;
    }
    push(v);
  };

  const keys = [
    'service_content',
    'service_contents',
    'service_detail',
    'service_details',
    'menu',
    'menus',
    'menu_tags',
    'tags',
    'periodic_menu',
    'periodic_menus',
    'work_items',
    'task_items',
  ];
  keys.forEach((k) => pushFromAny(item?.[k]));

  if (Array.isArray(item?.services)) {
    item.services.forEach((s) => {
      if (!s || typeof s !== 'object') return;
      push(s?.content || s?.detail || s?.description || '');
      pushFromAny(s?.tags);
      pushFromAny(s?.menus);
      pushFromAny(s?.menu_tags);
    });
  }

  return Array.from(new Set(out));
}

function parseAmountCandidates(candidates) {
  for (const v of candidates) {
    if (v == null || v === '') continue;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function resolveYoteiUnitPrice(item, linkedYakusoku = null) {
  const y = linkedYakusoku && typeof linkedYakusoku === 'object' ? linkedYakusoku : null;
  return parseAmountCandidates([
    item?.unit_price,
    item?.price,
    item?.amount,
    item?.kingaku,
    item?.total,
    item?.total_amount,
    item?.estimate_amount,
    item?.yotei_amount,
    item?.service_price,
    item?.yakusoku_price,
    item?.uriage_yotei,
    y?.price,
    y?.unit_price,
    y?.amount,
    y?.service_price,
    y?.yakusoku_price,
  ]);
}

function calcWorkerReward(unitPrice) {
  const n = Number(unitPrice || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 0.8);
}

function formatYen(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

function formatNameId(name, id) {
  const n = safeStr(name);
  const i = safeStr(id);
  if (n && i) return `${n} (${i})`;
  if (n) return n;
  if (i) return i;
  return '';
}

function stripMasterIdLabel(value) {
  const s = safeStr(value);
  if (!s) return '';
  return s.replace(/\b(?:TENPO|YAGOU|TORI)#[-A-Za-z0-9_]+\b/g, '').trim();
}

function isRunningStatusValue(value) {
  const s = safeStr(value).toLowerCase();
  return s === 'working'
    || s === 'shinkou'
    || s === 'in_progress'
    || s === 'progress'
    || s === '実行中'
    || s === '進行中';
}

function isDoneStatusValue(value) {
  const s = safeStr(value).toLowerCase();
  return s === 'done'
    || s === 'kanryou'
    || s === 'completed'
    || s === 'complete'
    || s === '完了';
}

function isCancelStatusValue(value) {
  const s = safeStr(value).toLowerCase();
  return s === 'torikeshi'
    || s === 'cancel'
    || s === 'canceled'
    || s === 'cancelled'
    || s === '取消';
}

function normalizeJotai(it) {
  const candidates = [
    it?.jotai,
    it?.status,
    it?.state,
    it?.jokyo,
    it?.ugoki_jokyo,
    it?.ugoki_jotai,
    it?.ugoki_status,
    it?.progress_status,
  ];
  if (candidates.some((v) => isCancelStatusValue(v))) return 'torikeshi';
  if (candidates.some((v) => isDoneStatusValue(v))) return 'done';
  if (candidates.some((v) => isRunningStatusValue(v))) return 'working';
  const first = safeStr(candidates.find((v) => safeStr(v)));
  return first.toLowerCase() || 'unknown';
}

function jotaiLabel(j) {
  switch (String(j || '').toLowerCase()) {
    case 'yuko': return '有効';
    case 'planned': return '予定';
    case 'working': return '進行中';
    case 'done': return '完了';
    case 'mikanryo': return '未完了';
    case 'torikeshi': return '取消';
    default: return j || '-';
  }
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  return d.format('HH:mm');
}

function pillClass(j) {
  const k = String(j || '').toLowerCase();
  if (k === 'torikeshi') return 'pill pill-cancel';
  if (k === 'done') return 'pill pill-done';
  if (k === 'working') return 'pill pill-working';
  if (k === 'mikanryo') return 'pill pill-mikanryo';
  if (k === 'unknown') return 'pill pill-unknown';
  if (k === 'planned' || k === 'yuko') return 'pill pill-planned';
  return 'pill';
}

const CHAT_TAG_OPTIONS = ['鍵', '入館', '遅延', '再清掃', '注意'];

function normalizeSingleTab(v) {
  const tab = String(v || '').toLowerCase();
  if (tab === 'detail' || tab === 'history' || tab === 'report' || tab === 'tools') return tab;
  return '';
}

function isDemoMode(searchParams) {
  const v = String(searchParams?.get?.('demo') || '').toLowerCase();
  return v === '1' || v === 'true';
}

const BRIEFING_CHECK_ITEMS = [
  { key: 'rule_entry', label: '業務実施場所は確認しましたか？' },
  { key: 'rule_caution', label: '注意事項は確認しましたか？' },
  { key: 'rule_scope', label: '作業内容の確認はしましたか？' },
];

const DETAIL_SUBTAB_OPTIONS = [
  { id: 'basic', label: '基本情報' },
  { id: 'caution', label: '注意事項' },
  { id: 'service', label: '作業内容' },
  { id: 'reward', label: '報酬' },
];

const MISOGI_GUARANTEE_DECLARATION = `ミセサポ安心保証 宣誓
私は、すべての仕事に「ミセサポ安心保証」を付与します。
私は、単なるサービスの提供は行いません。私が、提案するのはサポートという名の安心です。
お客様からお預かりした「信頼」を確かな記録と透明な運用、そして責任ある対応によって「安心」へと変えること。それが、私の役目です。
現場での一つひとつの作業、一枚一枚の写真、一件一件の報告には、すべて理由と責任があります。
私は、見えないところこそ誠実に、曖昧なままにせず、常に説明できる仕事を行います。
私は、お客様からお預かりした信頼を守り、安心へと変え続けるために、この仕事に向き合います。
私は、安心、安全に配慮し、お客様の信頼に誠心誠意お応えし、滞りなく清掃代行業務を全うすることを誓います。`;

const BRIEFING_UNLOCK_STORAGE_KEY = 'misogi-v2-cleaning-briefing-unlocked';
const BRIEFING_DECLARATION_ACCEPTED_STORAGE_KEY = 'misogi-v2-cleaning-briefing-declaration-accepted';

function loadBriefingUnlockMap() {
  try {
    const raw = localStorage.getItem(BRIEFING_UNLOCK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveBriefingUnlockMap(mapObj) {
  try {
    localStorage.setItem(BRIEFING_UNLOCK_STORAGE_KEY, JSON.stringify(mapObj || {}));
  } catch {
    // noop
  }
}

function loadDeclarationAcceptedMap() {
  try {
    const raw = localStorage.getItem(BRIEFING_DECLARATION_ACCEPTED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveDeclarationAcceptedMap(mapObj) {
  try {
    localStorage.setItem(BRIEFING_DECLARATION_ACCEPTED_STORAGE_KEY, JSON.stringify(mapObj || {}));
  } catch {
    // noop
  }
}

function emptyBriefingChecks() {
  return BRIEFING_CHECK_ITEMS.reduce((acc, it) => ({ ...acc, [it.key]: false }), {});
}

function demoItemsForWorker({ jinzaiId, from, to }) {
  const base = dayjs(from || new Date()).format('YYYY-MM-DD');
  const next = dayjs(base).add(1, 'day').format('YYYY-MM-DD');
  const includeNext = dayjs(to).isAfter(dayjs(base), 'day');
  const items = [
    {
      yotei_id: 'YOT-DEMO-WORKER-001',
      date: base,
      scheduled_date: base,
      start_at: `${base}T20:00:00+09:00`,
      end_at: `${base}T22:00:00+09:00`,
      jotai: 'yuko',
      tenpo_id: 'TENPO#DEMO01',
      tenpo_name: 'ビストロ エヴォルテ（デモ）',
      work_type: '定期清掃',
      memo: '床と窓仕上げを重点確認',
      jinzai_id: jinzaiId,
      jinzai_ids: [jinzaiId],
      assignees: [{ jinzai_id: jinzaiId }],
      handover_from: '',
      handover_to: '',
      handoff_prev_summary: {
        date: dayjs(base).subtract(1, 'month').format('YYYY-MM-DD'),
        handled_by: '佐藤 太郎',
        topic: '窓仕上げクレーム再発防止',
        outcome: '乾拭き徹底で解消',
      },
      handoff_checks: {
        key_rule: true,
        entry_rule: true,
        caution_points: true,
        photo_rule: false,
        unresolved_checked: false,
      },
    },
    {
      yotei_id: 'YOT-DEMO-WORKER-002',
      date: base,
      scheduled_date: base,
      start_at: `${base}T23:00:00+09:00`,
      end_at: `${base}T23:50:00+09:00`,
      jotai: 'working',
      tenpo_id: 'TENPO#DEMO02',
      tenpo_name: 'とんかつ さくら 神楽坂（デモ）',
      work_type: 'スポット清掃',
      memo: '鍵ボックス運用あり',
      jinzai_id: jinzaiId,
      jinzai_ids: [jinzaiId, 'JINZAI#W099'],
      handoff_prev_summary: {
        date: dayjs(base).subtract(12, 'day').format('YYYY-MM-DD'),
        handled_by: '鈴木 花子',
        topic: '鍵受け渡し手順',
        outcome: '暗証番号更新済',
      },
      handoff_checks: {
        key_rule: true,
        entry_rule: true,
        caution_points: false,
        photo_rule: false,
        unresolved_checked: true,
      },
      handover_from: jinzaiId,
      handover_to: 'JINZAI#W099',
    },
    {
      yotei_id: 'YOT-DEMO-WORKER-004',
      date: base,
      scheduled_date: base,
      start_at: `${base}T08:30:00+09:00`,
      end_at: `${base}T09:30:00+09:00`,
      jotai: 'mikanryo',
      tenpo_id: 'TENPO#DEMO04',
      tenpo_name: '赤坂テスト店舗（デモ）',
      work_type: 'メンテ巡回',
      memo: 'フィルター清掃 + 写真3枚提出',
      jinzai_id: 'JINZAI#W120',
      handover_to: jinzaiId,
      assignees: [{ jinzai_id: jinzaiId }, { jinzai_id: 'JINZAI#W120' }],
      handoff_prev_summary: {
        date: dayjs(base).subtract(3, 'day').format('YYYY-MM-DD'),
        handled_by: '高橋 次郎',
        topic: '厨房排水溝の臭気',
        outcome: '当日再確認が必要',
      },
      handoff_checks: {
        key_rule: true,
        entry_rule: false,
        caution_points: false,
        photo_rule: false,
        unresolved_checked: true,
      },
    },
  ];
  if (includeNext) {
    items.push({
      yotei_id: 'YOT-DEMO-WORKER-003',
      date: next,
      scheduled_date: next,
      start_at: `${next}T10:00:00+09:00`,
      end_at: `${next}T12:00:00+09:00`,
      jotai: 'planned',
      tenpo_id: 'TENPO#DEMO03',
      tenpo_name: 'モンキーツリー 中野（デモ）',
      work_type: '定期清掃',
      memo: 'グリストラップ＋厨房床',
      jinzai_id: 'JINZAI#W099',
      handover_to: jinzaiId,
      assignees: [{ jinzai_id: jinzaiId }, { jinzai_id: 'JINZAI#W099' }],
      handoff_checks: {
        key_rule: false,
        entry_rule: false,
        caution_points: false,
        photo_rule: false,
        unresolved_checked: false,
      },
    });
  }
  return items;
}

export default function MyYoteiListPage() {
  const { job: jobKey } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const job = (jobKey && JOBS[jobKey]) ? JOBS[jobKey] : null;
  const isDemo = isDemoMode(searchParams);
  const isSingleView = safeStr(searchParams.get('view')).toLowerCase() === 'single';
  const isReportEntry = safeStr(searchParams.get('entry')).toLowerCase() === 'report';
  const focusYoteiId = safeStr(searchParams.get('yotei_id'));
  const focusDateParam = isValidYmd(searchParams.get('date')) ? safeStr(searchParams.get('date')) : '';
  const singleHotbarTab = normalizeSingleTab(searchParams.get('tab'));
  const briefingCheckedByQuery = String(searchParams.get('briefing_checked') || '') === '1';

  const { user, isAuthenticated, isLoading: authLoading, getToken, authz } = useAuth();
  const jinzaiId = authz?.jinzaiId || authz?.workerId || user?.jinzai_id || user?.worker_id || user?.sagyouin_id || null;
  const activeJinzaiId = jinzaiId || (isDemo ? 'JINZAI#DEMOSELF' : null);

  const [dateISO, setDateISO] = useState(focusDateParam || fmtDate(new Date()));
  const [mode, setMode] = useState(isSingleView ? 'day' : 'week'); // 'day' | 'week'
  const [assignScope, setAssignScope] = useState('self'); // self | incoming | outgoing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [demoThreads, setDemoThreads] = useState({});
  const [demoDrafts, setDemoDrafts] = useState({});
  const [openedListCardId, setOpenedListCardId] = useState('');
  const [briefingChecks, setBriefingChecks] = useState(() => emptyBriefingChecks());
  const [detailSubTab, setDetailSubTab] = useState('basic');
  const [briefingUnlockMap, setBriefingUnlockMap] = useState(() => loadBriefingUnlockMap());
  const [declarationAcceptedMap, setDeclarationAcceptedMap] = useState(() => loadDeclarationAcceptedMap());
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTenpoId, setSupportTenpoId] = useState('');
  const [supportTenpoLabel, setSupportTenpoLabel] = useState('');
  const [jinzaiMasterNameMap, setJinzaiMasterNameMap] = useState(new Map());
  const [tenpoMetaMap, setTenpoMetaMap] = useState(new Map());
  const [yagouNameMap, setYagouNameMap] = useState(new Map());
  const [torihikisakiNameMap, setTorihikisakiNameMap] = useState(new Map());
  const [yakusokuMap, setYakusokuMap] = useState(new Map());

  useEffect(() => {
    if (!isSingleView) return;
    setMode('day');
    if (focusDateParam) setDateISO(focusDateParam);
  }, [isSingleView, focusDateParam]);

  const focusUnlockKey = useMemo(() => normId(focusYoteiId), [focusYoteiId]);
  const declarationAcceptKey = useMemo(() => normId(focusYoteiId || ''), [focusYoteiId]);
  const declarationAccepted = useMemo(() => {
    if (!isSingleView) return true;
    if (!declarationAcceptKey) return false;
    return declarationAcceptedMap[declarationAcceptKey] === true;
  }, [isSingleView, declarationAcceptKey, declarationAcceptedMap]);
  const briefingChecked = useMemo(() => {
    if (!isSingleView) return false;
    if (briefingCheckedByQuery) return true;
    if (!focusUnlockKey) return false;
    return briefingUnlockMap[focusUnlockKey] === true;
  }, [isSingleView, briefingCheckedByQuery, focusUnlockKey, briefingUnlockMap]);
  const effectiveSingleHotbarTab = declarationAccepted
    ? (singleHotbarTab || (briefingChecked ? 'detail' : ''))
    : '';

  useEffect(() => {
    if (!isSingleView || !briefingCheckedByQuery || !focusUnlockKey) return;
    if (briefingUnlockMap[focusUnlockKey] === true) return;
    setBriefingUnlockMap((prev) => {
      const next = { ...(prev || {}), [focusUnlockKey]: true };
      saveBriefingUnlockMap(next);
      return next;
    });
  }, [isSingleView, briefingCheckedByQuery, focusUnlockKey, briefingUnlockMap]);

  useEffect(() => {
    if (!isSingleView) return;
    if (briefingChecked) {
      const filled = BRIEFING_CHECK_ITEMS.reduce((acc, it) => ({ ...acc, [it.key]: true }), {});
      setBriefingChecks(filled);
      return;
    }
    setBriefingChecks(emptyBriefingChecks());
  }, [isSingleView, focusYoteiId, briefingChecked]);

  useEffect(() => {
    if (!isSingleView) return;
    setDetailSubTab('basic');
  }, [isSingleView, focusYoteiId]);

  useEffect(() => {
    if (!isSingleView) return;
    if (declarationAccepted) {
      setDeclarationAgreed(true);
      return;
    }
    setDeclarationAgreed(false);
  }, [isSingleView, focusYoteiId, declarationAccepted]);

  useEffect(() => {
    if (!isSingleView || !briefingChecked || !declarationAcceptKey) return;
    if (declarationAcceptedMap[declarationAcceptKey] === true) return;
    setDeclarationAcceptedMap((prev) => {
      const next = { ...(prev || {}), [declarationAcceptKey]: true };
      saveDeclarationAcceptedMap(next);
      return next;
    });
  }, [isSingleView, briefingChecked, declarationAcceptKey, declarationAcceptedMap]);

  const allBriefingChecksDone = useMemo(
    () => BRIEFING_CHECK_ITEMS.every((it) => briefingChecks[it.key] === true),
    [briefingChecks]
  );

  const acceptDeclaration = useCallback(() => {
    if (!isSingleView || !declarationAcceptKey || declarationAccepted) return;
    setDeclarationAcceptedMap((prev) => {
      const next = { ...(prev || {}), [declarationAcceptKey]: true };
      saveDeclarationAcceptedMap(next);
      return next;
    });
  }, [isSingleView, declarationAcceptKey, declarationAccepted]);

  const markBriefingChecked = useCallback(() => {
    if (!isSingleView || !allBriefingChecksDone) return;
    if (declarationAcceptKey) {
      setDeclarationAcceptedMap((prev) => {
        const next = { ...(prev || {}), [declarationAcceptKey]: true };
        saveDeclarationAcceptedMap(next);
        return next;
      });
    }
    if (focusUnlockKey) {
      setBriefingUnlockMap((prev) => {
        const next = { ...(prev || {}), [focusUnlockKey]: true };
        saveBriefingUnlockMap(next);
        return next;
      });
    }
    const next = new URLSearchParams(searchParams);
    next.set('briefing_checked', '1');
    if (!next.get('tab')) next.set('tab', 'detail');
    navigate({ search: `?${next.toString()}` }, { replace: false });
  }, [allBriefingChecksDone, isSingleView, navigate, searchParams, focusUnlockKey, declarationAcceptKey]);

  const range = useMemo(() => {
    const base = dayjs(dateISO);
    if (!base.isValid()) return { from: fmtDate(new Date()), to: fmtDate(new Date()) };
    if (mode === 'day') {
      const d = base.format('YYYY-MM-DD');
      return { from: d, to: d };
    }
    // week: today + 6 days (simple, not calendar-week)
    return { from: base.format('YYYY-MM-DD'), to: base.add(6, 'day').format('YYYY-MM-DD') };
  }, [dateISO, mode]);

  const authHeaders = useCallback(() => {
    const token = getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const openSupport = useCallback((tenpoId, tenpoLabel) => {
    const id = safeStr(tenpoId);
    if (!id) return;
    setSupportTenpoId(id);
    setSupportTenpoLabel(safeStr(tenpoLabel));
    setSupportOpen(true);
  }, []);

  const openHoukokuWithoutYotei = useCallback(() => {
    navigate('/jobs/cleaning/houkoku');
  }, [navigate]);

  const openHoukokuFromYotei = useCallback(async (item) => {
    const key = normId(item?.yotei_id || item?.schedule_id || item?.id);
    let isWorking = normalizeJotai(item) === 'working';
    const yoteiId = safeStr(item?.yotei_id || item?.schedule_id || item?.id);
    // 入口で実行中に切り替えた直後は一覧データが古いことがあるため、報告開始時に最新を再判定する。
    if (!isWorking && yoteiId) {
      try {
        const latest = await apiFetch(`/yotei/${encodeURIComponent(yoteiId)}`, {
          headers: authHeaders(),
          cache: 'no-store',
        });
        const latestRow = (latest && typeof latest === 'object')
          ? (latest?.item || latest?.data || latest)
          : null;
        if (latestRow && typeof latestRow === 'object') {
          isWorking = normalizeJotai(latestRow) === 'working';
        }
      } catch {
        // 再取得失敗時は手元データで判定継続
      }
    }
    const oathAccepted = Boolean(key && declarationAcceptedMap[key] === true);
    const briefingUnlocked = Boolean(key && briefingUnlockMap[key] === true);
    const canStart = Boolean(key && isWorking && oathAccepted && briefingUnlocked);
    if (!canStart) {
      let reason = '報告はまだ開始できません。';
      if (!oathAccepted) reason = '宣誓への同意後に報告が可能です。';
      else if (!briefingUnlocked) reason = '作業前確認の完了後に報告が可能です。';
      else if (!isWorking) reason = '予定が実行中になってから報告を開始してください。';
      setError(reason);
      return;
    }
    if (!yoteiId) return;
    const sp = new URLSearchParams();
    sp.set('yotei_id', yoteiId);
    navigate(`/jobs/cleaning/houkoku?${sp.toString()}`);
  }, [navigate, declarationAcceptedMap, briefingUnlockMap, authHeaders]);

  const load = useCallback(async () => {
    if (!activeJinzaiId) return;
    setLoading(true);
    setError('');
    try {
      if (isDemo) {
        setItems(demoItemsForWorker({ jinzaiId: activeJinzaiId, from: range.from, to: range.to }));
        return;
      }
      const qs = new URLSearchParams();
      const baseLimit = mode === 'day' ? '3000' : '5000';
      qs.set('limit', baseLimit);
      if (assignScope === 'self') {
        qs.set('jinzai_id', activeJinzaiId);
        qs.set('worker_id', activeJinzaiId);
        qs.set('sagyouin_id', activeJinzaiId);
        qs.set('assigned_to', activeJinzaiId);
      }
      if (range.from === range.to) qs.set('date', range.from);
      else {
        qs.set('from', range.from);
        qs.set('to', range.to);
      }

      const data = await apiFetch(`/yotei?${qs.toString()}`, { headers: authHeaders(), cache: 'no-store' });
      const list = Array.isArray(data) ? data : (data?.items || []);

      // API 側の担当者フィルタ実装差異で取りこぼす環境があるため、
      // self かつ空件数時は担当者条件を外して再取得し、画面側で厳密判定する。
      if (assignScope === 'self' && (!Array.isArray(list) || list.length === 0)) {
        const fallbackQs = new URLSearchParams();
        fallbackQs.set('limit', mode === 'day' ? '5000' : '10000');
        if (range.from === range.to) fallbackQs.set('date', range.from);
        else {
          fallbackQs.set('from', range.from);
          fallbackQs.set('to', range.to);
        }
        const fallbackData = await apiFetch(`/yotei?${fallbackQs.toString()}`, { headers: authHeaders(), cache: 'no-store' });
        const fallbackList = Array.isArray(fallbackData) ? fallbackData : (fallbackData?.items || []);
        setItems(Array.isArray(fallbackList) ? fallbackList : []);
        return;
      }

      setItems(list);
    } catch (e) {
      console.error('[MyYoteiListPage] load failed:', e);
      // 担当予定が0件の環境差で 404 を返す実装があるため、404は「予定なし」として扱う。
      if (Number(e?.status || 0) === 404) {
        setError('');
        setItems([]);
        return;
      }
      setError(e?.message || '取得に失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeJinzaiId, mode, range.from, range.to, authHeaders, isDemo, assignScope]);

  useEffect(() => {
    if (!isDemo) return;
    setDemoThreads((prev) => {
      const next = { ...prev };
      (items || []).forEach((it) => {
        const id = safeStr(it?.yotei_id || it?.schedule_id || it?.id);
        if (!id || next[id]) return;
        next[id] = [
          {
            id: `${id}-seed-1`,
            at: dayjs().subtract(20, 'minute').format('YYYY-MM-DD HH:mm'),
            who: '管理',
            scope: 'tenpo',
            tag: '注意',
            text: '前回の引き継ぎ要点を確認してから入館してください。',
          },
          {
            id: `${id}-seed-2`,
            at: dayjs().subtract(10, 'minute').format('YYYY-MM-DD HH:mm'),
            who: '現場',
            scope: 'yotei',
            tag: '入館',
            text: '現地到着。入館前に鍵BOX位置を再確認します。',
          },
        ];
      });
      return next;
    });
  }, [isDemo, items]);

  const appendDemoThread = useCallback((yoteiId) => {
    const id = safeStr(yoteiId);
    if (!id) return;
    const draft = demoDrafts[id] || {};
    const text = safeStr(draft.text || '');
    if (!text) return;
    const scope = safeStr(draft.scope || 'yotei');
    const tag = safeStr(draft.tag || CHAT_TAG_OPTIONS[0]);
    const msg = {
      id: `${id}-${Date.now()}`,
      at: dayjs().format('YYYY-MM-DD HH:mm'),
      who: '現場',
      scope: scope === 'tenpo' ? 'tenpo' : 'yotei',
      tag,
      text: text.slice(0, 140),
    };
    setDemoThreads((prev) => ({ ...prev, [id]: [...(prev[id] || []), msg] }));
    setDemoDrafts((prev) => ({ ...prev, [id]: { ...prev[id], text: '' } }));
  }, [demoDrafts]);

  useEffect(() => {
    if (!isAuthenticated || !activeJinzaiId) return;
    load();
  }, [isAuthenticated, activeJinzaiId, load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const base = jinzaiApiBase().replace(/\/$/, '');
        const res = await fetch(`${base}/jinzai?limit=2000&jotai=yuko`, {
          headers: authHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.items || []);
        const next = new Map();
        (list || []).forEach((it) => {
          const id = normId(it?.jinzai_id || it?.id);
          const name = safeStr(it?.name || it?.display_name || it?.jinzai_name);
          if (id && name && !next.has(id)) next.set(id, name);
        });
        if (alive) setJinzaiMasterNameMap(next);
      } catch {
        // noop
      }
    })();
    return () => { alive = false; };
  }, [authHeaders]);

  useEffect(() => {
    let alive = true;
    const loadMasterRefs = async () => {
      try {
        const tIds = Array.from(new Set(
          (items || [])
            .map((it) => safeStr(it?.tenpo_id || it?.store_id))
            .filter(Boolean)
        ));
        if (!tIds.length) return;
        const base = masterApiBase().replace(/\/$/, '');
        const headers = authHeaders();

        const tenpoEntries = await Promise.all(
          tIds.map(async (tenpoId) => {
            try {
              const res = await fetch(`${base}/master/tenpo/${encodeURIComponent(tenpoId)}`, {
                headers,
                cache: 'no-store',
              });
              if (!res.ok) return [tenpoId, null];
              const it = await res.json();
              return [tenpoId, {
                yagou_id: safeStr(it?.yagou_id),
                torihikisaki_id: safeStr(it?.torihikisaki_id),
                yagou_name: safeStr(it?.yagou_name),
                torihikisaki_name: safeStr(it?.torihikisaki_name),
                address: safeStr(it?.address),
                url: safeStr(
                  it?.url
                  || it?.site_url
                  || it?.website
                  || it?.google_map_url
                  || it?.map_url
                ),
                phone: safeStr(it?.phone || it?.tel || it?.phone_number),
                contact_method: safeStr(
                  it?.contact_method
                  || it?.preferred_contact_method
                  || it?.karte_detail?.spec?.contact_method
                ),
              }];
            } catch {
              return [tenpoId, null];
            }
          })
        );
        if (!alive) return;
        const nextTenpo = new Map();
        tenpoEntries.forEach(([id, meta]) => {
          if (id && meta) nextTenpo.set(id, meta);
        });
        setTenpoMetaMap(nextTenpo);

        const yIds = Array.from(new Set(
          Array.from(nextTenpo.values()).map((m) => safeStr(m?.yagou_id)).filter(Boolean)
        ));
        const toriIds = Array.from(new Set(
          Array.from(nextTenpo.values()).map((m) => safeStr(m?.torihikisaki_id)).filter(Boolean)
        ));

        const yEntries = await Promise.all(
          yIds.map(async (yid) => {
            try {
              const res = await fetch(`${base}/master/yagou/${encodeURIComponent(yid)}`, { headers, cache: 'no-store' });
              if (!res.ok) return [yid, ''];
              const it = await res.json();
              return [yid, safeStr(it?.name)];
            } catch {
              return [yid, ''];
            }
          })
        );
        if (alive) {
          const next = new Map();
          yEntries.forEach(([id, name]) => { if (id && name) next.set(id, name); });
          setYagouNameMap(next);
        }

        const toriEntries = await Promise.all(
          toriIds.map(async (tid) => {
            try {
              const res = await fetch(`${base}/master/torihikisaki/${encodeURIComponent(tid)}`, { headers, cache: 'no-store' });
              if (!res.ok) return [tid, ''];
              const it = await res.json();
              return [tid, safeStr(it?.name)];
            } catch {
              return [tid, ''];
            }
          })
        );
        if (alive) {
          const next = new Map();
          toriEntries.forEach(([id, name]) => { if (id && name) next.set(id, name); });
          setTorihikisakiNameMap(next);
        }
      } catch {
        // noop
      }
    };
    loadMasterRefs();
    return () => { alive = false; };
  }, [items, authHeaders]);

  useEffect(() => {
    let alive = true;
    const loadYakusokuRefs = async () => {
      const yidSet = new Set();
      const embedded = new Map();
      (items || []).forEach((it) => {
        const yid = safeStr(it?.yakusoku_id || it?.yakusoku?.yakusoku_id || it?.yakusoku?.id);
        if (!yid) return;
        yidSet.add(yid);
        if (it?.yakusoku && typeof it.yakusoku === 'object' && !embedded.has(yid)) {
          embedded.set(yid, it.yakusoku);
        }
      });

      if (!yidSet.size) {
        if (alive) setYakusokuMap(new Map());
        return;
      }
      if (isDemo) {
        if (alive) setYakusokuMap(new Map(embedded));
        return;
      }

      try {
        const res = await fetchYakusokuWithFallback('/yakusoku?limit=2000', {
          headers: authHeaders(),
          cache: 'no-store',
        });
        const next = new Map(embedded);
        if (res.ok) {
          const data = await res.json();
          const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
          (rows || []).forEach((row) => {
            const yid = safeStr(row?.yakusoku_id || row?.id);
            if (!yid || !yidSet.has(yid)) return;
            next.set(yid, row);
          });
        }
        if (alive) setYakusokuMap(next);
      } catch {
        if (alive) setYakusokuMap(new Map(embedded));
      }
    };
    loadYakusokuRefs();
    return () => { alive = false; };
  }, [items, authHeaders, isDemo]);

  const filteredItems = useMemo(() => {
    const meTokens = expandComparableIds(activeJinzaiId);
    const meSet = new Set(meTokens);
    const src = Array.isArray(items) ? items : [];
    if (!meSet.size) return src;
    const hasMatch = (values) => {
      const tokens = expandComparableIds(values);
      return tokens.some((token) => meSet.has(token));
    };
    const isSelf = (it) => {
      return hasMatch(extractParticipantIds(it));
    };
    const isIncoming = (it) => hasMatch(toIdList(it?.handover_to));
    const isOutgoing = (it) => hasMatch(toIdList(it?.handover_from));
    if (assignScope === 'incoming') return src.filter((it) => isIncoming(it));
    if (assignScope === 'outgoing') return src.filter((it) => isOutgoing(it));
    return src.filter((it) => isSelf(it));
  }, [items, activeJinzaiId, assignScope]);

  const displayItems = useMemo(() => {
    if (!isSingleView || !focusYoteiId) return filteredItems;
    const target = normId(focusYoteiId);
    return (filteredItems || []).filter((it) => {
      const id = safeStr(it?.yotei_id || it?.schedule_id || it?.id);
      return normId(id) === target;
    });
  }, [filteredItems, isSingleView, focusYoteiId]);

  const jinzaiNameMap = useMemo(() => {
    const map = new Map();
    (items || []).forEach((it) => {
      extractParticipantEntries(it).forEach((p) => {
        const key = normId(p?.id || '');
        const name = safeStr(p?.name || '');
        if (!key || !name) return;
        if (!map.has(key)) map.set(key, name);
      });
    });
    return map;
  }, [items]);

  const grouped = useMemo(() => {
    const list = displayItems;
    const map = new Map();
    list.forEach((it) => {
      const date = safeStr(it?.date || it?.scheduled_date) || (it?.start_at ? dayjs(it.start_at).format('YYYY-MM-DD') : '');
      const key = date || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    // sort within each day
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const as = Date.parse(a?.start_at || '') || 0;
        const bs = Date.parse(b?.start_at || '') || 0;
        return as - bs;
      });
      map.set(k, arr);
    }
    // keep stable order by date asc
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b);
    });
    return { keys, map };
  }, [displayItems]);
  const isBriefingView = isSingleView && !effectiveSingleHotbarTab;

  const totalCount = displayItems?.length || 0;
  const yukoCount = useMemo(() => {
    return (displayItems || []).filter((it) => normalizeJotai(it) !== 'torikeshi').length;
  }, [displayItems]);
  const pageClassName = `report-page my-yotei-page${isSingleView ? ' my-yotei-page-single' : ''}`;
  if (authLoading) {
    return (
      <div className={pageClassName} data-job={jobKey || 'unknown'}>
        <div className="report-page-viz"><Visualizer mode="base" /></div>
        <div className="report-page-main">
          <h1 className="report-page-title">YOTEI</h1>
          <p style={{ opacity: 0.7 }}>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={pageClassName} data-job={jobKey || 'unknown'}>
        <div className="report-page-viz"><Visualizer mode="base" /></div>
        <div className="report-page-main">
          <h1 className="report-page-title">YOTEI（タスク）</h1>
          <p style={{ opacity: 0.8 }}>未ログインです。</p>
          <p><Link to="/">Portal へ</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className={pageClassName} data-job={jobKey || 'unknown'}>
      <div className="report-page-viz"><Visualizer mode="base" /></div>

        <div className="report-page-main">
          {isSingleView ? (
            <section className="my-yotei-top-briefing" aria-label="MISOGIナビ">
              <div className="my-yotei-top-briefing-head">MISOGI</div>
              {briefingChecked ? (
                <div className="my-yotei-briefing-comment-lines">
                  <p className="my-yotei-briefing-comment line">業務内容の確認ご苦労様です。</p>
                  <p className="my-yotei-briefing-comment line">以降はメニューの履歴・報告が選択可能です。</p>
                </div>
              ) : (
                <p className="my-yotei-briefing-comment">
                  {declarationAccepted
                    ? '宣誓への同意を確認しました。「詳細」を押して、作業条件の確認へ進んでください。'
                    : 'ご苦労様です。ミセサポ安心保証宣誓に同意して、詳細確認へとお進みください。'}
                </p>
              )}
            </section>
          ) : null}

          <div className="my-yotei-head">
            {!isSingleView ? <div className="my-yotei-view-head"><strong>予定一覧</strong></div> : null}
            <div className="my-yotei-sub">
              <span className="my-yotei-sub-hidden-id">担当: {activeJinzaiId || '-'}</span>
              {isDemo ? <span className="my-yotei-sub-demo">DEMOモード</span> : null}
          </div>
        </div>

        <div className="my-yotei-toolbar">
          <div className="my-yotei-toolbar-right">
            {!isSingleView ? (
              <button type="button" className="btn btn-secondary" onClick={() => setDateISO(fmtDate(new Date()))} disabled={loading}>今日</button>
            ) : null}
            {!isSingleView ? (
              <button
                type="button"
                className={`btn btn-secondary ${mode === 'week' ? 'active' : ''}`}
                onClick={() => setMode('week')}
                disabled={loading}
              >
                週次
              </button>
            ) : null}
            {!isSingleView ? (
              <button type="button" className="btn btn-primary my-yotei-refresh" onClick={load} disabled={loading}>更新</button>
            ) : null}
          </div>

          {!isSingleView ? (
            <div className="my-yotei-toolbar-left">
              <button type="button" className="btn btn-secondary" onClick={() => setDateISO(fmtDate(dayjs(dateISO).subtract(1, 'day')))} disabled={loading}>←</button>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                className="my-yotei-date"
                disabled={loading}
              />
              <button type="button" className="btn btn-secondary" onClick={() => setDateISO(fmtDate(dayjs(dateISO).add(1, 'day')))} disabled={loading}>→</button>
            </div>
          ) : null}
          {!isSingleView ? (
            <div className="my-yotei-toolbar-scope">
              <div className="my-yotei-seg">
                <button type="button" className={assignScope === 'self' ? 'active' : ''} onClick={() => setAssignScope('self')} disabled={loading}>自分担当</button>
                <button type="button" className={assignScope === 'incoming' ? 'active' : ''} onClick={() => setAssignScope('incoming')} disabled={loading}>引き継ぎ待ち</button>
                <button type="button" className={assignScope === 'outgoing' ? 'active' : ''} onClick={() => setAssignScope('outgoing')} disabled={loading}>引き継ぎ中</button>
              </div>
            </div>
          ) : null}
        </div>

        {!isSingleView ? (
          <div className="my-yotei-summary">
            <div className="my-yotei-summary-item"><span className="k">件数</span><span className="v">{totalCount}</span></div>
            <div className="my-yotei-summary-item"><span className="k">有効</span><span className="v">{yukoCount}</span></div>
          </div>
        ) : null}

        {error ? <div className="my-yotei-error">{error}</div> : null}
        {loading ? <div className="my-yotei-loading">読み込み中...</div> : null}

        {!loading && !error && totalCount === 0 ? (
          <div className="my-yotei-empty">
            {isSingleView ? (
              '指定された予定は見つかりません。'
            ) : (
              <>
                {assignScope === 'self' && 'この期間に、あなたに割り当てられた予定はありません。'}
                {assignScope === 'incoming' && 'この期間に、あなた宛ての引き継ぎ予定はありません。'}
                {assignScope === 'outgoing' && 'この期間に、あなたから引き継ぐ予定はありません。'}
                {assignScope === 'self' && isReportEntry ? (
                  <div className="my-yotei-empty-actions">
                    <button type="button" className="btn btn-primary" onClick={openHoukokuWithoutYotei}>
                      予定なしで報告を作成
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="my-yotei-list">
          {grouped.keys.map((k) => {
            const arr = grouped.map.get(k) || [];
            const label = k === 'unknown' ? '日付未設定' : dayjs(k).format('M/D(ddd)');
            return (
              <section key={k} className="my-yotei-day">
                {!isSingleView ? (
                  <div className="my-yotei-day-head">
                    <div className="my-yotei-day-label">{label}</div>
                    <div className="my-yotei-day-count">{arr.length}件</div>
                  </div>
                ) : null}
                <div className="my-yotei-cards">
                  {arr.map((it) => {
                    const jotai = normalizeJotai(it);
                    const tenpoName = safeStr(it?.tenpo_name || it?.store_name || it?.target_name);
                    const tenpoId = safeStr(it?.tenpo_id || it?.store_id);
                    const tenpoMeta = tenpoMetaMap.get(tenpoId) || null;
                    const yagouId = safeStr(it?.yagou_id || tenpoMeta?.yagou_id);
                    const toriId = safeStr(it?.torihikisaki_id || tenpoMeta?.torihikisaki_id);
                    const yagouName = safeStr(it?.yagou_name || tenpoMeta?.yagou_name || yagouNameMap.get(yagouId));
                    const torihikisakiName = safeStr(it?.torihikisaki_name || tenpoMeta?.torihikisaki_name || torihikisakiNameMap.get(toriId));
                    const tenpoAddress = safeStr(it?.address || tenpoMeta?.address);
                    const tenpoUrl = resolveStoreUrl(
                      it?.url
                      || it?.site_url
                      || it?.website
                      || it?.google_map_url
                      || it?.map_url
                      || tenpoMeta?.url,
                      tenpoId
                    );
                    const tenpoPhone = safeStr(it?.phone || it?.tel || it?.phone_number || tenpoMeta?.phone);
                    const contactMethod = safeStr(
                      it?.contact_method
                      || it?.preferred_contact_method
                      || tenpoMeta?.contact_method
                    );
                    const dispTorihikisaki = stripMasterIdLabel(torihikisakiName) || '-';
                    const dispYagou = stripMasterIdLabel(yagouName) || '-';
                    const dispTenpo = stripMasterIdLabel(tenpoName) || '(現場未設定)';
                    const memo = safeStr(it?.memo || it?.notes || it?.description);
                    const start = fmtTime(it?.start_at);
                    const end = fmtTime(it?.end_at);
                    const id = safeStr(it?.yotei_id || it?.schedule_id || it?.id);
                    const yakusokuId = safeStr(it?.yakusoku_id || it?.yakusoku?.yakusoku_id || it?.yakusoku?.id);
                    const linkedYakusoku = (yakusokuId && yakusokuMap.get(yakusokuId)) || (it?.yakusoku && typeof it.yakusoku === 'object' ? it.yakusoku : null);
                    const workType = normalizeWorkTypeLabel(it?.work_type || it?.type || '', linkedYakusoku?.type || it?.yakusoku?.type || '');
                    const participantIds = extractParticipantIds(it);
                    const participantEntries = extractParticipantEntries(it);
                    const participantNames = Array.from(new Set(
                      participantEntries
                        .map((p) => safeStr(p?.name || ''))
                        .filter(Boolean)
                    ));
                    const participantDisplay = Array.from(new Set(
                      participantEntries
                        .map((p) => formatNameId(p?.name || '', p?.id || ''))
                        .filter(Boolean)
                    ));
                    const participantNameDisplay = Array.from(new Set(
                      participantIds
                        .map((pid) => safeStr(jinzaiMasterNameMap.get(normId(pid)) || jinzaiNameMap.get(normId(pid))))
                        .filter(Boolean)
                    ));
                    const serviceNames = serviceTagNames(it);
                    const serviceContents = serviceContentLines(it);
                    const yakServiceNames = linkedYakusoku ? serviceTagNames(linkedYakusoku) : [];
                    const yakServiceContents = linkedYakusoku ? serviceContentLines(linkedYakusoku) : [];
                    const resolvedServiceDisplay = serviceNames.length
                      ? serviceNames
                      : yakServiceNames;
                    const resolvedServiceContents = serviceContents.length ? serviceContents : yakServiceContents;
                    const serviceListForCard = resolvedServiceDisplay;
                    const handoverToIds = toIdList(it?.handover_to);
                    const handoverFromIds = toIdList(it?.handover_from);
                    const handoverToDisplay = Array.from(new Set(
                      handoverToIds
                        .map((x) => safeStr(
                          jinzaiMasterNameMap.get(normId(x))
                          || jinzaiNameMap.get(normId(x))
                          || x
                        ))
                        .filter(Boolean)
                    ));
                    const handoverFromDisplay = Array.from(new Set(
                      handoverFromIds
                        .map((x) => safeStr(
                          jinzaiMasterNameMap.get(normId(x))
                          || jinzaiNameMap.get(normId(x))
                          || x
                        ))
                        .filter(Boolean)
                    ));
                    const handoffChecks = it?.handoff_checks || {};
                    const handoffDone = [
                      handoffChecks?.key_rule,
                      handoffChecks?.entry_rule,
                      handoffChecks?.caution_points,
                      handoffChecks?.photo_rule,
                      handoffChecks?.unresolved_checked,
                    ].filter(Boolean).length;
                    const handoffPrev = it?.handoff_prev_summary || null;
                    const thread = demoThreads[id] || [];
                    const draft = demoDrafts[id] || { scope: 'yotei', tag: CHAT_TAG_OPTIONS[0], text: '' };
                    const cardId = id || `${tenpoId}-${start}-${end}`;
                    const isExpanded = isSingleView || openedListCardId === cardId;
                    const listTitle = dispYagou && dispYagou !== '-' ? `${dispYagou} / ${dispTenpo}` : dispTenpo;
                    const isDetailTab = isSingleView && effectiveSingleHotbarTab === 'detail';
                    const isHistoryTab = isSingleView && effectiveSingleHotbarTab === 'history';
                    const isReportTab = isSingleView && effectiveSingleHotbarTab === 'report';
                    const isToolsTab = isSingleView && effectiveSingleHotbarTab === 'tools';
                    const isDetailBasicTab = detailSubTab === 'basic';
                    const isDetailCautionTab = detailSubTab === 'caution';
                    const isDetailServiceTab = detailSubTab === 'service';
                    const isDetailRewardTab = detailSubTab === 'reward';
                    const dateLabel = safeStr(it?.date || it?.scheduled_date) || (it?.start_at ? dayjs(it.start_at).format('YYYY-MM-DD') : '-');
                    const timeLabel = `${start || '--:--'} - ${end || '--:--'}`;
                    const unitPrice = resolveYoteiUnitPrice(it, linkedYakusoku);
                    const subtotalLabel = formatYen(unitPrice);
                    const rewardAmount = calcWorkerReward(unitPrice);
                    const rewardLabel = formatYen(rewardAmount);
                    const cautionPrevLabel = handoffPrev
                      ? `${safeStr(handoffPrev?.date) || '-'} / ${safeStr(handoffPrev?.handled_by) || '-'} / ${safeStr(handoffPrev?.topic) || '-'} / ${safeStr(handoffPrev?.outcome) || '-'}`
                      : '前回サマリなし';
                    const isWorkingYotei = jotai === 'working';
                    const itemOathAccepted = Boolean(id && declarationAcceptedMap[normId(id)] === true);
                    const itemBriefingUnlocked = Boolean(id && briefingUnlockMap[normId(id)] === true);
                    const canStartReport = Boolean(id && itemOathAccepted && itemBriefingUnlocked && isWorkingYotei);
                    let reportGuideText = 'この予定に紐づけて報告を作成します。';
                    if (!itemOathAccepted) reportGuideText = '先に宣誓へ同意してください。';
                    else if (!itemBriefingUnlocked) reportGuideText = '先に「詳細」で作業前確認を完了してください。';
                    else if (!isWorkingYotei) reportGuideText = '予定が実行中になってから報告を開始できます。';

                    return (
                      <div key={cardId} className={`my-yotei-card ${!isSingleView ? 'as-list' : ''}`}>
                        {!isSingleView ? (
                          <>
                            <div className="my-yotei-card-top">
                              <div className="my-yotei-time">
                                <span className="t">{start || '--:--'}</span>
                                <span className="sep">-</span>
                                <span className="t">{end || '--:--'}</span>
                              </div>
                              <div className={pillClass(jotai)} title={jotai}>
                                {jotaiLabel(jotai)}
                              </div>
                            </div>
                            <div className="my-yotei-idline">
                              <span className="k">予定ID</span>
                              <code className="v">{id || '-'}</code>
                            </div>
                          </>
                        ) : null}
                        <div className="my-yotei-main">
                          {!isSingleView ? (
                            <div className="my-yotei-tenpo">
                              <button
                                type="button"
                                className="my-yotei-list-name-btn"
                                onClick={() => {
                                  setOpenedListCardId((prev) => (prev === cardId ? '' : cardId));
                                }}
                              >
                                {listTitle}
                              </button>
                              <div className="meta">
                                {workType ? <span className="tag">{workType}</span> : null}
                                <span className="code">{isExpanded ? '詳細を閉じる' : '詳細・引き継ぎを開く'}</span>
                              </div>
                            </div>
                          ) : null}
                          {isExpanded ? (
                            <>
                              {!isSingleView ? (
                                <>
                                  {memo ? <div className="my-yotei-memo">{memo}</div> : null}
                                  {serviceListForCard.length ? (
                                    <div className="my-yotei-services">
                                      <div className="my-yotei-services-head">サービス {serviceListForCard.length}件</div>
                                      <div className="my-yotei-services-tags">
                                        {serviceListForCard.map((s) => (
                                          <span key={`${id}-svc-${s}`} className="svc-tag">{s}</span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="my-yotei-handoff">
                                    <div className="my-yotei-handoff-top">
                                      <strong>引き継ぎ</strong>
                                      <span className="my-yotei-handoff-score">{handoffDone}/5 確認</span>
                                    </div>
                                    {handoffPrev ? (
                                      <div className="my-yotei-handoff-prev">
                                        <span>前回: {safeStr(handoffPrev?.date) || '-'}</span>
                                        <span>担当: {safeStr(handoffPrev?.handled_by) || '-'}</span>
                                        <span>要点: {safeStr(handoffPrev?.topic) || '-'}</span>
                                        <span>結果: {safeStr(handoffPrev?.outcome) || '-'}</span>
                                      </div>
                                    ) : (
                                      <div className="my-yotei-handoff-prev">前回サマリなし</div>
                                    )}
                                  </div>
                                </>
                              ) : null}
                              {isSingleView ? (
                                <>
                                  {isBriefingView && !declarationAccepted ? (
                                    <section className="my-yotei-briefing-declaration" aria-label="ミセサポ安心保証 宣誓">
                                      <div className="my-yotei-briefing-declaration-text">{MISOGI_GUARANTEE_DECLARATION}</div>
                                      <div className="my-yotei-briefing-gate-list">
                                        <label className="my-yotei-briefing-gate-item">
                                          <input
                                            type="checkbox"
                                            checked={declarationAgreed}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setDeclarationAgreed(checked);
                                              if (checked) acceptDeclaration();
                                            }}
                                            disabled={declarationAccepted}
                                          />
                                          <span>上記宣誓に同意して、詳細確認へ進む</span>
                                        </label>
                                      </div>
                                    </section>
                                  ) : null}
                                  <section
                                    className={`my-yotei-detail-sheet my-yotei-detail-static ${isDetailTab ? 'open' : ''}`}
                                    aria-hidden={!isDetailTab}
                                  >
                                    <div className="my-yotei-detail-sheet-head">詳細</div>
                                    <div className="my-yotei-detail-subtabs" role="tablist" aria-label="詳細分類">
                                      {DETAIL_SUBTAB_OPTIONS.map((opt) => (
                                        <button
                                          key={`${cardId}-detail-subtab-${opt.id}`}
                                          type="button"
                                          role="tab"
                                          aria-selected={detailSubTab === opt.id}
                                          className={`my-yotei-detail-subtab-btn ${detailSubTab === opt.id ? 'active' : ''}`}
                                          onClick={() => setDetailSubTab(opt.id)}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>

                                    {isDetailBasicTab ? (
                                      <div className="my-yotei-detail-grid">
                                        <div><span className="k">予定ID</span><span className="v">{id || '-'}</span></div>
                                        <div><span className="k">案件ID</span><span className="v">{yakusokuId || '-'}</span></div>
                                        <div><span className="k">日付</span><span className="v">{dateLabel}</span></div>
                                        <div><span className="k">時間</span><span className="v">{timeLabel}</span></div>
                                        <div><span className="k">取引先</span><span className="v">{dispTorihikisaki}</span></div>
                                        <div><span className="k">屋号</span><span className="v">{dispYagou}</span></div>
                                        <div><span className="k">店舗</span><span className="v">{dispTenpo}</span></div>
                                        <div><span className="k">住所</span><span className="v">{tenpoAddress || '-'}</span></div>
                                        <div><span className="k">URL</span><span className="v">{tenpoUrl || '-'}</span></div>
                                        <div><span className="k">電話番号</span><span className="v">{tenpoPhone || '-'}</span></div>
                                        <div><span className="k">連絡手段</span><span className="v">{contactMethod || '-'}</span></div>
                                        <div><span className="k">担当者</span><span className="v">{participantNameDisplay.length ? participantNameDisplay.join(', ') : (participantDisplay.length ? participantDisplay.join(', ') : (participantNames.length ? participantNames.join(', ') : (participantIds.length ? participantIds.join(', ') : '-')))}</span></div>
                                        <div><span className="k">小計売り上げ</span><span className="v">{subtotalLabel}</span></div>
                                        <div><span className="k">状態</span><span className="v">{jotaiLabel(jotai) || '-'}</span></div>
                                      </div>
                                    ) : null}

                                    {isDetailCautionTab ? (
                                      <div className="my-yotei-detail-grid">
                                        <div><span className="k">注意メモ</span><span className="v">{memo || '-'}</span></div>
                                        <div><span className="k">引き継ぎ先</span><span className="v">{handoverToDisplay.length ? handoverToDisplay.join(', ') : (handoverToIds.join(', ') || '-')}</span></div>
                                        <div><span className="k">引き継ぎ元</span><span className="v">{handoverFromDisplay.length ? handoverFromDisplay.join(', ') : (handoverFromIds.join(', ') || '-')}</span></div>
                                        <div><span className="k">前回サマリ</span><span className="v">{cautionPrevLabel}</span></div>
                                      </div>
                                    ) : null}

                                    {isDetailServiceTab ? (
                                      <div className="my-yotei-detail-grid">
                                        <div><span className="k">作業種別</span><span className="v">{workType || '-'}</span></div>
                                        <div className="my-yotei-detail-service-row">
                                          <span className="k">サービス</span>
                                          {resolvedServiceDisplay.length ? (
                                            <span className="my-yotei-service-tags">
                                              {resolvedServiceDisplay.map((s) => (
                                                <span key={`${cardId}-service-tag-${s}`} className="svc-tag">{s}</span>
                                              ))}
                                            </span>
                                          ) : (
                                            <span className="v">-</span>
                                          )}
                                        </div>
                                        <div><span className="k">サービス内容</span><span className="v">{resolvedServiceContents.length ? resolvedServiceContents.join(' / ') : '-'}</span></div>
                                      </div>
                                    ) : null}

                                    {isDetailRewardTab ? (
                                      <div className="my-yotei-detail-grid">
                                        <div><span className="k">小計売り上げ</span><span className="v">{subtotalLabel}</span></div>
                                        <div><span className="k">報酬</span><span className="v">{rewardLabel}</span></div>
                                        <div><span className="k">報酬率</span><span className="v">80%</span></div>
                                        <div><span className="k">算出式</span><span className="v">小計売り上げ × 0.8</span></div>
                                      </div>
                                    ) : null}

                                    {!briefingChecked ? (
                                      <div className="my-yotei-briefing-gate">
                                        <div className="my-yotei-briefing-gate-head">作業前確認</div>
                                        <div className="my-yotei-briefing-gate-list">
                                          {BRIEFING_CHECK_ITEMS.map((rule) => (
                                            <label key={`${cardId}-gate-${rule.key}`} className="my-yotei-briefing-gate-item">
                                              <input
                                                type="checkbox"
                                                checked={briefingChecks[rule.key] === true}
                                                onChange={(e) => {
                                                  const checked = e.target.checked;
                                                  setBriefingChecks((prev) => ({ ...prev, [rule.key]: checked }));
                                                }}
                                              />
                                              <span>{rule.label}</span>
                                            </label>
                                          ))}
                                        </div>
                                        <div className="my-yotei-briefing-gate-actions">
                                          <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={markBriefingChecked}
                                            disabled={!allBriefingChecksDone}
                                          >
                                            確認完了して報告を解放
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </section>

                                  {isHistoryTab ? (
                                    <section className="my-yotei-single-panel">
                                      <div className="my-yotei-single-panel-head">対応履歴</div>
                                      <p className="my-yotei-single-panel-text">店舗に紐づく過去対応を確認します。</p>
                                      <button type="button" className="btn btn-secondary" onClick={() => openSupport(tenpoId, tenpoName)} disabled={!tenpoId}>
                                        対応履歴を開く
                                      </button>
                                    </section>
                                  ) : null}

                                  {isReportTab ? (
                                    <section className="my-yotei-single-panel">
                                      <div className="my-yotei-single-panel-head">業務報告</div>
                                      <p className="my-yotei-single-panel-text">{reportGuideText}</p>
                                      <button type="button" className="btn btn-primary" onClick={() => openHoukokuFromYotei(it)} disabled={!id}>
                                        この予定で報告を開始
                                      </button>
                                      {!itemBriefingUnlocked ? (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          onClick={() => {
                                            const next = new URLSearchParams(searchParams);
                                            next.set('tab', 'detail');
                                            navigate({ search: `?${next.toString()}` }, { replace: false });
                                          }}
                                        >
                                          詳細へ移動
                                        </button>
                                      ) : null}
                                    </section>
                                  ) : null}

                                  {isToolsTab ? (
                                    <section className="my-yotei-single-panel">
                                      <div className="my-yotei-single-panel-head">ツール</div>
                                      <div className="my-yotei-tools-grid">
                                        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>予定を再取得</button>
                                        <button type="button" className="btn btn-secondary" onClick={() => openSupport(tenpoId, tenpoName)} disabled={!tenpoId}>店舗履歴</button>
                                      </div>
                                    </section>
                                  ) : null}
                                </>
                              ) : (
                                <details className="my-yotei-detail">
                                  <summary>詳細を開く</summary>
                                  <div className="my-yotei-detail-grid">
                                    <div><span className="k">予定ID</span><span className="v">{id || '-'}</span></div>
                                    <div><span className="k">案件ID</span><span className="v">{safeStr(it?.yakusoku_id) || '-'}</span></div>
                                    <div><span className="k">取引先</span><span className="v">{dispTorihikisaki}</span></div>
                                    <div><span className="k">屋号</span><span className="v">{dispYagou}</span></div>
                                    <div><span className="k">店舗</span><span className="v">{dispTenpo}</span></div>
                                    <div><span className="k">住所</span><span className="v">{tenpoAddress || '-'}</span></div>
                                    <div><span className="k">URL</span><span className="v">{tenpoUrl || '-'}</span></div>
                                    <div><span className="k">電話番号</span><span className="v">{tenpoPhone || '-'}</span></div>
                                    <div><span className="k">連絡手段</span><span className="v">{contactMethod || '-'}</span></div>
                                    <div><span className="k">担当者</span><span className="v">{participantNameDisplay.length ? participantNameDisplay.join(', ') : (participantDisplay.length ? participantDisplay.join(', ') : (participantNames.length ? participantNames.join(', ') : (participantIds.length ? participantIds.join(', ') : '-')))}</span></div>
                                    <div><span className="k">サービス</span><span className="v">{resolvedServiceDisplay.length ? resolvedServiceDisplay.join(', ') : '-'}</span></div>
                                    <div><span className="k">サービス内容</span><span className="v">{serviceContents.length ? serviceContents.join(' / ') : '-'}</span></div>
                                    <div><span className="k">引き継ぎ先</span><span className="v">{handoverToDisplay.length ? handoverToDisplay.join(', ') : (handoverToIds.join(', ') || '-')}</span></div>
                                    <div><span className="k">引き継ぎ元</span><span className="v">{handoverFromDisplay.length ? handoverFromDisplay.join(', ') : (handoverFromIds.join(', ') || '-')}</span></div>
                                    <div><span className="k">状態</span><span className="v">{jotaiLabel(jotai) || '-'}</span></div>
                                  </div>
                                </details>
                              )}
                              {isDemo ? (
                                <details className="my-yotei-chat">
                                  <summary>連絡ログ（デモ）</summary>
                                  <div className="my-yotei-chat-note">短文のみ（最大140字） / タグ付き / 店舗 or 予定スレッド</div>
                                  <div className="my-yotei-chat-list">
                                    {thread.length === 0 ? (
                                      <div className="my-yotei-chat-empty">まだ連絡ログはありません</div>
                                    ) : thread.map((m) => (
                                      <div key={m.id} className="my-yotei-chat-row">
                                        <span className="meta">{m.at} / {m.who}</span>
                                        <span className={`scope ${m.scope}`}>{m.scope === 'tenpo' ? '店舗' : '予定'}</span>
                                        <span className="tag">{m.tag}</span>
                                        <span className="txt">{m.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="my-yotei-chat-compose">
                                    <select
                                      value={draft.scope || 'yotei'}
                                      onChange={(e) => setDemoDrafts((prev) => ({ ...prev, [id]: { ...draft, scope: e.target.value } }))}
                                    >
                                      <option value="yotei">予定スレッド</option>
                                      <option value="tenpo">店舗スレッド</option>
                                    </select>
                                    <select
                                      value={draft.tag || CHAT_TAG_OPTIONS[0]}
                                      onChange={(e) => setDemoDrafts((prev) => ({ ...prev, [id]: { ...draft, tag: e.target.value } }))}
                                    >
                                      {CHAT_TAG_OPTIONS.map((t) => <option key={`${id}-${t}`} value={t}>{t}</option>)}
                                    </select>
                                    <input
                                      value={draft.text || ''}
                                      maxLength={140}
                                      placeholder="例: 鍵BOX番号変更。現地着後に管理へ連絡"
                                      onChange={(e) => setDemoDrafts((prev) => ({ ...prev, [id]: { ...draft, text: e.target.value } }))}
                                    />
                                    <button type="button" className="btn btn-secondary" onClick={() => appendDemoThread(id)}>
                                      追加
                                    </button>
                                  </div>
                                </details>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        {isExpanded && !isSingleView && (id || tenpoId) ? (
                          <div className="my-yotei-card-actions">
                            {id ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => openHoukokuFromYotei(it)}
                                disabled={!id}
                              >
                                この予定で報告
                              </button>
                            ) : null}
                            {tenpoId ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => openSupport(tenpoId, tenpoName)}
                              >
                                対応履歴
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <SupportHistoryDrawer
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        tenpoId={supportTenpoId}
        tenpoLabel={supportTenpoLabel}
        getAuthHeaders={authHeaders}
        canEdit={Boolean(authz?.isAdmin)}
      />
    </div>
  );
}
