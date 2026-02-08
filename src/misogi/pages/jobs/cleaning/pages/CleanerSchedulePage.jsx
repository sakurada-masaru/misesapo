import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../../shared/auth/useAuth';
import BlockCreateModal from '../../../shared/ui/BlockCreateModal/BlockCreateModal';
import OfficeClientKartePanel from '../../office/clients/OfficeClientKartePanel';
import { detectBlockConflicts } from '../../../shared/utils/scheduleConflicts';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import '../../../shared/styles/components.css';
import './cleaner-schedule.css';
import '../../../admin/pages/admin-schedule-timeline.css';
import '../../office/clients/office-client-karte-panel.css';

/**
 * 清掃員向けスケジュールページ
 * - 自分のスケジュールのみ表示（閲覧専用）
 * - タイムライン表示
 * - ブロック（クローズ）作成機能のみ
 * 
 * 注意: 清掃員は案件を作成・編集・削除できません。閲覧とブロック作成のみ可能です。
 */

const API_BASE =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    ? '/api'
    : (import.meta.env?.VITE_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod');

const STORAGE_BLOCKS = 'cleaner-schedule-blocks';

function minutesToHHMM(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isoToDateLabel(iso) {
  return dayjs(iso).format('YYYY年MM月DD日');
}

function loadJson(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage save failed', e);
  }
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function apptToConflictShape(appt) {
  const startAt = `${appt.date}T${pad2(Math.floor(appt.start_min / 60))}:${pad2(appt.start_min % 60)}:00`;
  const endAt = `${appt.date}T${pad2(Math.floor(appt.end_min / 60))}:${pad2(appt.end_min % 60)}:00`;
  return {
    id: appt.id,
    schedule_id: appt.schedule_id ?? appt.id,
    assignee_id: appt.cleaner_id,
    start_at: startAt,
    end_at: endAt,
    title: appt.target_name,
    kind: 'job',
  };
}

function blockDisplayForDay(block, dateISO) {
  const dayStartMs = new Date(dateISO + 'T00:00:00').getTime();
  const dayEndMs = new Date(dateISO + 'T23:59:59.999').getTime();
  const blockStartMs = Date.parse(block.start_at);
  const blockEndMs = Date.parse(block.end_at);
  if (Number.isNaN(blockStartMs) || Number.isNaN(blockEndMs) || blockStartMs >= dayEndMs || blockEndMs <= dayStartMs) return null;
  const displayStartMs = Math.max(blockStartMs, dayStartMs);
  const displayEndMs = Math.min(blockEndMs, dayEndMs);
  const start_min = Math.round((displayStartMs - dayStartMs) / 60000);
  const end_min = Math.round((displayEndMs - dayStartMs) / 60000);
  return { start_min, end_min };
}

/** 月間カレンダー：事前申告・シフト管理ツール */
function MonthSimple({ dateISO, setDateISO, appointments, blocks, workerId, onToggleFullDayOff }) {
  const d = dayjs(dateISO);
  const year = d.year();
  const month = d.month();
  const daysInMonth = d.daysInMonth();
  const firstDay = d.startOf('month').day();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <section className="monthPreReport" style={{ padding: '0 8px 32px' }}>
      <div style={{ marginBottom: 20, fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>
        📆 【来月の稼働予定：事前申告】<br />
        <span style={{ fontSize: '1.2rem', color: 'var(--text)' }}>{year}年 {month + 1}月</span>
      </div>

      <div className="monthGrid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
        background: 'var(--card-border)',
        padding: '1px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--card-border)'
      }}>
        {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
          <div key={w} style={{
            background: 'var(--panel)',
            padding: '8px 0',
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--muted)'
          }}>{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} style={{ background: 'var(--bg)', opacity: 0.1 }} />;

          const currentIso = dayjs(`${year}-${month + 1}-${day}`, 'YYYY-M-D').format('YYYY-MM-DD');
          const isSelected = currentIso === dateISO;
          const dayItems = appointments.filter(a => a.date === currentIso);
          const dayBlocks = blocks.filter(b => {
            const display = blockDisplayForDay(b, currentIso);
            return !!display;
          });

          const isFullDayOff = dayBlocks.some(b => {
            const d = blockDisplayForDay(b, currentIso);
            return d && d.start_min <= 5 && d.end_min >= 1435; // バッファを持たせる
          });

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setDateISO(currentIso)}
              style={{
                aspectRatio: '1/1.2',
                background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--panel)',
                border: 'none',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: '8px 4px',
                cursor: 'pointer',
                outline: isSelected ? '2px solid #3b82f6' : 'none',
                zIndex: isSelected ? 1 : 0
              }}
            >
              <div style={{
                fontSize: '0.9rem',
                fontWeight: isSelected ? '800' : '500',
                color: isFullDayOff ? '#ef4444' : 'var(--text)',
                marginBottom: 4
              }}>{day}</div>

              {isFullDayOff ? (
                <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 'bold' }}>休み</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center' }}>
                  {dayItems.length > 0 && (
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6'
                    }} title={`${dayItems.length}件の予定`} />
                  )}
                  {dayBlocks.length > 0 && !isFullDayOff && (
                    <div style={{
                      width: '12px', height: '2px', background: '#f59e0b', borderRadius: '1px'
                    }} title="一部ブロックあり" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 24, background: 'var(--panel)', borderRadius: '16px', padding: '20px', border: '1px solid var(--line)' }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{dayjs(dateISO).format('M月D日')} の申告</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            type="button"
            className="btn"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.8rem'
            }}
            onClick={() => onToggleFullDayOff(dateISO, 'full')}
          >
            ❌ 終日休み
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              fontSize: '0.8rem'
            }}
            onClick={() => onToggleFullDayOff(dateISO, 'am')}
          >
            🌅 午前休み
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.8rem'
            }}
            onClick={() => onToggleFullDayOff(dateISO, 'pm')}
          >
            🌇 午後休み
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: '0.8rem' }}
            onClick={() => { setView('day'); }}
          >
            🕓 詳細設定
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 12, textAlign: 'center' }}>
          ※カレンダーで日付を選んで「休み」を登録してください。<br />
          ここで登録した休みは管理者のスケジュール表に自動反映されます。
        </p>
      </div>
    </section>
  );
}

