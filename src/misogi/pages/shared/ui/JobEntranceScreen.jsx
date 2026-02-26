import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Visualizer from './Visualizer/Visualizer';
import Hotbar from './Hotbar/Hotbar';
import { useReportStyleTransition, TRANSITION_CLASS_PAGE, TRANSITION_CLASS_UI } from './ReportTransition/reportTransition.jsx';
import { JOBS } from '../utils/constants';
import { useI18n } from '../i18n/I18nProvider';
import { normalizeGatewayBase } from '../api/gatewayBase';
import { useAuth } from '../auth/useAuth';
import ThemeToggle from './ThemeToggle/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher';

const JOB_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];
const ADMIN_CHAT_ROOM = 'admin_entrance';
const ADMIN_CHAT_POLL_MS = 5000;
const ADMIN_CHAT_MAX_ITEMS = 150;

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

function authHeaders() {
  const legacyAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.token || '';
    } catch {
      return '';
    }
  })();
  const token =
    localStorage.getItem('idToken')
    || localStorage.getItem('cognito_id_token')
    || localStorage.getItem('id_token')
    || localStorage.getItem('accessToken')
    || localStorage.getItem('cognito_access_token')
    || localStorage.getItem('token')
    || legacyAuth
    || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function toDisplayDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

export default function JobEntranceScreen({ job: jobKey, hotbarConfig, showFlowGuideButton = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user, authz } = useAuth();
  const { isTransitioning, startTransition } = useReportStyleTransition(navigate);
  const job = jobKey && JOBS[jobKey];
  const valid = job && JOB_KEYS.includes(jobKey);
  const actions = Array.isArray(hotbarConfig) && hotbarConfig.length > 0 ? hotbarConfig : null;
  const [tab, setTab] = useState(actions?.[0]?.id ?? null);
  const [subGroupByTab, setSubGroupByTab] = useState({});
  const useSidebarNav = jobKey === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return jobKey === 'admin' ? window.innerWidth >= 1024 : false;
  });
  const [openSidebarSections, setOpenSidebarSections] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatItems, setChatItems] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatListRef = useRef(null);

  const onHotbar = (id) => {
    const action = actions?.find((a) => a.id === id);
    setTab(id);

    if (action?.to) {
      if (action.to.startsWith('http')) {
        // External link
        window.location.href = action.to;
      } else {
        // Internal link
        navigate(action.to);
      }
    }
  };

  if (!valid) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>{t('ジョブが見つかりません。')}</p>
        <Link to="/">{t('Portal へ戻る')}</Link>
      </div>
    );
  }

  const currentAction = actions?.find((a) => a.id === tab);
  const tabLabel = t(currentAction?.label ?? tab ?? '');
  // 遷移時の「MODE CHANGE」演出は無効化したいので、Visualizer の log モードは使わない。
  const vizMode = currentAction?.role === 'log' ? 'base' : (currentAction?.role ?? 'base');
  const showTransition = isTransitioning;

  const subGroups = useMemo(() => {
    const items = currentAction?.subItems;
    if (!Array.isArray(items) || items.length === 0) return null;

    const groups = new Map(); // preserve insertion order
    items.forEach((it) => {
      const g = (it && it.group) ? String(it.group) : t('その他');
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    });
    return {
      keys: [...groups.keys()],
      itemsByKey: groups,
    };
  }, [currentAction]);

  // タブ切替時に、サブカテゴリが存在するなら先頭に合わせる（未設定時のみ）
  useEffect(() => {
    if (!currentAction?.id) return;
    if (!subGroups?.keys?.length) return;
    const current = subGroupByTab[currentAction.id];
    if (current && subGroups.itemsByKey.has(current)) return;
    setSubGroupByTab((prev) => ({ ...prev, [currentAction.id]: subGroups.keys[0] }));
  }, [currentAction?.id, subGroups?.keys?.length]);

  const activeSubGroupKey = currentAction?.id ? subGroupByTab[currentAction.id] : null;
  const activeSubItems = useMemo(() => {
    if (!subGroups) return currentAction?.subItems || null;
    if (subGroups.keys.length <= 1) return currentAction?.subItems || null;
    const k = activeSubGroupKey || subGroups.keys[0];
    return subGroups.itemsByKey.get(k) || [];
  }, [subGroups, currentAction, activeSubGroupKey]);

  useEffect(() => {
    if (!useSidebarNav) return;
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [useSidebarNav]);

  const sidebarSections = useMemo(() => {
    if (!useSidebarNav || !Array.isArray(actions)) return [];
    return actions
      .map((section) => {
        const subItems = Array.isArray(section?.subItems) ? section.subItems : [];
        if (!subItems.length) return null;
        const groups = new Map();
        subItems.forEach((item) => {
          const key = item?.group || t('その他');
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(item);
        });
        return {
          id: section.id,
          label: section.label,
          groups: [...groups.entries()].map(([groupLabel, items]) => ({ groupLabel, items })),
        };
      })
      .filter(Boolean);
  }, [actions, t, useSidebarNav]);

  const isPathActive = (path) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const onSidebarNavigate = (path) => {
    if (!path || isTransitioning) return;
    startTransition(path);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const senderName = useMemo(() => {
    const email = String(user?.email || user?.attributes?.email || '').trim();
    const display = String(
      user?.name
      || user?.display_name
      || user?.full_name
      || user?.nickname
      || user?.username
      || user?.id
      || ''
    ).trim();
    if (display) return display;
    if (email.includes('@')) return email.split('@')[0];
    return email || '管理';
  }, [user]);

  const senderId = useMemo(() => {
    return String(
      authz?.workerId
      || user?.id
      || user?.sub
      || user?.username
      || user?.email
      || ''
    ).trim();
  }, [authz?.workerId, user]);

  const fetchAdminChat = useCallback(async (silent = false) => {
    if (!useSidebarNav) return;
    if (!silent) setChatLoading(true);
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      const url = `${base}/master/admin_chat?limit=300&jotai=yuko&room=${encodeURIComponent(ADMIN_CHAT_ROOM)}`;
      const res = await fetch(url, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`admin_chat HTTP ${res.status}${text ? `: ${text}` : ''}`);
      }
      const data = await res.json();
      const list = asItems(data)
        .slice()
        .sort((a, b) => String(a?.created_at || '').localeCompare(String(b?.created_at || '')))
        .slice(-ADMIN_CHAT_MAX_ITEMS);
      setChatItems(list);
      setChatError('');
    } catch (e) {
      setChatError(String(e?.message || e || 'チャット取得エラー'));
    } finally {
      if (!silent) setChatLoading(false);
    }
  }, [useSidebarNav]);

  const sendAdminChat = async () => {
    const msg = String(chatText || '').trim();
    if (!msg || chatSending || !useSidebarNav) return;
    setChatSending(true);
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      const name = msg.length > 24 ? `${msg.slice(0, 24)}…` : msg;
      const body = {
        room: ADMIN_CHAT_ROOM,
        name,
        sender_name: senderName,
        sender_id: senderId,
        message: msg,
        source: 'admin_entrance_chat',
        jotai: 'yuko',
      };
      const res = await fetch(`${base}/master/admin_chat`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`送信失敗: HTTP ${res.status}${text ? ` ${text}` : ''}`);
      }
      setChatText('');
      await fetchAdminChat(true);
      setChatError('');
    } catch (e) {
      setChatError(String(e?.message || e || '送信エラー'));
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (!useSidebarNav || !sidebarSections.length) return;
    setOpenSidebarSections((prev) => {
      const next = {};
      sidebarSections.forEach((section, idx) => {
        next[section.id] = Object.prototype.hasOwnProperty.call(prev, section.id) ? !!prev[section.id] : idx === 0;
      });
      return next;
    });
  }, [sidebarSections, useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav || !sidebarSections.length) return;
    const activeSection = sidebarSections.find((section) =>
      section.groups.some(({ items }) => items.some((item) => isPathActive(item.path || item.to)))
    );
    if (!activeSection) return;
    setOpenSidebarSections((prev) => ({ ...prev, [activeSection.id]: true }));
  }, [location.pathname, sidebarSections, useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav) return;
    let stopped = false;
    const run = async () => {
      if (stopped) return;
      await fetchAdminChat(false);
    };
    run();
    const timer = setInterval(() => {
      fetchAdminChat(true);
    }, ADMIN_CHAT_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [fetchAdminChat, useSidebarNav]);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatItems.length, chatOpen]);

  return (
    <div
      className={`job-entrance-page ${showTransition ? TRANSITION_CLASS_PAGE : ''}`}
      data-job={jobKey}
      style={{ paddingBottom: useSidebarNav ? 24 : 110 }}
    >
      <div className="job-entrance-viz">
        <Visualizer mode={vizMode} />
      </div>
      <div className={`job-entrance-ui ${showTransition ? TRANSITION_CLASS_UI : ''}`}>
        {useSidebarNav && (
          <>
            <button
              type="button"
              className={`job-entrance-sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
              aria-label={t('メニュー')}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <button
              type="button"
              className={`job-entrance-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
              aria-label={t('メニューを閉じる')}
              onClick={() => setSidebarOpen(false)}
            />
            <button
              type="button"
              className={`job-entrance-chat-toggle ${chatOpen ? 'open' : ''}`}
              aria-label={t('チャット')}
              onClick={() => setChatOpen((prev) => !prev)}
            >
              💬
            </button>
            <button
              type="button"
              className={`job-entrance-chat-backdrop ${chatOpen ? 'open' : ''}`}
              aria-label={t('チャットを閉じる')}
              onClick={() => setChatOpen(false)}
            />
            <aside className={`job-entrance-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label={t('管理メニュー')}>
              <div className="job-entrance-sidebar-head">{t('管理メニュー')}</div>
              <div className="job-entrance-sidebar-scroll">
                {sidebarSections.map((section) => (
                  <section key={section.id} className="job-entrance-sidebar-section">
                    <button
                      type="button"
                      className={`job-entrance-sidebar-section-title ${openSidebarSections[section.id] ? 'open' : ''}`}
                      onClick={() =>
                        setOpenSidebarSections((prev) => ({
                          ...prev,
                          [section.id]: !prev[section.id],
                        }))
                      }
                    >
                      <span>{t(section.label)}</span>
                      <span className="job-entrance-sidebar-section-icon">
                        {openSidebarSections[section.id] ? '▾' : '▸'}
                      </span>
                    </button>
                    {openSidebarSections[section.id] && section.groups.map(({ groupLabel, items }) => (
                      <div key={`${section.id}-${groupLabel}`} className="job-entrance-sidebar-group">
                        {section.groups.length > 1 && (
                          <p className="job-entrance-sidebar-group-label">{t(groupLabel)}</p>
                        )}
                        <div className="job-entrance-sidebar-links">
                          {items.map((item) => {
                            const path = item.path || item.to;
                            const active = isPathActive(path);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`job-entrance-sidebar-link ${active ? 'active' : ''}`}
                                onClick={() => onSidebarNavigate(path)}
                                disabled={isTransitioning}
                              >
                                {t(item.label)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <div className="job-entrance-sidebar-footer">
                <div className="job-entrance-sidebar-footer-title">{t('設定')}</div>
                <div className="job-entrance-sidebar-footer-content">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </div>
            </aside>
            <aside className={`job-entrance-chat ${chatOpen ? 'open' : ''}`} aria-label={t('管理チャット')}>
              <div className="job-entrance-chat-head">
                <strong>{t('管理チャット')}</strong>
                <span className="job-entrance-chat-status">{t('5秒更新')}</span>
              </div>
              <div className="job-entrance-chat-log" ref={chatListRef}>
                {chatLoading && chatItems.length === 0 ? (
                  <div className="job-entrance-chat-empty">{t('読み込み中...')}</div>
                ) : chatItems.length === 0 ? (
                  <div className="job-entrance-chat-empty">{t('まだ投稿がありません')}</div>
                ) : (
                  chatItems.map((row) => {
                    const mine = senderId && String(row?.sender_id || '') === senderId;
                    return (
                      <article key={String(row?.chat_id || row?.created_at || Math.random())} className={`job-entrance-chat-item ${mine ? 'mine' : ''}`}>
                        <header>
                          <span className="who">{String(row?.sender_name || '管理')}</span>
                          <span className="at">{toDisplayDateTime(row?.created_at)}</span>
                        </header>
                        <p>{String(row?.message || '')}</p>
                      </article>
                    );
                  })
                )}
              </div>
              <div className="job-entrance-chat-compose">
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(String(e.target.value || '').slice(0, 280))}
                  placeholder={t('メッセージ（最大280文字）')}
                />
                <div className="job-entrance-chat-compose-row">
                  <span className="count">{chatText.length}/280</span>
                  <button type="button" onClick={sendAdminChat} disabled={chatSending || !String(chatText || '').trim()}>
                    {chatSending ? t('送信中...') : t('送信')}
                  </button>
                </div>
                {chatError && <div className="job-entrance-chat-error">{chatError}</div>}
              </div>
            </aside>
          </>
        )}

        <main className={`job-entrance-main ${useSidebarNav ? 'with-sidebar with-admin-chat' : ''}`}>
          <h1 className="job-entrance-title" style={{ color: job.color }}>{job.label}</h1>

          {/* サブホットバー（選択中のアクションに subItems がある場合表示） */}
          {!useSidebarNav && Array.isArray(currentAction?.subItems) && currentAction.subItems.length > 0 && (
            <div className="sub-hotbar-wrap">
              {subGroups?.keys?.length > 1 && (
                <div className="sub-hotbar-groups" role="tablist" aria-label={t('カテゴリ')}>
                  {subGroups.keys.map((k) => {
                    const active = (activeSubGroupKey || subGroups.keys[0]) === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`sub-hotbar-group-btn ${active ? 'active' : ''}`}
                        onClick={() => setSubGroupByTab((prev) => ({ ...prev, [currentAction.id]: k }))}
                        disabled={isTransitioning}
                      >
                        {t(k)}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="sub-hotbar">
                {(activeSubItems || []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="sub-hotbar-btn"
                    onClick={() => {
                      const path = item.path || item.to;
                      if (path) {
                        startTransition(path);
                      }
                    }}
                    disabled={isTransitioning}
                  >
                    {t(item.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {useSidebarNav && (
            <p className="job-entrance-dummy">{t('左のサイドバーから機能を選択してください。')}</p>
          )}

          {!useSidebarNav && !currentAction?.subItems && (
            <p className="job-entrance-dummy">{actions ? `${t('タブ:')} ${tabLabel}` : t('（ダミー画面）')}</p>
          )}
          <p style={{ marginTop: 16 }}><Link to="/">{t('Portal へ戻る')}</Link></p>
        </main>
      </div>
      {!useSidebarNav && actions && (
        <Hotbar actions={actions} active={tab} onChange={onHotbar} showFlowGuideButton={showFlowGuideButton} />
      )}
    </div>
  );
}
