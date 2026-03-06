import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeGatewayBase } from '../shared/api/gatewayBase';
import './chinese-tablet-menu.css';

const MENU_ITEMS = [
  { id: 'gyoza', name: '焼き餃子', category: '点心', price: 480, desc: '6個' },
  { id: 'ebi-gyoza', name: '海老蒸し餃子', category: '点心', price: 580, desc: '4個' },
  { id: 'xiao-long-bao', name: '小籠包', category: '点心', price: 620, desc: '4個' },
  { id: 'mapo-tofu', name: '麻婆豆腐', category: '一品', price: 980, desc: '四川風' },
  { id: 'chinjao', name: '青椒肉絲', category: '一品', price: 920, desc: '人気No.1' },
  { id: 'hoikoro', name: '回鍋肉', category: '一品', price: 900, desc: '辛味噌' },
  { id: 'chahan', name: '五目チャーハン', category: '飯', price: 820, desc: 'スープ付き' },
  { id: 'ten-shin-han', name: '天津飯', category: '飯', price: 860, desc: '甘酢あん' },
  { id: 'gomoku-katamen', name: '五目かた焼きそば', category: '麺', price: 960, desc: '野菜たっぷり' },
  { id: 'tantan-men', name: '担々麺', category: '麺', price: 930, desc: '胡麻香る' },
  { id: 'annindofu', name: '杏仁豆腐', category: 'デザート', price: 380, desc: '自家製' },
  { id: 'mango-pudding', name: 'マンゴープリン', category: 'デザート', price: 420, desc: '濃厚' },
];

const CATEGORY_ORDER = ['点心', '一品', '飯', '麺', 'デザート'];
const ORDER_STATUS = [
  { id: 'new', label: '新規' },
  { id: 'cooking', label: '調理中' },
  { id: 'ready', label: '提供準備完了' },
  { id: 'served', label: '提供済み' },
];

const ORDER_STORAGE_PREFIX = 'misesapo-chuka-orders:';
const TABLET_HISTORY_PREFIX = 'misesapo-chuka-tablet-history:';
const EVENT_STORAGE_KEY = 'misesapo-chuka-last-event';
const DEVICE_ID_STORAGE_KEY = 'misesapo-chuka-device-id';
const CHANNEL_NAME = 'misesapo-chuka-menu-events';
const REMOTE_POLL_MS = 4000;

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api-master'
  : normalizeGatewayBase(
    import.meta.env?.VITE_MASTER_API_BASE,
    'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod',
  );

function fmtYen(value) {
  return `¥${Number(value || 0).toLocaleString('ja-JP')}`;
}

