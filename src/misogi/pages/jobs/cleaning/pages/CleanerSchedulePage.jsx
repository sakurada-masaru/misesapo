import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../../shared/auth/useAuth';
import BlockCreateModal from '../../../shared/ui/BlockCreateModal/BlockCreateModal';
import { detectBlockConflicts } from '../../../shared/utils/scheduleConflicts';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import '../../../shared/styles/components.css';
import './cleaner-schedule.css';

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

export default function CleanerSchedulePage() {
  const { user, isAuthenticated, isLoading, getToken } = useAuth();
  const navigate = useNavigate();
  const [dateISO, setDateISO] = useState(dayjs().format('YYYY-MM-DD'));
  const [appointments, setAppointments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [workerId, setWorkerId] = useState(null); // workersテーブルのID
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalStartAt, setBlockModalStartAt] = useState(null);
  const [blockModalEndAt, setBlockModalEndAt] = useState(null);
  const [blockConflictError, setBlockConflictError] = useState(null);

  // 認証チェック
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      navigate('/');
      return;
    }
    if (user && user.role !== 'cleaning' && user.role !== 'staff') {
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

  // スケジュール取得（閲覧専用）
  const loadSchedules = useCallback(async (targetWorkerId) => {
    if (!targetWorkerId) {
      console.log('[CleanerSchedulePage] Skipping loadSchedules: workerId is null');
      setAppointments([]);
      setLoading(false);
      return;
    }
    
    console.log('[CleanerSchedulePage] Loading schedules for workerId:', targetWorkerId, 'date:', dateISO);
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        console.error('[CleanerSchedulePage] No token available');
        setLoading(false);
        return;
      }

      const dateFrom = dateISO;
      const dateTo = dateISO;
      const url = `${API_BASE}/schedules?date_from=${dateFrom}&date_to=${dateTo}&worker_id=${encodeURIComponent(targetWorkerId)}&limit=1000`;
      
      console.log('[CleanerSchedulePage] Fetching:', url);
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
  }, [dateISO, getToken]);

  // workerIdが設定されたらスケジュールを読み込む
  useEffect(() => {
    console.log('[CleanerSchedulePage] useEffect for loadSchedules triggered:', { 
      isAuthenticated, 
      workerId, 
      dateISO,
      loadSchedulesExists: typeof loadSchedules === 'function'
    });
    
    if (!isAuthenticated || !workerId) {
      console.log('[CleanerSchedulePage] Skipping loadSchedules:', { isAuthenticated, workerId });
      return;
    }
    // isLoadingはuseAuthの状態なので、ここではチェックしない
    console.log('[CleanerSchedulePage] Triggering loadSchedules:', { isAuthenticated, workerId, dateISO });
    loadSchedules(workerId);
  }, [isAuthenticated, workerId, dateISO, loadSchedules]);

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
          'Authorization': `Bearer ${token}`,
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

  // ブロック作成モーダルを開く
  const openBlockModal = useCallback((startMin) => {
    const dayEnd = 24 * 60;
    const start = startMin ?? 9 * 60;
    const end = Math.min(start + 60, dayEnd);
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

    const newBlock = {
      user_id: workerId,
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
          'Authorization': `Bearer ${token}`,
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
  }, [workerId, appointments, blocks, user?.name, closeBlockModal, getToken]);

  // 日付変更
  const shiftDate = useCallback((days) => {
    setDateISO(dayjs(dateISO).add(days, 'day').format('YYYY-MM-DD'));
  }, [dateISO]);

  // タイムライン用のアイテムを生成
  const timelineItems = useMemo(() => {
    const list = [];
    
    // スケジュールを追加
    for (const a of appointments) {
      list.push({ type: 'appointment', data: a, start_min: a.start_min, end_min: a.end_min });
    }
    
    // ブロックを追加
    for (const b of blocks) {
      if (b.user_id !== workerId && b.user_id != null) continue;
      const display = blockDisplayForDay(b, dateISO);
      if (display) {
        list.push({ type: 'block', block: b, start_min: display.start_min, end_min: display.end_min });
      }
    }
    
    list.sort((x, y) => x.start_min - y.start_min);
    return list;
  }, [appointments, blocks, workerId, dateISO]);

  // 時間スロットを生成（0:00〜24:00、1時間間隔）
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let t = 0; t <= 24 * 60; t += 60) {
      slots.push(t);
    }
    return slots;
  }, []);

  // スロットごとのアイテムをマッピング
  const slotsWithItems = useMemo(() => {
    const byStart = new Map();
    for (const item of timelineItems) {
      byStart.set(item.start_min, (byStart.get(item.start_min) ?? []).concat(item));
    }
    return timeSlots.map((t) => ({ t, items: byStart.get(t) ?? [] }));
  }, [timelineItems, timeSlots]);

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
    <div className="cleaner-schedule-page report-page" data-job="cleaning">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content cleaner-schedule-content">
        <header className="header">
          <div className="headerRow">
            <div className="titleBlock">
              <div className="title">清掃スケジュール</div>
              <div className="subtitle">{isoToDateLabel(dateISO)}</div>
            </div>
            <div className="headerActions">
              <button 
                type="button" 
                className="btn" 
                onClick={() => shiftDate(-1)}
                aria-label="前日"
              >
                ← 前日
              </button>
              <button 
                type="button" 
                className="btn btnPrimary" 
                onClick={() => setDateISO(dayjs().format('YYYY-MM-DD'))}
                aria-label="今日"
              >
                今日
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={() => shiftDate(1)}
                aria-label="翌日"
              >
                翌日 →
              </button>
            </div>
          </div>
        </header>

        <main className="main">
          <section className="timelineSP">
            <div className="spList">
              <div className="spHint">
                <span className="muted">{isoToDateLabel(dateISO)}</span>
              </div>
              {slotsWithItems.map((slot) => (
              <div key={slot.t} className="spSlot">
                <div className="spTime">{minutesToHHMM(slot.t)}</div>
                <div className="spSlotBody">
                  {slot.items.length === 0 ? (
                    <button
                      type="button"
                      className="spEmpty"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openBlockModal(slot.t);
                      }}
                      onClick={() => {
                        // タップでブロック作成（スマホ向け）
                        openBlockModal(slot.t);
                      }}
                      style={{ touchAction: 'manipulation' }}
                    >
                      空き（タップでブロック作成）
                    </button>
                  ) : (
                    slot.items.map((item) => {
                      if (item.type === 'block') {
                        const { block, start_min, end_min } = item;
                        return (
                          <div key={block.id} className="spAppt scheduleCard blockCard">
                            <div className="spApptRow">
                              <div className="spApptMain">
                                <div className="spApptName">🔒 クローズ</div>
                                <div className="spApptMeta">
                                  {block.reason_code === 'sleep' ? '睡眠' : 
                                   block.reason_code === 'move' ? '移動' : 
                                   block.reason_code === 'private' ? '私用' : 'その他'}
                                </div>
                              </div>
                              <div className="spApptTime">{minutesToHHMM(start_min)}–{minutesToHHMM(end_min)}</div>
                            </div>
                          </div>
                        );
                      }
                      // スケジュール（閲覧専用）
                      const a = item.data;
                      return (
                        <div key={a.id} className="spAppt scheduleCard">
                          <div className="spApptRow">
                            <div className="spApptMain">
                              <div className="spApptName">{a.target_name}</div>
                              <div className="spApptMeta">{a.work_type}</div>
                            </div>
                            <div className="spApptTime">{minutesToHHMM(a.start_min)}–{minutesToHHMM(a.end_min)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

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
        </main>
      </div>
    </div>
  );
}