export default function CleanerSchedulePage() {
  const { user, isAuthenticated, isLoading, getToken } = useAuth();
  const navigate = useNavigate();
  const [dateISO, setDateISO] = useState(dayjs().format('YYYY-MM-DD'));
  const [view, setView] = useState('day'); // 'day' | 'week' | 'month'
  const [appointments, setAppointments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [workerId, setWorkerId] = useState(null); // workersテーブルのID
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalStartAt, setBlockModalStartAt] = useState(null);
  const [blockModalEndAt, setBlockModalEndAt] = useState(null);
  const [blockConflictError, setBlockConflictError] = useState(null);
  /** カルテDock用: 選択した案件（閲覧専用） */
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [karteDockHeight, setKarteDockHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('cleaner-schedule-karte-dock-height');
      return saved ? Math.max(200, parseInt(saved, 10)) : 320;
    } catch { return 320; }
  });
  const [isResizingKarteDock, setIsResizingKarteDock] = useState(false);
  const kartePanelRef = useRef(null);

  // 認証チェック
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      navigate('/');
      return;
    }
    if (user && user.role !== 'cleaning' && user.role !== 'staff' && user.role !== 'admin') {
      navigate('/');
      return;
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  // workers APIから自分のworker情報を取得
  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      console.log('[CleanerSchedulePage] Skipping worker fetch:', { isAuthenticated, userEmail: user?.email });
      return;
    }

    const fetchWorkerInfo = async () => {
      console.log('[CleanerSchedulePage] Fetching worker info for email:', user.email);
      try {
        const token = getToken();
        if (!token) {
          console.warn('[CleanerSchedulePage] No token available for worker fetch');
          return;
        }

        const url = `${API_BASE}/workers`;
        console.log('[CleanerSchedulePage] Fetching workers from:', url);

        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.warn('[CleanerSchedulePage] Failed to fetch workers:', res.status, errorText);
          return;
        }

        const data = await res.json();
        const workers = Array.isArray(data) ? data : (data?.items || []);

        console.log('[CleanerSchedulePage] Workers fetched:', workers.length, 'workers');
        console.log('[CleanerSchedulePage] Looking for email:', user.email);

        // 自分のメールアドレスでworkerを検索
        const myWorker = workers.find(w => {
          const workerEmail = w.email || w.email_address || '';
          const matches = workerEmail.toLowerCase() === user.email.toLowerCase();
          if (matches) {
            console.log('[CleanerSchedulePage] Found matching worker:', w);
          }
          return matches;
        });

        if (myWorker) {
          // workerのIDを取得（id, worker_id, user_idのいずれか）
          const id = myWorker.id || myWorker.worker_id || myWorker.user_id;
          if (id) {
            setWorkerId(String(id));
            console.log('[CleanerSchedulePage] Set worker ID:', id);
          } else {
            console.warn('[CleanerSchedulePage] Worker found but no ID:', myWorker);
          }
        } else {
          console.warn('[CleanerSchedulePage] Worker not found for email:', user.email);
          console.log('[CleanerSchedulePage] Available workers:', workers.map(w => ({
            id: w.id,
            email: w.email || w.email_address,
            name: w.name
          })));
        }
      } catch (error) {
        console.error('[CleanerSchedulePage] Failed to fetch worker info:', error);
      }
    };

    fetchWorkerInfo();
  }, [isAuthenticated, user?.email, getToken]);

  /** 週の月曜〜日曜を返す（dateISO を含む週） */
  const getWeekRange = useCallback((d) => {
    const day = dayjs(d);
    const dow = day.day(); // 0=Sun, 1=Mon, ...
    const monday = dow === 0 ? day.subtract(6, 'day') : day.subtract(dow - 1, 'day');
    const sunday = monday.add(6, 'day');
    return { weekStart: monday.format('YYYY-MM-DD'), weekEnd: sunday.format('YYYY-MM-DD') };
  }, []);

  /** 月の1日〜末日を返す */
  const getMonthRange = useCallback((d) => {
    const day = dayjs(d);
    return {
      monthStart: day.startOf('month').format('YYYY-MM-DD'),
      monthEnd: day.endOf('month').format('YYYY-MM-DD'),
    };
  }, []);

  // スケジュール取得（閲覧専用）。view が week のときはその週の月〜日で取得
  const loadSchedules = useCallback(async (targetWorkerId) => {
    if (!targetWorkerId) {
      console.log('[CleanerSchedulePage] Skipping loadSchedules: workerId is null');
      setAppointments([]);
      setLoading(false);
      return;
    }

    let dateFrom = dateISO;
    let dateTo = dateISO;
    if (view === 'week') {
      const r = getWeekRange(dateISO);
      dateFrom = r.weekStart;
      dateTo = r.weekEnd;
    } else if (view === 'month') {
      const r = getMonthRange(dateISO);
      dateFrom = r.monthStart;
      dateTo = r.monthEnd;
    }

    console.log('[CleanerSchedulePage] Loading schedules for workerId:', targetWorkerId, 'date:', dateISO, 'view:', view, 'range:', dateFrom, dateTo);
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        console.error('[CleanerSchedulePage] No token available');
        setLoading(false);
        return;
      }

      const url = `${API_BASE}/schedules?date_from=${dateFrom}&date_to=${dateTo}&worker_id=${encodeURIComponent(targetWorkerId)}&limit=1000`;

      console.log('[CleanerSchedulePage] Fetching:', url);

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${String(token).trim()}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[CleanerSchedulePage] API Error:', res.status, errorText);
        throw new Error(`Failed to fetch schedules: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      const schedules = data.items || [];

      console.log('[CleanerSchedulePage] API Response:', {
        url,
        status: res.status,
        schedulesCount: schedules.length,
        firstSchedule: schedules[0] || null,
        targetWorkerId,
      });

      // フロントエンド用の形式に変換
      const converted = schedules.map(s => {
        let startMin = 0;
        let endMin = 0;

        if (s.start_time) {
          const startDate = dayjs(s.start_time);
          startMin = startDate.hour() * 60 + startDate.minute();
        } else if (s.start_min !== undefined) {
          startMin = s.start_min;
        }

        if (s.end_time) {
          const endDate = dayjs(s.end_time);
          endMin = endDate.hour() * 60 + endDate.minute();
        } else if (s.end_min !== undefined) {
          endMin = s.end_min;
        }

        return {
          id: s.id || s.schedule_id,
          schedule_id: s.id || s.schedule_id,
          cleaner_id: s.worker_id || s.assigned_to || s.cleaner_id,
          target_name: s.store_name || s.target_name || s.client_name || s.summary || '現場名不明',
          start_min: startMin,
          end_min: endMin,
          status: s.status || 'booked',
          work_type: s.work_type || '定期清掃',
          store_id: s.store_id,
          client_id: s.client_id,
          date: s.date || s.scheduled_date || dateISO,
        };
      });

      console.log('[CleanerSchedulePage] Converted schedules:', converted.length);
      setAppointments(converted);
    } catch (error) {
      console.error('[CleanerSchedulePage] Failed to load schedules:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [dateISO, view, getToken, getWeekRange, getMonthRange]);

  // workerIdが設定されたらスケジュールを読み込む（日別 or 週間で範囲を変える）
  useEffect(() => {
    console.log('[CleanerSchedulePage] useEffect for loadSchedules triggered:', {
      isAuthenticated,
      workerId,
      dateISO,
      view,
      loadSchedulesExists: typeof loadSchedules === 'function'
    });

    if (!isAuthenticated || !workerId) {
      console.log('[CleanerSchedulePage] Skipping loadSchedules:', { isAuthenticated, workerId });
      return;
    }
    // isLoadingはuseAuthの状態なので、ここではチェックしない
    console.log('[CleanerSchedulePage] Triggering loadSchedules:', { isAuthenticated, workerId, dateISO });
    loadSchedules(workerId);
  }, [isAuthenticated, workerId, dateISO, view, loadSchedules]);

  // ブロックをAPIから取得
  const loadBlocks = useCallback(async (targetWorkerId) => {
    if (!targetWorkerId) {
      console.log('[CleanerSchedulePage] Skipping loadBlocks: workerId is null');
      setBlocks([]);
      setBlocksLoading(false);
      return;
    }

    console.log('[CleanerSchedulePage] Loading blocks for workerId:', targetWorkerId);
    setBlocksLoading(true);
    try {
      const token = getToken();
      if (!token) {
        console.error('[CleanerSchedulePage] No token available for blocks');
        setBlocks([]);
        setBlocksLoading(false);
        return;
      }

      // 現在の日付から前後7日間の範囲でブロックを取得
      const dateFrom = dayjs(dateISO).subtract(7, 'day').format('YYYY-MM-DD');
      const dateTo = dayjs(dateISO).add(7, 'day').format('YYYY-MM-DD');
      const url = `${API_BASE}/blocks?user_id=${encodeURIComponent(targetWorkerId)}&date_from=${dateFrom}&date_to=${dateTo}&limit=1000`;

      console.log('[CleanerSchedulePage] Fetching blocks:', url);

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${String(token).trim()}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[CleanerSchedulePage] Failed to fetch blocks:', res.status, errorText);
        // エラー時はlocalStorageからフォールバック
        const fallbackBlocks = loadJson(STORAGE_BLOCKS, []);
        setBlocks(fallbackBlocks);
        setBlocksLoading(false);
        return;
      }

      const data = await res.json();
      const blocksList = data.items || [];

      console.log('[CleanerSchedulePage] Blocks fetched:', blocksList.length);
      setBlocks(blocksList);

      // 成功時はlocalStorageにも保存（オフライン時のフォールバック用）
      saveJson(STORAGE_BLOCKS, blocksList);
    } catch (error) {
      console.error('[CleanerSchedulePage] Failed to load blocks:', error);
      // エラー時はlocalStorageからフォールバック
      const fallbackBlocks = loadJson(STORAGE_BLOCKS, []);
      setBlocks(fallbackBlocks);
    } finally {
      setBlocksLoading(false);
    }
  }, [dateISO, getToken]);

  // workerIdが設定されたらブロックを読み込む
  useEffect(() => {
    if (!isAuthenticated || !workerId) {
      console.log('[CleanerSchedulePage] Skipping loadBlocks:', { isAuthenticated, workerId });
      return;
    }
    loadBlocks(workerId);
  }, [isAuthenticated, workerId, loadBlocks]);

  // カルテDock用: 選択した案件の店舗情報を取得（閲覧専用）
  useEffect(() => {
    if (!selectedAppt?.store_id) {
      setSelectedStore(null);
      return;
    }
    let cancelled = false;
    const token = getToken();
    const base = API_BASE.replace(/\/$/, '');
    fetch(`${base}/stores/${selectedAppt.store_id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSelectedStore(data);
      })
      .catch(() => {
        if (!cancelled) setSelectedStore(null);
      });
    return () => { cancelled = true; };
  }, [selectedAppt?.store_id, getToken]);

  useEffect(() => {
    try {
      localStorage.setItem('cleaner-schedule-karte-dock-height', String(karteDockHeight));
    } catch (_) { }
  }, [karteDockHeight]);

  const handleCloseKarteDock = useCallback(() => {
    setSelectedAppt(null);
    setSelectedStore(null);
  }, []);

  const handleKarteDockResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingKarteDock(true);
    const startY = e.clientY ?? e.touches?.[0]?.clientY;
    const startHeight = karteDockHeight;
    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      const currentY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (currentY != null && startY != null) {
        const delta = startY - currentY;
        const newHeight = Math.max(200, Math.min(window.innerHeight - 100, startHeight + delta));
        setKarteDockHeight(newHeight);
      }
    };
    const handleEnd = () => {
      setIsResizingKarteDock(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }, [karteDockHeight]);


  // ブロック作成モーダルを開く
  const openBlockModal = useCallback((startMin, endMin) => {
    const dayEnd = 24 * 60;
    const start = startMin ?? 9 * 60;
    const end = endMin ?? Math.min(start + 60, dayEnd);
    setBlockConflictError(null);
    setBlockModalStartAt(`${dateISO}T${minutesToHHMM(start)}`);
    setBlockModalEndAt(`${dateISO}T${minutesToHHMM(end)}`);
    setBlockModalOpen(true);
  }, [dateISO]);

  // ブロック作成モーダルを閉じる
  const closeBlockModal = useCallback(() => {
    setBlockModalOpen(false);
    setBlockModalStartAt(null);
    setBlockModalEndAt(null);
    setBlockConflictError(null);
  }, []);

  // ブロック作成
  const createBlock = useCallback(async (payload) => {
    if (!workerId) {
      setBlockConflictError('清掃員情報が取得できていません');
      return;
    }

    const uid = String(workerId);
    const newBlock = {
      user_id: uid,
      worker_id: uid,
      assigned_to: uid,
      start_at: payload.start_at,
      end_at: payload.end_at,
      type: 'personal_close',
      reason_code: payload.reason_code ?? 'other',
      reason_note: payload.reason_note ?? null,
      visibility: 'admin_only',
    };

    // 重複チェック
    const existingAppointmentsForCheck = appointments.map(apptToConflictShape);
    const userIdToName = { [workerId]: user?.name || '自分' };
    const conflicts = detectBlockConflicts({
      block: newBlock,
      existingAppointments: existingAppointmentsForCheck,
      existingBlocks: blocks,
      userIdToName,
    });

    if (conflicts.length > 0) {
      setBlockConflictError(`409 Conflict（重複のため登録できません）\n${conflicts.map((c) => c.message).join('\n')}`);
      return;
    }

    // APIに保存
    try {
      const token = getToken();
      if (!token) {
        throw new Error('認証トークンが取得できません');
      }

      const url = `${API_BASE}/blocks`;
      console.log('[CleanerSchedulePage] Creating block:', url, newBlock);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${String(token).trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newBlock),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const createdBlock = data.block || newBlock;

      console.log('[CleanerSchedulePage] Block created:', createdBlock);

      // ローカル状態を更新
      setBlocks((prev) => [...prev, createdBlock]);

      // localStorageにも保存（オフライン時のフォールバック用）
      const updatedBlocks = [...blocks, createdBlock];
      saveJson(STORAGE_BLOCKS, updatedBlocks);

      closeBlockModal();
    } catch (error) {
      console.error('[CleanerSchedulePage] Failed to create block:', error);
      setBlockConflictError(`ブロックの作成に失敗しました: ${error.message}`);
    }
  }, [workerId, appointments, blocks, user?.name, closeBlockModal, getToken, loadBlocks]);

  // 休み申告ハンドラー（月間から1タップ用）
  const handleToggleFullDayOff = useCallback(async (iso, mode = 'full') => {
    if (!workerId) return;

    let start_at = `${iso}T00:00:00`;
    let end_at = `${iso}T23:59:00`;
    let label = '終日休み';

    if (mode === 'am') {
      end_at = `${iso}T12:00:00`;
      label = '午前休み';
    } else if (mode === 'pm') {
      start_at = `${iso}T12:00:00`;
      label = '午後休み';
    }

    const isAlreadyOff = blocks.some(b => {
      if (b.user_id != null && String(b.user_id) !== String(workerId)) return false;
      const d = blockDisplayForDay(b, iso);
      if (!d) return false;
      // 重複チェック（簡易的：対象時間の50%以上が既に埋まっていたら警告）
      const blockStart = dayjs(start_at).hour() * 60 + dayjs(start_at).minute();
      const blockEnd = dayjs(end_at).hour() * 60 + dayjs(end_at).minute();
      return d.start_min <= blockStart + 5 && d.end_min >= blockEnd - 5;
    });

    if (isAlreadyOff) {
      alert(`既に${label}時間帯が含まれるブロックが存在します。`);
      return;
    }

    if (!window.confirm(`${dayjs(iso).format('M/D')} を${label}として登録しますか？`)) return;

    await createBlock({
      start_at,
      end_at,
      reason_code: 'private',
      reason_note: `事前申告：${label}`
    });
    alert('登録しました');
  }, [workerId, blocks, createBlock]);

  // ブロック削除
  const deleteBlock = useCallback(async (blockId) => {
    if (!window.confirm('このブロック（クローズ）を削除しますか？')) return;
    try {
      const token = getToken();
      if (!token) throw new Error('認証トークンが取得できません');

      const url = `${API_BASE}/blocks/${blockId}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${String(token).trim()}`,
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // ローカル状態を更新
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));

      // localStorageも更新
      const updatedBlocks = blocks.filter((b) => b.id !== blockId);
      saveJson(STORAGE_BLOCKS, updatedBlocks);
    } catch (error) {
      console.error('[CleanerSchedulePage] Failed to delete block:', error);
      alert('削除に失敗しました');
    }
  }, [blocks, getToken]);

  // 日付変更
  const shiftDate = useCallback((days) => {
    setDateISO(dayjs(dateISO).add(days, 'day').format('YYYY-MM-DD'));
  }, [dateISO]);

  const shiftMonth = useCallback((delta) => {
    setDateISO(dayjs(dateISO).add(delta, 'month').format('YYYY-MM-DD'));
  }, [dateISO]);

  // タイムライン用のアイテムを生成 (ACに則り、Gapを自動生成)
  const timelineItems = useMemo(() => {
    const rawEvents = [];

    // 1. スケジュールを追加
    for (const a of appointments) {
      rawEvents.push({ type: 'appointment', data: a, start_min: a.start_min, end_min: a.end_min });
    }

    // 2. ブロックを追加
    for (const b of blocks) {
      if (b.user_id != null && String(b.user_id) !== String(workerId)) continue;
      const display = blockDisplayForDay(b, dateISO);
      if (display) {
        rawEvents.push({ type: 'block', block: b, start_min: display.start_min, end_min: display.end_min });
      }
    }

    // 開始順にソート
    rawEvents.sort((x, y) => x.start_min - y.start_min);

    // 3. 隙間 (Gap) を計算して挿入
    const normalized = [];
    let currentMin = 0; // 0:00

    rawEvents.forEach((event, idx) => {
      // 15分以上の隙間があればGapを挿入
      if (event.start_min > currentMin + 15) {
        normalized.push({
          type: 'gap',
          start_min: currentMin,
          end_min: event.start_min
        });
      }
      normalized.push(event);
      currentMin = Math.max(currentMin, event.end_min);
    });

    // 24時までの残りの隙間
    if (currentMin < 24 * 60 - 15) {
      normalized.push({
        type: 'gap',
        start_min: currentMin,
        end_min: 24 * 60 - 1
      });
    }

    return normalized;
  }, [appointments, blocks, workerId, dateISO]);

  // 週間表示用：その週の7日分の日付と、日付ごとの予定
  const weekDays = useMemo(() => {
    const { weekStart } = getWeekRange(dateISO);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(dayjs(weekStart).add(i, 'day').format('YYYY-MM-DD'));
    }
    return days;
  }, [dateISO, getWeekRange]);

  const weekDaysWithItems = useMemo(() => {
    return weekDays.map((dayIso) => {
      const dayAppointments = appointments.filter((a) => (a.date || '').slice(0, 10) === dayIso);
      const dayBlocks = blocks.filter((b) => {
        if (b.user_id != null && String(b.user_id) !== String(workerId)) return false;
        const display = blockDisplayForDay(b, dayIso);
        return display != null;
      });
      const items = [
        ...dayAppointments.map((a) => ({ type: 'appointment', data: a, start_min: a.start_min })),
        ...dayBlocks.map((b) => {
          const display = blockDisplayForDay(b, dayIso);
          return { type: 'block', block: b, start_min: display.start_min, end_min: display.end_min };
        }),
      ].sort((x, y) => (x.start_min ?? 0) - (y.start_min ?? 0));
      return { dayIso, items };
    });
  }, [weekDays, appointments, blocks, workerId]);

  // デバッグログ
  useEffect(() => {
    console.log('[CleanerSchedulePage] State:', {
      isLoading,
      isAuthenticated,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      workerId,
      loading,
      appointmentsCount: appointments.length,
    });
  }, [isLoading, isAuthenticated, user, workerId, loading, appointments.length]);

  if (isLoading || loading || blocksLoading) {
    return (
      <div className="cleaner-schedule-page" style={{ padding: 24, textAlign: 'center' }}>
        <p>読み込み中...</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '8px' }}>
          {isLoading ? '認証情報を確認中...' : blocksLoading ? 'ブロックを読み込み中...' : workerId ? 'スケジュールを読み込み中...' : '清掃員情報を取得中...'}
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="cleaner-schedule-page" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ marginBottom: '16px' }}>認証が必要です</p>
        <Link
          to="/jobs/cleaning/entrance"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            fontSize: '0.95rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            touchAction: 'manipulation'
          }}
        >
          エントランスに戻る
        </Link>
      </div>
    );
  }

  // workerIdが取得できていない場合のメッセージ
  if (!workerId) {
    return (
      <div className="cleaner-schedule-page" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ marginBottom: '16px' }}>清掃員情報の取得に失敗しました</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '16px' }}>
          メールアドレス: {user?.email || '不明'}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '16px' }}>
          管理者に連絡してください
        </p>
        <Link
          to="/jobs/cleaning/entrance"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            fontSize: '0.95rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            touchAction: 'manipulation'
          }}
        >
          エントランスに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="cleaner-schedule-page admin-schedule-timeline-page report-page" data-job="cleaning" style={{ paddingBottom: selectedAppt ? karteDockHeight + 24 : 24 }}>
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content admin-schedule-timeline-content cleaner-schedule-content">
        <header className="header">
          <div className="headerRow">
            <div className="titleBlock">
              <div className="title">清掃スケジュール</div>
              <div className="subtitle">
                {view === 'week' && `${getWeekRange(dateISO).weekStart} ～ ${getWeekRange(dateISO).weekEnd}`}
                {view === 'month' && `${dayjs(dateISO).format('YYYY年MM月')}`}
                {view === 'day' && isoToDateLabel(dateISO)}
              </div>
            </div>
            <div className="headerActions">
              <div className="viewSwitcher" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>表示</span>
                <div className="viewSwitcherButtons" role="group" aria-label="表示切替">
                  <button type="button" className={`viewSwitcherBtn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')} title="日別" aria-pressed={view === 'day'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="4" width="4" height="3" rx="0.5" /><rect x="8" y="6" width="4" height="3" rx="0.5" /><rect x="14" y="8" width="4" height="3" rx="0.5" /></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')} title="週" aria-pressed={view === 'week'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="1" y="4" width="2.5" height="12" rx="0.5" /><rect x="5" y="4" width="2.5" height="12" rx="0.5" /><rect x="9" y="4" width="2.5" height="12" rx="0.5" /><rect x="13" y="4" width="2.5" height="12" rx="0.5" /><rect x="17" y="4" width="2.5" height="12" rx="0.5" /></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')} title="月" aria-pressed={view === 'month'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="2" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><rect x="4" y="5" width="2.5" height="2.5" rx="0.3" /><rect x="8" y="5" width="2.5" height="2.5" rx="0.3" /><rect x="12" y="5" width="2.5" height="2.5" rx="0.3" /><rect x="4" y="9" width="2.5" height="2.5" rx="0.3" /><rect x="8" y="9" width="2.5" height="2.5" rx="0.3" /><rect x="12" y="9" width="2.5" height="2.5" rx="0.3" /></svg>
                  </button>
                </div>
              </div>
              {view === 'month' ? (
                <>
                  <button type="button" className="btn" onClick={() => shiftMonth(-1)} aria-label="前月">← 前月</button>
                  <button type="button" className="btn btnPrimary" onClick={() => setDateISO(dayjs().format('YYYY-MM-DD'))} aria-label="今月">今月</button>
                  <button type="button" className="btn" onClick={() => shiftMonth(1)} aria-label="翌月">翌月 →</button>
                </>
              ) : view === 'week' ? (
                <>
                  <button type="button" className="btn" onClick={() => setDateISO(dayjs(dateISO).subtract(7, 'day').format('YYYY-MM-DD'))} aria-label="前週">← 前週</button>
                  <button type="button" className="btn btnPrimary" onClick={() => setDateISO(dayjs().format('YYYY-MM-DD'))} aria-label="今週">今週</button>
                  <button type="button" className="btn" onClick={() => setDateISO(dayjs(dateISO).add(7, 'day').format('YYYY-MM-DD'))} aria-label="翌週">翌週 →</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => shiftDate(-1)} aria-label="前日">← 前日</button>
                  <button type="button" className="btn btnPrimary" onClick={() => setDateISO(dayjs().format('YYYY-MM-DD'))} aria-label="今日">今日</button>
                  <button type="button" className="btn" onClick={() => shiftDate(1)} aria-label="翌日">翌日 →</button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="main">
          {view === 'month' && (
            <MonthSimple
              dateISO={dateISO}
              setDateISO={setDateISO}
              appointments={appointments}
              blocks={blocks}
              workerId={workerId}
              onToggleFullDayOff={handleToggleFullDayOff}
            />
          )}
          {view === 'week' && (
            <section className="weekSummary" style={{ padding: '0 8px 32px' }}>
              <div style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>
                📅 【週間：予定の俯瞰】<br />
                <span style={{ fontSize: '1.2rem', color: 'var(--text)' }}>今週の負荷状況</span>
              </div>
              <div className="weekList" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {weekDaysWithItems.map(({ dayIso, items }) => {
                  const jobCount = items.filter(i => i.type === 'appointment').length;
                  const blockCount = items.filter(i => i.type === 'block').length;
                  const isToday = dayIso === dayjs().format('YYYY-MM-DD');

                  return (
                    <div
                      key={dayIso}
                      onClick={() => { setDateISO(dayIso); setView('day'); }}
                      style={{
                        background: isToday ? 'rgba(59, 130, 246, 0.05)' : 'var(--card-bg)',
                        border: isToday ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: '48px', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{['日', '月', '火', '水', '木', '金', '土'][dayjs(dayIso).day()]}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{dayjs(dayIso).format('D')}</div>
                        </div>
                        <div>
                          {jobCount > 0 ? (
                            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{jobCount} 件の現場</div>
                          ) : (
                            <div style={{ opacity: 0.5, fontSize: '1rem' }}>予定なし</div>
                          )}
                          {blockCount > 0 && <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>{blockCount} 件のブロック済</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {Array.from({ length: jobCount }).map((_, i) => (
                          <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></div>
                        ))}
                        {jobCount === 0 && <i className="fas fa-chevron-right" style={{ opacity: 0.2 }}></i>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {view === 'day' && (
            <section className="agendaView">
              <div className="agendaList" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 8px' }}>
                <div style={{ marginBottom: 8, fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>
                  📅 【日次：今日の予定】<br />
                  <span style={{ fontSize: '1.2rem', color: 'var(--text)' }}>{dayjs(dateISO).format('M/D')}({['日', '月', '火', '水', '木', '金', '土'][dayjs(dateISO).day()]})</span>
                </div>

                {timelineItems.length > 0 ? (
                  timelineItems.map((item, idx) => {
                    if (item.type === 'gap') {
                      const durationH = Math.floor((item.end_min - item.start_min) / 60);
                      const durationM = (item.end_min - item.start_min) % 60;
                      return (
                        <div key={`gap-${idx}`} className="agendaGap" style={{ padding: '8px 4px', borderLeft: '2px dashed var(--line)', marginLeft: '12px' }}>
                          <button
                            type="button"
                            className="quickBlockBtn"
                            onClick={() => openBlockModal(item.start_min, item.end_min)}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid var(--line)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '0.8rem',
                              color: 'var(--muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <i className="fas fa-plus-circle" style={{ fontSize: '1rem', color: '#3b82f6' }}></i>
                            <span>空き（{durationH > 0 ? `${durationH}時間` : ''}${durationM > 0 ? `${durationM}分` : ''}）をブロック</span>
                          </button>
                        </div>
                      );
                    }

                    if (item.type === 'block') {
                      const { block, start_min, end_min } = item;
                      return (
                        <div key={block.id} className="agendaItem blockCard" style={{ display: 'flex', gap: '12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '14px', padding: '16px', position: 'relative' }}>
                          <div className="agendaTime" style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#3b82f6', width: '60px', flexShrink: 0 }}>
                            {minutesToHHMM(start_min)}
                          </div>
                          <div className="agendaBody" style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#3b82f6' }}>
                              🚫 {
                                block.reason_code === 'sleep' ? '睡眠' :
                                  block.reason_code === 'move' ? '移動' :
                                    block.reason_code === 'private' ? '私用' : 'その他'
                              }
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 4 }}>
                              {minutesToHHMM(start_min)} – {minutesToHHMM(end_min)}
                              {block.reason_note && ` | ${block.reason_note}`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer' }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    }

                    const a = item.data;
                    return (
                      <div
                        key={a.id}
                        className={`agendaItem scheduleCard ${selectedAppt?.id === a.id ? 'active' : ''}`}
                        onClick={() => setSelectedAppt(a)}
                        style={{
                          display: 'flex', gap: '12px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', padding: '20px', cursor: 'pointer',
                          boxShadow: selectedAppt?.id === a.id ? '0 0 0 2px #3b82f6, 0 8px 16px rgba(0,0,0,0.1)' : 'var(--shadow)'
                        }}
                      >
                        <div className="agendaTime" style={{ fontWeight: 'bold', fontSize: '1rem', width: '60px', flexShrink: 0, color: 'var(--text)' }}>
                          {minutesToHHMM(a.start_min)}
                        </div>
                        <div className="agendaBody" style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>{a.target_name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{a.work_type}</span>
                            <span>{minutesToHHMM(a.start_min)} – {minutesToHHMM(a.end_min)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <i className="fas fa-chevron-right" style={{ opacity: 0.3 }}></i>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>🍃</div>
                    <p>本日の予定はありません。</p>
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={() => openBlockModal(9 * 60)}
                      style={{ marginTop: 16 }}
                    >
                      全休・休みとして登録
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {blockModalOpen && (
            <BlockCreateModal
              userId={workerId}
              userName={user?.name || '自分'}
              initialStartAt={blockModalStartAt}
              initialEndAt={blockModalEndAt}
              onClose={closeBlockModal}
              onCreate={createBlock}
              conflictError={blockConflictError}
            />
          )}

          {selectedAppt && (
            <section className="karteDock" style={{ height: `${karteDockHeight}px` }}>
              <div
                className={`karteDockHeader ${isResizingKarteDock ? 'resizing' : ''}`}
                onMouseDown={handleKarteDockResizeStart}
                onTouchStart={handleKarteDockResizeStart}
              >
                <div className="karteDockHeaderTitle">カルテ（閲覧）</div>
                <div className="karteDockHeaderActions">
                  <button type="button" className="karteDockCloseBtn" onClick={handleCloseKarteDock} aria-label="カルテを閉じる">×</button>
                </div>
              </div>
              <div className="karteDockInner">
                <div className="karteDockLeft">
                  <div className="kdLeftColumn">
                    <div className="kdTitle">{selectedAppt.target_name ?? '—'}</div>
                    <div className="kdMeta">
                      <div>日付：{selectedAppt.date ?? '—'}</div>
                      <div>時間：{minutesToHHMM(selectedAppt.start_min)}〜{minutesToHHMM(selectedAppt.end_min)}</div>
                      <div>種別：{selectedAppt.work_type ?? '—'}</div>
                    </div>
                    {(() => {
                      const store = selectedAppt?.store_id ? selectedStore : null;
                      const storeName = store?.name || store?.store_name || '';
                      const brandName = store?.brand_name || '';
                      const clientName = store?.client_name || '';
                      const phone = store?.phone || store?.tel || store?.phone_number || '';
                      return (
                        <>
                          {storeName && <div className="kdInfoRow"><span className="kdInfoLabel">店舗名：</span><span>{storeName}</span></div>}
                          {brandName && <div className="kdInfoRow"><span className="kdInfoLabel">ブランド名：</span><span>{brandName}</span></div>}
                          {clientName && <div className="kdInfoRow"><span className="kdInfoLabel">法人名：</span><span>{clientName}</span></div>}
                          {phone && <div className="kdInfoRow"><span className="kdInfoLabel">電話番号：</span><span>{phone}</span></div>}
                        </>
                      );
                    })()}
                  </div>
                  <div className="kdRightColumn">
                    {selectedStore?.security_box || selectedStore?.security_box_number ? (
                      <>
                        <div className="kdSectionTitle" style={{ color: '#ec4899', borderLeft: '4px solid #ec4899', paddingLeft: '8px' }}>🔑 キーボックス解錠番号</div>
                        <div className="kdInfoRow"><span>{selectedStore.security_box || selectedStore.security_box_number || '—'}</span></div>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="karteDockRight">
                  {selectedAppt?.store_id && selectedStore ? (
                    <OfficeClientKartePanel
                      ref={kartePanelRef}
                      storeId={selectedAppt.store_id}
                      store={selectedStore}
                      brands={[]}
                      clients={[]}
                      getBrandName={(store) => store?.brand_name ?? ''}
                      getClientName={(store) => store?.client_name ?? ''}
                      isLocked
                    />
                  ) : selectedAppt?.store_id ? (
                    <div className="kdEmpty">店舗情報を読み込み中...</div>
                  ) : (
                    <div className="kdEmpty">この案件には店舗情報が紐づいていません。</div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
      {user?.role === 'admin' && (
        <div style={{
          margin: '20px',
          padding: '16px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '12px',
          fontSize: '0.8rem',
          color: '#aaa',
          border: '1px dashed #444'
        }}>
          <div>🛠 Admin Debug Info (Only visible to admin)</div>
          <div>Login Email: {user.email}</div>
          <div>Detected Worker ID: {workerId || 'NONE'}</div>
          <div>Appointments: {appointments.length} items</div>
          <div>Blocks: {blocks.length} items</div>
        </div>
      )}
    </div>
  );
}