function toDateLabel(value) {
  const d = new Date(value);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}:${ss}`;
}

function createDeviceId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `dev_${Date.now().toString(36)}_${rand}`;
}

function normalizeStoreId(raw) {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'chuka-demo';
}

function statusLabel(statusId) {
  return ORDER_STATUS.find((row) => row.id === statusId)?.label || statusId;
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function authHeaders() {
  const token =
    localStorage.getItem('idToken')
    || localStorage.getItem('cognito_id_token')
    || localStorage.getItem('id_token')
    || localStorage.getItem('accessToken')
    || localStorage.getItem('cognito_access_token')
    || localStorage.getItem('token')
    || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ChineseTabletMenuPage() {
  const [role, setRole] = useState('tablet');
  const [storeIdInput, setStoreIdInput] = useState('chuka-demo');
  const [tableNo, setTableNo] = useState('A-01');
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [tabletHistory, setTabletHistory] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [notice, setNotice] = useState('');
  const noticeTimerRef = useRef(null);
  const channelRef = useRef(null);
  const deviceIdRef = useRef('');
  const remoteSeenChatIdsRef = useRef(new Set());

  const storeId = useMemo(() => normalizeStoreId(storeIdInput), [storeIdInput]);
  const senderName = useMemo(() => {
    try {
      const raw = localStorage.getItem('cognito_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        const name = String(
          parsed?.name
          || parsed?.display_name
          || parsed?.attributes?.name
          || parsed?.username
          || '',
        ).trim();
        if (name) return name;
      }
    } catch {
      // ignore
    }
    return 'tablet-menu';
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (saved) {
        deviceIdRef.current = saved;
        return;
      }
      const next = createDeviceId();
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
      deviceIdRef.current = next;
    } catch {
      deviceIdRef.current = createDeviceId();
    }
  }, []);

  useEffect(() => {
    const key = `${ORDER_STORAGE_PREFIX}${storeId}`;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setOrders(parsed);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }
  }, [storeId]);

  useEffect(() => {
    const key = `${TABLET_HISTORY_PREFIX}${storeId}:${deviceIdRef.current || 'unknown'}`;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setTabletHistory(parsed);
      } else {
        setTabletHistory([]);
      }
    } catch {
      setTabletHistory([]);
    }
  }, [storeId]);

  useEffect(() => {
    const key = `${ORDER_STORAGE_PREFIX}${storeId}`;
    try {
      localStorage.setItem(key, JSON.stringify(orders.slice(0, 200)));
    } catch {
      // ignore
    }
  }, [orders, storeId]);

  useEffect(() => {
    const key = `${TABLET_HISTORY_PREFIX}${storeId}:${deviceIdRef.current || 'unknown'}`;
    try {
      localStorage.setItem(key, JSON.stringify(tabletHistory.slice(0, 80)));
    } catch {
      // ignore
    }
  }, [storeId, tabletHistory]);

  useEffect(() => {
    remoteSeenChatIdsRef.current = new Set();
  }, [storeId]);

  const pushNotice = useCallback((message) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice('');
    }, 2400);
  }, []);

  const playTone = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } catch {
      // ignore
    }
  }, []);

  const applyMenuEvent = useCallback((eventPayload) => {
    const payload = eventPayload && typeof eventPayload === 'object'
      ? eventPayload
      : null;
    if (!payload || payload.storeId !== storeId) return;

    if (payload.type === 'order:new') {
      const order = payload.order;
      if (!order || !order.orderId) return;
      setOrders((prev) => {
        if (prev.some((row) => row.orderId === order.orderId)) return prev;
        return [order, ...prev];
      });
      if (role === 'pc' && payload.deviceId !== deviceIdRef.current) {
        playTone();
        pushNotice(`新規注文: ${order.tableNo}`);
      }
      return;
    }

    if (payload.type === 'order:status') {
      const { orderId, status, updatedAt } = payload;
      if (!orderId || !status) return;
      setOrders((prev) => prev.map((row) => (
        row.orderId === orderId
          ? { ...row, status, updatedAt }
          : row
      )));
      if (role === 'tablet') {
        setTabletHistory((prev) => prev.map((row) => (
          row.orderId === orderId
            ? { ...row, status, updatedAt }
            : row
        )));
      }
    }
  }, [playTone, pushNotice, role, storeId]);

  const publishRemoteEvent = useCallback(async (packet) => {
    const base = String(MASTER_API_BASE || '').replace(/\/$/, '');
    if (!base) return;
    const room = `chuka_menu_${storeId}`;
    const message = packet.type === 'order:new'
      ? `注文受信: ${packet?.order?.tableNo || '未指定'}`
      : `注文更新: ${packet?.orderId || ''}`;
    const res = await fetch(`${base}/master/admin_chat`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room,
        message,
        sender_name: senderName,
        data_payload: {
          kind: 'chuka_menu_event',
          packet,
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`remote sync HTTP ${res.status}${txt ? `: ${txt}` : ''}`);
    }
  }, [senderName, storeId]);

  const publishEvent = useCallback((payload) => {
    const packet = {
      ...payload,
      deviceId: deviceIdRef.current,
      sentAt: Date.now(),
    };
    applyMenuEvent(packet);
    try {
      if (channelRef.current) {
        channelRef.current.postMessage(packet);
      }
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(packet));
    } catch {
      // ignore
    }
    publishRemoteEvent(packet).catch(() => {
      // keep local sync even if remote sync fails
    });
  }, [applyMenuEvent, publishRemoteEvent]);

  useEffect(() => {
    let bc = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(CHANNEL_NAME);
        bc.onmessage = (event) => applyMenuEvent(event.data);
        channelRef.current = bc;
      } catch {
        channelRef.current = null;
      }
    }

    const onStorage = (event) => {
      if (event.key !== EVENT_STORAGE_KEY || !event.newValue) return;
      try {
        applyMenuEvent(JSON.parse(event.newValue));
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (bc) {
        bc.close();
      }
      channelRef.current = null;
    };
  }, [applyMenuEvent]);

  useEffect(() => {
    let cancelled = false;
    const base = String(MASTER_API_BASE || '').replace(/\/$/, '');
    if (!base) return undefined;
    const room = `chuka_menu_${storeId}`;
    const tick = async () => {
      try {
        const res = await fetch(
          `${base}/master/admin_chat?limit=500&jotai=yuko&room=${encodeURIComponent(room)}`,
          {
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        const rows = asItems(data)
          .slice()
          .sort((a, b) => String(a?.created_at || '').localeCompare(String(b?.created_at || '')));
        for (const row of rows) {
          const chatId = String(row?.chat_id || '').trim();
          if (!chatId || remoteSeenChatIdsRef.current.has(chatId)) continue;
          remoteSeenChatIdsRef.current.add(chatId);
          const packet = row?.data_payload?.kind === 'chuka_menu_event'
            ? row?.data_payload?.packet
            : null;
          if (!packet || packet.storeId !== storeId) continue;
          applyMenuEvent(packet);
        }
      } catch {
        // ignore remote sync errors and keep local mode
      }
    };
    tick();
    const timer = window.setInterval(() => {
      if (!cancelled) tick();
    }, REMOTE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyMenuEvent, storeId]);

  const categories = useMemo(() => (
    CATEGORY_ORDER.map((category) => ({
      category,
      items: MENU_ITEMS.filter((row) => row.category === category),
    }))
  ), []);

  const cartLines = useMemo(() => {
    return MENU_ITEMS
      .map((item) => ({ ...item, qty: Number(cart[item.id] || 0) }))
      .filter((row) => row.qty > 0);
  }, [cart]);

  const cartCount = useMemo(() => cartLines.reduce((sum, row) => sum + row.qty, 0), [cartLines]);
  const cartTotal = useMemo(() => cartLines.reduce((sum, row) => sum + row.qty * row.price, 0), [cartLines]);

  const selectedOrder = useMemo(() => (
    orders.find((row) => row.orderId === selectedOrderId) || null
  ), [orders, selectedOrderId]);

  const addItem = useCallback((itemId) => {
    setCart((prev) => ({ ...prev, [itemId]: Number(prev[itemId] || 0) + 1 }));
  }, []);

  const setQty = useCallback((itemId, nextQty) => {
    setCart((prev) => {
      const qty = Math.max(0, Number(nextQty || 0));
      if (qty === 0) {
        const { [itemId]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: qty };
    });
  }, []);

  const submitOrder = useCallback(() => {
    if (!cartLines.length) {
      pushNotice('商品を選択してください');
      return;
    }
    const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const order = {
      orderId,
      storeId,
      tableNo: String(tableNo || '').trim() || '未指定',
      status: 'new',
      createdAt: now,
      updatedAt: now,
      items: cartLines.map((line) => ({
        id: line.id,
        name: line.name,
        price: line.price,
        qty: line.qty,
      })),
      total: cartTotal,
      fromDevice: deviceIdRef.current,
    };
    publishEvent({ type: 'order:new', storeId, order });
    setTabletHistory((prev) => [order, ...prev]);
    setCart({});
    pushNotice(`注文を送信しました: ${order.tableNo}`);
  }, [cartLines, cartTotal, publishEvent, pushNotice, storeId, tableNo]);

  const updateStatus = useCallback((orderId, status) => {
    const now = Date.now();
    setOrders((prev) => prev.map((row) => (
      row.orderId === orderId
        ? { ...row, status, updatedAt: now }
        : row
    )));
    publishEvent({ type: 'order:status', storeId, orderId, status, updatedAt: now });
    pushNotice(`状態更新: ${statusLabel(status)}`);
  }, [publishEvent, pushNotice, storeId]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="chuka-menu-page">
      <header className="chuka-head">
        <div className="title-block">
          <h1>中華タブレットメニュー</h1>
          <p>タブレット注文 → PC通知（リアルタイム）</p>
        </div>
        <div className="head-controls">
          <div className="role-switch" role="tablist" aria-label="表示モード">
            <button
              type="button"
              className={role === 'tablet' ? 'active' : ''}
              onClick={() => setRole('tablet')}
            >
              タブレット
            </button>
            <button
              type="button"
              className={role === 'pc' ? 'active' : ''}
              onClick={() => setRole('pc')}
            >
              PC受信
            </button>
          </div>
          <label className="field">
            店舗ID
            <input
              type="text"
              value={storeIdInput}
              onChange={(e) => setStoreIdInput(e.target.value)}
              placeholder="chuka-demo"
            />
          </label>
          {role === 'tablet' ? (
            <label className="field">
              テーブル番号
              <input
                type="text"
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                placeholder="A-01"
              />
            </label>
          ) : null}
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}

      {role === 'tablet' ? (
        <div className="tablet-layout">
          <section className="menu-panel">
            {categories.map((group) => (
              <article key={group.category} className="menu-group">
                <h2>{group.category}</h2>
                <div className="menu-grid">
                  {group.items.map((item) => (
                    <div key={item.id} className="menu-card">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.desc}</span>
                      </div>
                      <div className="menu-card-foot">
                        <em>{fmtYen(item.price)}</em>
                        <button type="button" onClick={() => addItem(item.id)}>追加</button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <aside className="cart-panel">
            <h2>注文カート</h2>
            <p>{cartCount}品 / 合計 {fmtYen(cartTotal)}</p>
            {cartLines.length === 0 ? (
              <div className="empty">商品を追加してください</div>
            ) : (
              <ul className="cart-list">
                {cartLines.map((line) => (
                  <li key={line.id}>
                    <div>
                      <strong>{line.name}</strong>
                      <span>{fmtYen(line.price)}</span>
                    </div>
                    <div className="qty-control">
                      <button type="button" onClick={() => setQty(line.id, line.qty - 1)}>-</button>
                      <span>{line.qty}</span>
                      <button type="button" onClick={() => setQty(line.id, line.qty + 1)}>+</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="submit-btn" onClick={submitOrder}>
              PCへ注文送信
            </button>
            <section className="tablet-history">
              <h3>送信履歴</h3>
              {tabletHistory.length === 0 ? (
                <div className="empty">まだ注文はありません</div>
              ) : (
                <ul>
                  {tabletHistory.map((row) => (
                    <li key={row.orderId}>
                      <div>
                        <strong>{row.tableNo}</strong>
                        <span>{toDateLabel(row.updatedAt || row.createdAt)}</span>
                      </div>
                      <span className={`status status-${row.status}`}>{statusLabel(row.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      ) : (
        <div className="pc-layout">
          <section className="order-list-panel">
            <h2>受信注文</h2>
            {orders.length === 0 ? (
              <div className="empty">注文待機中です</div>
            ) : (
              <ul className="order-list">
                {orders.map((order) => (
                  <li
                    key={order.orderId}
                    className={selectedOrderId === order.orderId ? 'active' : ''}
                    onClick={() => setSelectedOrderId(order.orderId)}
                  >
                    <div className="row-top">
                      <strong>{order.tableNo}</strong>
                      <span className={`status status-${order.status}`}>{statusLabel(order.status)}</span>
                    </div>
                    <div className="row-meta">
                      <span>{toDateLabel(order.createdAt)}</span>
                      <span>{order.items.reduce((sum, item) => sum + item.qty, 0)}品</span>
                      <span>{fmtYen(order.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="order-detail-panel">
            <h2>注文詳細</h2>
            {!selectedOrder ? (
              <div className="empty">左の注文を選択してください</div>
            ) : (
              <>
                <div className="detail-head">
                  <strong>{selectedOrder.tableNo}</strong>
                  <span>{toDateLabel(selectedOrder.createdAt)}</span>
                </div>
                <ul className="detail-items">
                  {selectedOrder.items.map((item) => (
                    <li key={`${selectedOrder.orderId}-${item.id}`}>
                      <span>{item.name}</span>
                      <span>{item.qty} x {fmtYen(item.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="detail-total">合計: {fmtYen(selectedOrder.total)}</div>
                <div className="status-actions">
                  {ORDER_STATUS.map((state) => (
                    <button
                      key={state.id}
                      type="button"
                      className={selectedOrder.status === state.id ? 'active' : ''}
                      onClick={() => updateStatus(selectedOrder.orderId, state.id)}
                    >
                      {state.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
