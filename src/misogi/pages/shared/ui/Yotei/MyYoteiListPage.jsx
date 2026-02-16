import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import Visualizer from '../Visualizer/Visualizer';
import { apiFetch } from '../../api/client';
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

function normalizeIdentity(v) {
  return safeStr(v);
}

function normId(v) {
  return normalizeIdentity(v).toLowerCase();
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
          ...(Array.isArray(x?.members) ? x.members.flatMap((m) => [m?.jinzai_id]) : []),
        ].filter(Boolean);
      })
    );
  }
  if (v && typeof v === 'object') {
    return normalizeArray([
      v?.jinzai_id,
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
        x?.jinzai_id || '',
        x?.name || x?.jinzai_name || x?.display_name || ''
      );
      if (Array.isArray(x?.members)) {
        x.members.forEach((m) => pushEntry(
          m?.jinzai_id || '',
          m?.name || m?.jinzai_name || m?.display_name || ''
        ));
      }
    });
  };
  fromList(item?.assignees);
  fromList(item?.participants);
  pushEntry(item?.jinzai_id || '', item?.jinzai_name || '');
  return out;
}

function serviceDisplayNames(item) {
  const names = [];
  const push = (v) => {
    const s = safeStr(v);
    if (s) names.push(s);
  };
  push(item?.service_name);
  if (Array.isArray(item?.service_names)) item.service_names.forEach(push);
  if (Array.isArray(item?.services)) {
    item.services.forEach((s) => {
      if (typeof s === 'object') push(s?.name || s?.service_name || '');
      else push(s);
    });
  }
  return Array.from(new Set(names));
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

function formatNameId(name, id) {
  const n = safeStr(name);
  const i = safeStr(id);
  if (n && i) return `${n} (${i})`;
  if (n) return n;
  if (i) return i;
  return '';
}

function normalizeJotai(it) {
  const j = safeStr(it?.jotai || it?.status).toLowerCase();
  return j || 'unknown';
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

function isDemoMode(searchParams) {
  const v = String(searchParams?.get?.('demo') || '').toLowerCase();
  return v === '1' || v === 'true';
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
  const [searchParams] = useSearchParams();
  const job = (jobKey && JOBS[jobKey]) ? JOBS[jobKey] : null;
  const isDemo = isDemoMode(searchParams);

  const { isAuthenticated, isLoading: authLoading, getToken, authz } = useAuth();
  const jinzaiId = authz?.jinzaiId || null;
  const activeJinzaiId = jinzaiId || (isDemo ? 'JINZAI#DEMOSELF' : null);

  const [dateISO, setDateISO] = useState(fmtDate(new Date()));
  const [mode, setMode] = useState('week'); // 'day' | 'week'
  const [assignScope, setAssignScope] = useState('self'); // self | incoming | outgoing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [demoThreads, setDemoThreads] = useState({});
  const [demoDrafts, setDemoDrafts] = useState({});

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTenpoId, setSupportTenpoId] = useState('');
  const [supportTenpoLabel, setSupportTenpoLabel] = useState('');

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
      qs.set('limit', mode === 'day' ? '3000' : '5000');
      if (assignScope === 'self') qs.set('jinzai_id', activeJinzaiId);
      if (range.from === range.to) qs.set('date', range.from);
      else {
        qs.set('from', range.from);
        qs.set('to', range.to);
      }

      const data = await apiFetch(`/yotei?${qs.toString()}`, { headers: authHeaders(), cache: 'no-store' });
      const list = Array.isArray(data) ? data : (data?.items || []);
      setItems(list);
    } catch (e) {
      console.error('[MyYoteiListPage] load failed:', e);
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

  const filteredItems = useMemo(() => {
    const me = normId(activeJinzaiId);
    const src = Array.isArray(items) ? items : [];
    if (!me) return src;
    const isSelf = (it) => {
      const owners = extractParticipantIds(it).map(normId);
      return owners.includes(me);
    };
    const isIncoming = (it) => toIdList(it?.handover_to).map(normId).includes(me);
    const isOutgoing = (it) => toIdList(it?.handover_from).map(normId).includes(me);
    if (assignScope === 'incoming') return src.filter((it) => isIncoming(it));
    if (assignScope === 'outgoing') return src.filter((it) => isOutgoing(it));
    return src.filter((it) => isSelf(it));
  }, [items, activeJinzaiId, assignScope]);

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
    const list = filteredItems;
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
  }, [filteredItems]);

  const totalCount = filteredItems?.length || 0;
  const yukoCount = useMemo(() => {
    return (filteredItems || []).filter((it) => normalizeJotai(it) !== 'torikeshi').length;
  }, [filteredItems]);
  if (authLoading) {
    return (
      <div className="report-page" data-job={jobKey || 'unknown'}>
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
      <div className="report-page" data-job={jobKey || 'unknown'}>
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
    <div className="report-page my-yotei-page" data-job={jobKey || 'unknown'}>
      <div className="report-page-viz"><Visualizer mode="base" /></div>

      <div className="report-page-main">
        <div className="my-yotei-head">
          <div className="my-yotei-title">
            <div className="my-yotei-sub">
              <span className="my-yotei-sub-hidden-id">担当: {activeJinzaiId || '-'}</span>
              {isDemo ? <span className="my-yotei-sub-demo">DEMOモード</span> : null}
            </div>
          </div>
        </div>

        <div className="my-yotei-toolbar">
          <div className="my-yotei-toolbar-right">
            <button type="button" className="btn btn-secondary" onClick={() => setDateISO(fmtDate(new Date()))} disabled={loading}>今日</button>
            <button
              type="button"
              className={`btn btn-secondary ${mode === 'week' ? 'active' : ''}`}
              onClick={() => setMode('week')}
              disabled={loading}
            >
              週次
            </button>
            <button type="button" className="btn btn-primary my-yotei-refresh" onClick={load} disabled={loading}>更新</button>
          </div>

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
          <div className="my-yotei-toolbar-scope">
            <div className="my-yotei-seg">
              <button type="button" className={assignScope === 'self' ? 'active' : ''} onClick={() => setAssignScope('self')} disabled={loading}>自分担当</button>
              <button type="button" className={assignScope === 'incoming' ? 'active' : ''} onClick={() => setAssignScope('incoming')} disabled={loading}>引き継ぎ待ち</button>
              <button type="button" className={assignScope === 'outgoing' ? 'active' : ''} onClick={() => setAssignScope('outgoing')} disabled={loading}>引き継ぎ中</button>
            </div>
          </div>
        </div>

        <div className="my-yotei-summary">
          <div className="my-yotei-summary-item"><span className="k">件数</span><span className="v">{totalCount}</span></div>
          <div className="my-yotei-summary-item"><span className="k">有効</span><span className="v">{yukoCount}</span></div>
        </div>

        {error ? <div className="my-yotei-error">{error}</div> : null}
        {loading ? <div className="my-yotei-loading">読み込み中...</div> : null}

        {!loading && !error && totalCount === 0 ? (
          <div className="my-yotei-empty">
            {assignScope === 'self' && 'この期間に、あなたに割り当てられた予定はありません。'}
            {assignScope === 'incoming' && 'この期間に、あなた宛ての引き継ぎ予定はありません。'}
            {assignScope === 'outgoing' && 'この期間に、あなたから引き継ぐ予定はありません。'}
          </div>
        ) : null}

        <div className="my-yotei-list">
          {grouped.keys.map((k) => {
            const arr = grouped.map.get(k) || [];
            const label = k === 'unknown' ? '日付未設定' : dayjs(k).format('M/D(ddd)');
            return (
              <section key={k} className="my-yotei-day">
                <div className="my-yotei-day-head">
                  <div className="my-yotei-day-label">{label}</div>
                  <div className="my-yotei-day-count">{arr.length}件</div>
                </div>
                <div className="my-yotei-cards">
                  {arr.map((it) => {
                    const jotai = normalizeJotai(it);
                    const tenpoName = safeStr(it?.tenpo_name || it?.store_name || it?.target_name);
                    const tenpoId = safeStr(it?.tenpo_id || it?.store_id);
                    const memo = safeStr(it?.memo || it?.notes || it?.description);
                    const workType = safeStr(it?.work_type || it?.type || '');
                    const start = fmtTime(it?.start_at);
                    const end = fmtTime(it?.end_at);
                    const id = safeStr(it?.yotei_id || it?.schedule_id || it?.id);
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
                    const serviceIds = [
                      ...toIdList(it?.service_id),
                      ...toIdList(it?.service_ids),
                    ];
                    const serviceNames = serviceDisplayNames(it);
                    const serviceEntries = extractServiceEntries(it);
                    const serviceDisplay = Array.from(new Set(
                      serviceEntries
                        .map((s) => formatNameId(s?.name || '', s?.id || ''))
                        .filter(Boolean)
                    ));
                    const serviceContents = serviceContentLines(it);
                    const serviceListForCard = serviceDisplay.length
                      ? serviceDisplay
                      : (serviceNames.length ? serviceNames : serviceIds);
                    const handoverToIds = toIdList(it?.handover_to);
                    const handoverFromIds = toIdList(it?.handover_from);
                    const handoverToDisplay = Array.from(new Set(
                      handoverToIds
                        .map((x) => formatNameId(jinzaiNameMap.get(normId(x)) || '', x))
                        .filter(Boolean)
                    ));
                    const handoverFromDisplay = Array.from(new Set(
                      handoverFromIds
                        .map((x) => formatNameId(jinzaiNameMap.get(normId(x)) || '', x))
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

                    return (
                      <div key={id || `${tenpoId}-${start}-${end}`} className="my-yotei-card">
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
                        <div className="my-yotei-main">
                          <div className="my-yotei-tenpo">
                            <div className="name">{tenpoName || '(現場未設定)'}</div>
                            <div className="meta">
                              {tenpoId ? <span className="code">{tenpoId}</span> : null}
                              {workType ? <span className="tag">{workType}</span> : null}
                            </div>
                          </div>
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
                          <details className="my-yotei-detail">
                            <summary>詳細を開く</summary>
                            <div className="my-yotei-detail-grid">
                              <div><span className="k">yotei_id</span><span className="v">{id || '-'}</span></div>
                              <div><span className="k">yakusoku_id</span><span className="v">{safeStr(it?.yakusoku_id) || '-'}</span></div>
                              <div><span className="k">店舗</span><span className="v">{formatNameId(tenpoName, tenpoId) || '-'}</span></div>
                              <div><span className="k">jinzai</span><span className="v">{participantDisplay.length ? participantDisplay.join(', ') : (participantNames.length ? participantNames.join(', ') : (participantIds.length ? participantIds.join(', ') : '-'))}</span></div>
                              <div><span className="k">service</span><span className="v">{serviceDisplay.length ? serviceDisplay.join(', ') : (serviceNames.length ? serviceNames.join(', ') : (serviceIds.length ? serviceIds.join(', ') : '-'))}</span></div>
                              <div><span className="k">サービス内容</span><span className="v">{serviceContents.length ? serviceContents.join(' / ') : '-'}</span></div>
                              <div><span className="k">handover_to</span><span className="v">{handoverToDisplay.length ? handoverToDisplay.join(', ') : (handoverToIds.join(', ') || '-')}</span></div>
                              <div><span className="k">handover_from</span><span className="v">{handoverFromDisplay.length ? handoverFromDisplay.join(', ') : (handoverFromIds.join(', ') || '-')}</span></div>
                              <div><span className="k">status</span><span className="v">{safeStr(it?.jotai || it?.status) || '-'}</span></div>
                            </div>
                          </details>
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
                        </div>
                        {tenpoId ? (
                          <div className="my-yotei-card-actions">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openSupport(tenpoId, tenpoName)}
                            >
                              対応履歴
                            </button>
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
