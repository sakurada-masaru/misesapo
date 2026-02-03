import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { detectConflicts as detectConflictsBeforeSave, detectBlockConflicts } from '../../shared/utils/scheduleConflicts';
import { newScheduleId } from '../../shared/utils/scheduleId';
import BlockCreateModal from '../../shared/ui/BlockCreateModal/BlockCreateModal';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';
import OfficeClientKartePanel from '../../jobs/office/clients/OfficeClientKartePanel';
import '../../shared/styles/components.css';
import './admin-schedule-timeline.css';
import '../../jobs/office/clients/office-client-karte-panel.css';

/**
 * 清掃スケジュール・病院型タイムライン
 * 医師→清掃員、患者→現場、診療種別→作業種別に置き換え
 */

const STORAGE_APPOINTMENTS = 'admin-schedule-appointments';
const STORAGE_CLEANERS = 'admin-schedule-cleaners';
const STORAGE_BLOCKS = 'admin-schedule-blocks';

/** workers API 用ベース（localhost は /api、本番は VITE_API_BASE または prod） */
const API_BASE =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    ? '/api'
    : (import.meta.env?.VITE_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod');

const STATUSES = [
  { key: 'booked', label: '予約', colorClass: 's-booked' },
  { key: 'checked_in', label: '受付済', colorClass: 's-checkedin' },
  { key: 'in_progress', label: '作業中', colorClass: 's-inprogress' },
  { key: 'done', label: '完了', colorClass: 's-done' },
  { key: 'cancelled', label: 'キャンセル', colorClass: 's-cancelled' },
];

const WORK_TYPES = [
  '定期清掃（1ヶ月）',
  '定期清掃（2ヶ月）',
  '定期清掃（3ヶ月）',
  '定期清掃（6ヶ月）',
  '定期清掃（12ヶ月）',
  'スポット清掃',
  'その他'
];

/** 事前連絡ステータス: 未 / 済 / 不通 */
const CONTACT_STATUSES = [
  { key: 'pending', label: '未', colorClass: 'contact-pending' },
  { key: 'done', label: '済', colorClass: 'contact-done' },
  { key: 'unreachable', label: '不通', colorClass: 'contact-unreachable' },
];

/** 梅岡ユニット（清掃専門）の名前キー。名前に含まれるか完全一致で判定。先頭がリーダー */
const CLEANING_UNIT_NAMES = ['梅岡', '松岡', 'ジョナス', 'ガブリエレ', 'ソウザレムエル', 'Noemi', 'ノエミ'];
/** 遠藤ユニット（メンテナンス専門）の名前キー。先頭がリーダー */
const MAINTENANCE_UNIT_NAMES = ['遠藤', '佐々木', '中澤', '中島', '吉井'];

function getUnitFromName(name) {
  if (!name || typeof name !== 'string') return 'cleaning';
  const n = name.trim();
  for (const key of MAINTENANCE_UNIT_NAMES) {
    if (n.includes(key)) return 'maintenance';
  }
  for (const key of CLEANING_UNIT_NAMES) {
    if (n.includes(key)) return 'cleaning';
  }
  return 'cleaning';
}

/** 名簿の左がリーダーになるようソート。梅岡ユニットは梅岡を先頭、遠藤ユニットは遠藤を先頭 */
function sortLeaderFirst(list, leaderKey) {
  return [...list].sort((a, b) => {
    const aLead = (a.name && a.name.includes(leaderKey)) ? 0 : 1;
    const bLead = (b.name && b.name.includes(leaderKey)) ? 0 : 1;
    return aLead - bLead;
  });
}

const defaultCleaners = [
  { id: 'c1', name: '山田', unit: 'cleaning' },
  { id: 'c2', name: '佐藤', unit: 'cleaning' },
  { id: 'c3', name: '鈴木', unit: 'maintenance' },
  { id: 'c4', name: '田中', unit: 'maintenance' },
];

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

/** 分を24時間表記 "HH:mm" に変換（0:00〜24:00） */
function minutesToHHMM(min) {
  // 24時間を超える場合は24時間で割った余りを使用
  // 必ず整数に丸めてから処理（浮動小数点数の小数点以下を防ぐ）
  const normalizedMin = Math.round(min) % (24 * 60);
  const h = Math.floor(normalizedMin / 60);
  const m = Math.round(normalizedMin % 60); // 分も必ず整数に丸める
  return `${pad2(h)}:${pad2(m)}`;
}

function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

/** 分を30分単位に丸める（例：67分→60分、93分→90分） */
function roundTo30Minutes(min) {
  return Math.round(min / 30) * 30;
}

/** 昼イベント判定：10:00(600)〜21:00(1260)に1分でも重なるか */
function isDaytimeEvent(startMin, endMin) {
  const DAYTIME_START = 600;  // 10:00
  const DAYTIME_END = 1260;    // 21:00
  // 重なり判定: max(start_min, 600) < min(end_min, 1260)
  return Math.max(startMin, DAYTIME_START) < Math.min(endMin, DAYTIME_END);
}

/** 時間を21:00基準のoffsetMinに変換（21:00→0, 22:00→60, 10:00→780） */
function toOffsetMin(min) {
  const NIGHT_START = 1260; // 21:00
  return (min >= NIGHT_START) ? (min - NIGHT_START) : (min + 1440 - NIGHT_START);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoToDateLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w})`;
}

/** 日付が含まれる週の日曜〜土曜の ISO 配列を返す */
function getWeekDayIsos(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  const day = d.getDay();
  const sun = new Date(d);
  sun.setDate(sun.getDate() - day);
  const isos = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(sun);
    x.setDate(sun.getDate() + i);
    isos.push(`${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`);
  }
  return isos;
}

function getWeekRangeLabel(dateISO) {
  const isos = getWeekDayIsos(dateISO);
  const start = new Date(isos[0] + 'T00:00:00');
  const end = new Date(isos[6] + 'T00:00:00');
  return `${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1}/${end.getDate()}`;
}

/** ランダムな案件を生成（テスト用・実際の顧客名簿を使用） */
async function createRandomAppointments(cleaners, dateISO, setAppointments, clients, apiBase) {
  if (cleaners.length === 0) {
    alert('清掃員が登録されていません');
    return;
  }
  
  if (clients.length === 0) {
    alert('顧客データが取得できていません。しばらく待ってから再度お試しください。');
    return;
  }
  
  const workTypes = ['定期', '特別', '入念', '検査対応', '夜間'];
  const statuses = ['booked', 'checked_in', 'in_progress', 'done'];
  const times = [9 * 60, 10 * 60, 11 * 60, 13 * 60, 14 * 60, 15 * 60, 16 * 60]; // 9:00, 10:00, ...
  
  const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
  const base = apiBase.replace(/\/$/, '');
  
  // ランダムに5件の顧客を選択
  const selectedClients = [];
  for (let i = 0; i < Math.min(5, clients.length); i++) {
    const randomClient = clients[Math.floor(Math.random() * clients.length)];
    if (!selectedClients.find(c => c.id === randomClient.id)) {
      selectedClients.push(randomClient);
    }
  }
  
  const newAppts = [];
  
  // 各顧客の店舗を取得して案件を作成
  for (let i = 0; i < selectedClients.length; i++) {
    const client = selectedClients[i];
    
    try {
      // 顧客の店舗一覧を取得
      const storesResponse = await fetch(`${base}/stores?client_id=${client.id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      
      let stores = [];
      if (storesResponse.ok) {
        const storesData = await storesResponse.json();
        stores = Array.isArray(storesData) ? storesData : (storesData?.items ?? []);
      }
      
      // 店舗がある場合はランダムに選択、ない場合は顧客名を使用
      let store = null;
      let targetName = '';
      let storeId = null;
      
      if (stores.length > 0) {
        store = stores[Math.floor(Math.random() * stores.length)];
        targetName = store.name || store.store_name || '';
        storeId = store.id;
      } else {
        // 店舗がない場合は顧客名を使用
        targetName = client.name || client.client_name || `顧客${i + 1}`;
      }
      
      if (!targetName) {
        targetName = `顧客${i + 1}`;
      }
      
      // ランダムな清掃員、時刻、作業種別を選択
      const cleaner = cleaners[Math.floor(Math.random() * cleaners.length)];
      const startTime = times[Math.floor(Math.random() * times.length)];
      const duration = [30, 60, 90][Math.floor(Math.random() * 3)]; // 30分、60分、90分
      const endTime = Math.min(startTime + duration, 24 * 60);
      
      const appt = {
        id: `random_${Date.now()}_${i}`,
        schedule_id: newScheduleId('sch'),
        date: dateISO,
        cleaner_id: cleaner.id,
        start_min: startTime,
        end_min: endTime,
        target_name: targetName,
        work_type: workTypes[Math.floor(Math.random() * workTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        client_id: client.id,
        store_id: storeId,
        memo: '',
        created_at: Date.now() - i * 60000,
        contact_note: '',
        contact_last_at: null,
        contact_status: 'pending',
        contact_reminders: [],
      };
      newAppts.push(appt);
    } catch (error) {
      console.warn(`[createRandomAppointments] Failed to get stores for client ${client.id}:`, error);
      // エラーが発生しても顧客名で案件を作成
      const cleaner = cleaners[Math.floor(Math.random() * cleaners.length)];
      const startTime = times[Math.floor(Math.random() * times.length)];
      const duration = [30, 60, 90][Math.floor(Math.random() * 3)];
      const endTime = Math.min(startTime + duration, 24 * 60);
      
      const appt = {
        id: `random_${Date.now()}_${i}`,
        schedule_id: newScheduleId('sch'),
        date: dateISO,
        cleaner_id: cleaner.id,
        start_min: startTime,
        end_min: endTime,
        target_name: client.name || client.client_name || `顧客${i + 1}`,
        work_type: workTypes[Math.floor(Math.random() * workTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        client_id: client.id,
        store_id: null,
        memo: '',
        created_at: Date.now() - i * 60000,
        contact_note: '',
        contact_last_at: null,
        contact_status: 'pending',
        contact_reminders: [],
      };
      newAppts.push(appt);
    }
  }
  
  setAppointments((prev) => [...prev, ...newAppts]);
  alert(`${newAppts.length}件のランダム案件を追加しました（実際の顧客名簿から選択）`);
}

/** ゴールデンタイム（21:00〜翌10:00）の案件を生成（テスト用・実際の顧客名簿を使用） */
async function createGoldenTimeAppointments(cleaners, dateISO, appointments, setAppointments, clients, apiBase) {
  if (cleaners.length === 0) {
    alert('清掃員が登録されていません');
    return;
  }
  
  if (clients.length === 0) {
    alert('顧客データが取得できていません。しばらく待ってから再度お試しください。');
    return;
  }
  
  const workTypes = ['定期', '特別', '入念', '検査対応', '夜間'];
  const statuses = ['booked', 'checked_in', 'in_progress', 'done'];
  // ゴールデンタイム：21:00〜翌10:00の開始時刻（平均4時間の作業時間を考慮）
  const goldenTimes = [
    21 * 60,  // 21:00
    22 * 60,  // 22:00
    23 * 60,  // 23:00
    0,        // 0:00
    1 * 60,   // 1:00
    2 * 60,   // 2:00
    3 * 60,   // 3:00
    4 * 60,   // 4:00
    5 * 60,   // 5:00
    6 * 60,   // 6:00
  ];
  const avgDuration = 4 * 60; // 平均4時間 = 240分
  
  const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
  const base = apiBase.replace(/\/$/, '');
  
  // ランダムに8件の顧客を選択（ゴールデンタイムの案件数）
  const selectedClients = [];
  const clientCount = Math.min(8, clients.length);
  for (let i = 0; i < clientCount; i++) {
    const randomClient = clients[Math.floor(Math.random() * clients.length)];
    if (!selectedClients.find(c => c.id === randomClient.id)) {
      selectedClients.push(randomClient);
    }
  }
  
  const newAppts = [];
  
  // 既存の案件を取得（重複チェック用）
  const existingAppts = appointments || [];
  
  // 各清掃員の既存案件を整理（重複チェック用）
  const byCleaner = new Map();
  for (const a of existingAppts) {
    if (a.date === dateISO) {
      const list = byCleaner.get(a.cleaner_id) || [];
      list.push({ start_min: a.start_min, end_min: a.end_min });
      byCleaner.set(a.cleaner_id, list);
    }
  }
  
  // 各顧客の店舗を取得して案件を作成
  for (let i = 0; i < selectedClients.length; i++) {
    const client = selectedClients[i];
    
    try {
      // 顧客の店舗一覧を取得
      const storesResponse = await fetch(`${base}/stores?client_id=${client.id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      
      let stores = [];
      if (storesResponse.ok) {
        const storesData = await storesResponse.json();
        stores = Array.isArray(storesData) ? storesData : (storesData?.items ?? []);
      }
      
      // 店舗がある場合はランダムに選択、ない場合は顧客名を使用
      let store = null;
      let targetName = '';
      let storeId = null;
      
      if (stores.length > 0) {
        store = stores[Math.floor(Math.random() * stores.length)];
        targetName = store.name || store.store_name || '';
        storeId = store.id;
      } else {
        // 店舗がない場合は顧客名を使用
        targetName = client.name || client.client_name || `顧客${i + 1}`;
      }
      
      if (!targetName) {
        targetName = `顧客${i + 1}`;
      }
      
      // 清掃員をランダムに選択
      const shuffledCleaners = [...cleaners].sort(() => Math.random() - 0.5);
      let cleaner = null;
      let startTime = null;
      let endTime = null;
      let duration = null;
      
      // 各清掃員について、重複しない時間を探す
      for (const candidateCleaner of shuffledCleaners) {
        const cleanerId = candidateCleaner.id;
        const existingForCleaner = byCleaner.get(cleanerId) || [];
        
        // ゴールデンタイムの開始時刻候補をフィルタリング（時間的に可能なもの）
        const timeCandidates = goldenTimes.filter(t => {
          // 4時間後が翌10:00を超えない時刻のみ
          const potentialEnd = (t + avgDuration) % (24 * 60);
          return potentialEnd <= 10 * 60 || t >= 21 * 60;
        });
        
        // 重複しない時間を探す
        for (let attempt = 0; attempt < 20; attempt++) {
          let candidateStart = timeCandidates[Math.floor(Math.random() * timeCandidates.length)];
          candidateStart = roundTo30Minutes(candidateStart);
          
          // 平均4時間（240分）を基準に、±30分のランダムな変動を加える（30分単位）
          const durationVariation = (Math.random() - 0.5) * 60;
          let candidateDuration = Math.max(180, Math.min(300, avgDuration + durationVariation));
          candidateDuration = roundTo30Minutes(candidateDuration);
          
          let candidateEnd = candidateStart + candidateDuration;
          
          // 21:00以降開始の場合、24時間を超える可能性がある
          if (candidateStart >= 21 * 60) {
            if (candidateEnd > 24 * 60) {
              const nextDayEnd = candidateEnd - 24 * 60;
              if (nextDayEnd > 10 * 60) {
                candidateEnd = 10 * 60;
              } else {
                candidateEnd = nextDayEnd;
              }
            }
          } else {
            candidateEnd = Math.min(candidateEnd, 10 * 60);
          }
          candidateEnd = roundTo30Minutes(candidateEnd);
          
          // 既存案件（既存 + 今回作成済み）と重複チェック
          const allExisting = [...existingForCleaner, ...newAppts.filter(a => a.cleaner_id === cleanerId).map(a => ({ start_min: a.start_min, end_min: a.end_min }))];
          const hasConflict = allExisting.some(existing => {
            return overlaps(candidateStart, candidateEnd, existing.start_min, existing.end_min);
          });
          
          if (!hasConflict) {
            cleaner = candidateCleaner;
            startTime = candidateStart;
            endTime = candidateEnd;
            duration = candidateDuration;
            break;
          }
        }
        
        if (cleaner) break;
      }
      
      // 重複しない時間が見つからなかった場合はスキップ
      if (!cleaner || startTime === null || endTime === null) {
        console.warn(`[createGoldenTimeAppointments] 重複しない時間が見つかりませんでした。案件${i + 1}をスキップします。`);
        continue;
      }
      
      const appt = {
        id: `golden_${Date.now()}_${i}`,
        schedule_id: newScheduleId('sch'),
        date: dateISO,
        cleaner_id: cleaner.id,
        start_min: startTime,
        end_min: endTime,
        target_name: targetName,
        work_type: workTypes[Math.floor(Math.random() * workTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        client_id: client.id,
        store_id: storeId,
        memo: '',
        created_at: Date.now() - i * 60000,
        contact_note: '',
        contact_last_at: null,
        contact_status: 'pending',
        contact_reminders: [],
      };
      newAppts.push(appt);
      
      // 作成済み案件を記録（次の案件の重複チェック用）
      const list = byCleaner.get(cleaner.id) || [];
      list.push({ start_min: startTime, end_min: endTime });
      byCleaner.set(cleaner.id, list);
    } catch (error) {
      console.warn(`[createGoldenTimeAppointments] Failed to get stores for client ${client.id}:`, error);
      // エラーが発生しても顧客名で案件を作成
      const targetName = client.name || client.client_name || `顧客${i + 1}`;
      
      // 清掃員をランダムに選択
      const shuffledCleaners = [...cleaners].sort(() => Math.random() - 0.5);
      let cleaner = null;
      let startTime = null;
      let endTime = null;
      let duration = null;
      
      // 各清掃員について、重複しない時間を探す
      for (const candidateCleaner of shuffledCleaners) {
        const cleanerId = candidateCleaner.id;
        const existingForCleaner = byCleaner.get(cleanerId) || [];
        
        // ゴールデンタイムの開始時刻候補をフィルタリング（時間的に可能なもの）
        const timeCandidates = goldenTimes.filter(t => {
          const potentialEnd = (t + avgDuration) % (24 * 60);
          return potentialEnd <= 10 * 60 || t >= 21 * 60;
        });
        
        // 重複しない時間を探す
        for (let attempt = 0; attempt < 20; attempt++) {
          let candidateStart = timeCandidates[Math.floor(Math.random() * timeCandidates.length)];
          candidateStart = roundTo30Minutes(candidateStart);
          
          const durationVariation = (Math.random() - 0.5) * 60;
          let candidateDuration = Math.max(180, Math.min(300, avgDuration + durationVariation));
          candidateDuration = roundTo30Minutes(candidateDuration);
          
          let candidateEnd = candidateStart + candidateDuration;
          
          if (candidateStart >= 21 * 60) {
            if (candidateEnd > 24 * 60) {
              const nextDayEnd = candidateEnd - 24 * 60;
              if (nextDayEnd > 10 * 60) {
                candidateEnd = 10 * 60;
              } else {
                candidateEnd = nextDayEnd;
              }
            }
          } else {
            candidateEnd = Math.min(candidateEnd, 10 * 60);
          }
          candidateEnd = roundTo30Minutes(candidateEnd);
          
          // 既存案件（既存 + 今回作成済み）と重複チェック
          const allExisting = [...existingForCleaner, ...newAppts.filter(a => a.cleaner_id === cleanerId).map(a => ({ start_min: a.start_min, end_min: a.end_min }))];
          const hasConflict = allExisting.some(existing => {
            return overlaps(candidateStart, candidateEnd, existing.start_min, existing.end_min);
          });
          
          if (!hasConflict) {
            cleaner = candidateCleaner;
            startTime = candidateStart;
            endTime = candidateEnd;
            duration = candidateDuration;
            break;
          }
        }
        
        if (cleaner) break;
      }
      
      // 重複しない時間が見つからなかった場合はスキップ
      if (!cleaner || startTime === null || endTime === null) {
        console.warn(`[createGoldenTimeAppointments] 重複しない時間が見つかりませんでした。案件${i + 1}をスキップします。`);
        continue;
      }
      
      const appt = {
        id: `golden_${Date.now()}_${i}`,
        schedule_id: newScheduleId('sch'),
        date: dateISO,
        cleaner_id: cleaner.id,
        start_min: startTime,
        end_min: endTime,
        target_name: targetName,
        work_type: workTypes[Math.floor(Math.random() * workTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        client_id: client.id,
        store_id: null,
        memo: '',
        created_at: Date.now() - i * 60000,
        contact_note: '',
        contact_last_at: null,
        contact_status: 'pending',
        contact_reminders: [],
      };
      newAppts.push(appt);
      
      // 作成済み案件を記録（次の案件の重複チェック用）
      const list = byCleaner.get(cleaner.id) || [];
      list.push({ start_min: startTime, end_min: endTime });
      byCleaner.set(cleaner.id, list);
    }
  }
  
  setAppointments((prev) => [...prev, ...newAppts]);
  alert(`${newAppts.length}件のゴールデンタイム案件を追加しました（21:00〜翌10:00、平均4時間、実際の顧客名簿から選択）`);
}

/** 昼間（10:00-21:00）の案件を1件作成 */
async function createDaytimeAppointment(cleaners, dateISO, appointments, setAppointments, clients, apiBase) {
  if (cleaners.length === 0) {
    alert('清掃員が登録されていません');
    return;
  }
  
  if (clients.length === 0) {
    alert('顧客データが取得できていません。しばらく待ってから再度お試しください。');
    return;
  }
  
  const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token);
  const base = apiBase.replace(/\/$/, '');
  
  // ランダムに1件の顧客を選択
  const randomClient = clients[Math.floor(Math.random() * clients.length)];
  
  try {
    // 顧客の店舗一覧を取得
    const storesResponse = await fetch(`${base}/stores?client_id=${randomClient.id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      cache: 'no-store'
    });
    
    let stores = [];
    if (storesResponse.ok) {
      const storesData = await storesResponse.json();
      stores = Array.isArray(storesData) ? storesData : (storesData?.items ?? []);
    }
    
    // 店舗がある場合はランダムに選択、ない場合は顧客名を使用
    let store = null;
    let targetName = '';
    let storeId = null;
    
    if (stores.length > 0) {
      store = stores[Math.floor(Math.random() * stores.length)];
      targetName = store.name || store.store_name || '';
      storeId = store.id;
    } else {
      targetName = randomClient.name || randomClient.client_name || '顧客1';
    }
    
    if (!targetName) {
      targetName = '顧客1';
    }
    
    // 清掃員をランダムに選択
    const cleaner = cleaners[Math.floor(Math.random() * cleaners.length)];
    
    // 昼間の時間帯（10:00-21:00）でランダムに開始時刻を選択（30分単位）
    const daytimeStart = 10 * 60; // 10:00
    const daytimeEnd = 21 * 60;   // 21:00
    const duration = 4 * 60; // 4時間
    
    // 開始時刻をランダムに選択（30分単位）
    const startMinutes = Math.floor(Math.random() * ((daytimeEnd - daytimeStart - duration) / 30)) * 30 + daytimeStart;
    const startTime = roundTo30Minutes(startMinutes);
    const endTime = roundTo30Minutes(Math.min(startTime + duration, daytimeEnd));
    
    // 既存の案件を取得（重複チェック用）
    const existingAppts = appointments || [];
    const existingForCleaner = existingAppts.filter(a => 
      a.date === dateISO && 
      a.cleaner_id === cleaner.id &&
      overlaps(startTime, endTime, a.start_min, a.end_min)
    );
    
    if (existingForCleaner.length > 0) {
      alert('選択した清掃員の時間が重複しています。別の清掃員を選択してください。');
      return;
    }
    
    // 案件を作成
    const appt = {
      id: `appt_${Date.now()}`,
      schedule_id: newScheduleId('sch'),
      date: dateISO,
      cleaner_id: cleaner.id,
      cleaner_ids: [cleaner.id],
      start_min: startTime,
      end_min: endTime,
      target_name: targetName,
      work_type: '定期清掃（1ヶ月）',
      status: 'booked',
      memo: '',
      created_at: Date.now(),
      contact_note: '',
      contact_last_at: null,
      contact_status: 'pending',
      contact_reminders: [],
      store_id: storeId || null,
      client_id: randomClient.id || null,
      brand_id: store?.brand_id || null,
    };
    
    setAppointments((prev) => [...prev, appt]);
    alert(`昼間案件を1件追加しました（${minutesToHHMM(startTime)}〜${minutesToHHMM(endTime)}、${targetName}）`);
  } catch (error) {
    console.error(`[createDaytimeAppointment] Failed to get stores for client ${randomClient.id}:`, error);
    alert('店舗情報の取得に失敗しました');
  }
}

/** すべてのスケジュールをクリア */
function clearAllAppointments(setAppointments) {
  setAppointments([]);
  localStorage.removeItem(STORAGE_APPOINTMENTS);
}

function makeSeedAppointments(dateISO) {
  const seed = [
    { cleaner_id: 'c1', start: '09:00', end: '09:30', target_name: 'A店', work_type: '定期', status: 'booked' },
    { cleaner_id: 'c1', start: '10:00', end: '10:30', target_name: 'B店', work_type: '特別', status: 'checked_in' },
    { cleaner_id: 'c2', start: '09:30', end: '10:00', target_name: 'C店', work_type: '定期', status: 'in_progress' },
    { cleaner_id: 'c2', start: '10:15', end: '10:45', target_name: 'D店', work_type: '入念', status: 'booked' },
    { cleaner_id: 'c3', start: '13:00', end: '13:30', target_name: 'E店', work_type: '定期', status: 'done' },
    { cleaner_id: 'c4', start: '15:00', end: '15:30', target_name: 'F店', work_type: '夜間', status: 'cancelled' },
  ];
  return seed.map((x, idx) => {
    const id = `a_${dateISO}_${idx}`;
    return {
      id,
      schedule_id: id,
      date: dateISO,
      cleaner_id: x.cleaner_id,
      start_min: hhmmToMinutes(x.start),
      end_min: hhmmToMinutes(x.end),
      target_name: x.target_name,
      work_type: x.work_type,
      status: x.status,
      memo: '',
      created_at: Date.now() - idx * 60000,
      contact_note: '',
      contact_last_at: null,
      contact_status: 'pending',
      contact_reminders: [],
    };
  });
}

function ensureContactFields(appt) {
  return {
    ...appt,
    schedule_id: appt.schedule_id ?? appt.id,
    contact_note: appt.contact_note ?? '',
    contact_last_at: appt.contact_last_at ?? null,
    contact_status: appt.contact_status ?? 'pending',
    contact_reminders: appt.contact_reminders ?? [], // 事前連絡リマインダー（例：['7日前', '3日前', '1日前']）
    cleaner_ids: appt.cleaner_ids || (appt.cleaner_id ? [appt.cleaner_id] : []), // 複数清掃員対応
  };
}

/** DynamoDBのスケジュールデータをフロントエンド形式に変換 */
function convertScheduleToAppointment(schedule) {
  const date = schedule.scheduled_date || schedule.date || '';
  const startMin = schedule.start_min ?? (schedule.start_time ? hhmmToMinutes(schedule.start_time) : 540);
  const endMin = schedule.end_min ?? (schedule.end_time ? hhmmToMinutes(schedule.end_time) : 600);
  
  return {
    id: schedule.id,
    schedule_id: schedule.id,
    date: date,
    cleaner_id: schedule.worker_id || schedule.assigned_to || '',
    start_min: startMin,
    end_min: endMin,
    start: schedule.start_time || minutesToHHMM(startMin),
    end: schedule.end_time || minutesToHHMM(endMin),
    target_name: schedule.target_name || schedule.summary || '未設定',
    work_type: schedule.work_type || 'その他',
    status: schedule.status || 'booked',
    memo: schedule.description || schedule.memo || '',
    location: schedule.location || '',
    store_id: schedule.store_id || null,
    origin: schedule.origin || 'manual',
    external_id: schedule.external_id || null,
    contact_note: '',
    contact_last_at: null,
    contact_status: 'pending',
    contact_reminders: [],
    cleaner_ids: schedule.worker_id ? [schedule.worker_id] : [],
    created_at: schedule.created_at ? new Date(schedule.created_at).getTime() : Date.now(),
    updated_at: schedule.updated_at ? new Date(schedule.updated_at).getTime() : Date.now(),
  };
}

function statusMeta(statusKey) {
  return STATUSES.find((s) => s.key === statusKey) ?? STATUSES[0];
}

function contactStatusMeta(key) {
  return CONTACT_STATUSES.find((c) => c.key === key) ?? CONTACT_STATUSES[0];
}

function formatContactLastAt(isoOrTs) {
  if (!isoOrTs) return null;
  const d = typeof isoOrTs === 'number' ? new Date(isoOrTs) : new Date(isoOrTs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** ページ内 appointment（date + start_min/end_min）を scheduleConflicts 用の shape に変換 */
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

/** ブロックが dateISO の日と重なる部分の start_min / end_min（0〜24*60）を返す。重ならなければ null */
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

function detectConflicts(appointments) {
  const byCleaner = new Map();
  for (const a of appointments) {
    const list = byCleaner.get(a.cleaner_id) ?? [];
    list.push(a);
    byCleaner.set(a.cleaner_id, list);
  }
  const conflictIds = new Set();
  for (const [, list] of byCleaner.entries()) {
    const sorted = [...list].sort((a, b) => a.start_min - b.start_min);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start_min >= sorted[i].end_min) break;
        if (overlaps(sorted[i].start_min, sorted[i].end_min, sorted[j].start_min, sorted[j].end_min)) {
          conflictIds.add(sorted[i].id);
          conflictIds.add(sorted[j].id);
        }
      }
    }
  }
  return conflictIds;
}

export default function AdminScheduleTimelinePage() {
  const [cleaners, setCleaners] = useState(() => loadJson(STORAGE_CLEANERS, defaultCleaners));
  const [dateISO, setDateISO] = useState(todayISO());
  const [view, setView] = useState('day');
  const [query, setQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterCleaner, setFilterCleaner] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterWorkType, setFilterWorkType] = useState('all');
  const [activeCleanerSP, setActiveCleanerSP] = useState(cleaners[0]?.id ?? 'c1');

  /** unit を付与し、梅岡ユニット→遠藤ユニットの順。各ユニット内はリーダーが左（先頭） */
  const cleanersWithUnit = useMemo(() => {
    const list = cleaners.map((c) => ({ ...c, unit: c.unit ?? getUnitFromName(c.name) }));
    const cleaning = sortLeaderFirst(list.filter((c) => c.unit === 'cleaning'), '梅岡');
    const maintenance = sortLeaderFirst(list.filter((c) => c.unit === 'maintenance'), '遠藤');
    return [...cleaning, ...maintenance];
  }, [cleaners]);

  const cleaningUnitIds = useMemo(() => new Set(cleanersWithUnit.filter((c) => c.unit === 'cleaning').map((c) => c.id)), [cleanersWithUnit]);
  const maintenanceUnitIds = useMemo(() => new Set(cleanersWithUnit.filter((c) => c.unit === 'maintenance').map((c) => c.id)), [cleanersWithUnit]);

  /** ユニットフィルタに応じた清掃員リスト（プルダウン用） */
  const cleanersForFilter = useMemo(() => {
    if (filterUnit === 'cleaning') return cleanersWithUnit.filter((c) => c.unit === 'cleaning');
    if (filterUnit === 'maintenance') return cleanersWithUnit.filter((c) => c.unit === 'maintenance');
    return cleanersWithUnit;
  }, [cleanersWithUnit, filterUnit]);

  /** タイムライン：ユニットごとに2カラム。左＝梅岡ユニット、右＝遠藤ユニット（各ユニット内はリーダーが左） */
  const timelineUnitColumns = useMemo(() => {
    const cleaning = cleanersWithUnit.filter((c) => c.unit === 'cleaning');
    const maintenance = cleanersWithUnit.filter((c) => c.unit === 'maintenance');
    return { cleaning, maintenance };
  }, [cleanersWithUnit]);

  const [appointments, setAppointments] = useState(() => {
    // 初回は空配列（APIから読み込む）
    return [];
  });
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);

  const [blocks, setBlocks] = useState(() => loadJson(STORAGE_BLOCKS, []));
  /** カルテDock に表示する案件（カードクリックで設定）。ハイライトは selectedAppt?.schedule_id で行う */
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [karteDockHeight, setKarteDockHeight] = useState(() => {
    const saved = localStorage.getItem('admin-schedule-karte-dock-height');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizingKarteDock, setIsResizingKarteDock] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [brands, setBrands] = useState([]);
  const [clients, setClients] = useState([]);
  const [stores, setStores] = useState([]);
  const [isSavingKarte, setIsSavingKarte] = useState(false);
  const kartePanelRef = useRef(null);

  /** APIからスケジュールを読み込む関数 */
  const loadSchedulesFromAPI = useCallback((targetDateISO = dateISO) => {
    setIsLoadingSchedules(true);
    
    const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
    const base = API_BASE.replace(/\/$/, '');
    
    // 日付範囲を計算（選択日付の前後30日）
    const selectedDate = dayjs(targetDateISO);
    const dateFrom = selectedDate.subtract(30, 'day').format('YYYY-MM-DD');
    const dateTo = selectedDate.add(30, 'day').format('YYYY-MM-DD');
    
    const url = `${base}/schedules?date_from=${dateFrom}&date_to=${dateTo}&limit=2000`;
    
    return fetch(url, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      cache: 'no-store'
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        // APIレスポンスの形式に対応（items配列または直接配列）
        const schedules = Array.isArray(data) ? data : (data?.items || []);
        const converted = schedules
          .map(convertScheduleToAppointment)
          .map(ensureContactFields);
        
        setAppointments(converted);
        setIsLoadingSchedules(false);
        return converted;
      })
      .catch((err) => {
        console.warn('[AdminScheduleTimeline] Failed to load schedules from API, falling back to localStorage', err);
        // フォールバック: localStorageから読み込み
        const raw = loadJson(STORAGE_APPOINTMENTS, null);
        if (raw && Array.isArray(raw) && raw.length > 0) {
          setAppointments(raw.map(ensureContactFields));
        } else {
          setAppointments(makeSeedAppointments(targetDateISO));
        }
        setIsLoadingSchedules(false);
        throw err;
      });
  }, [dateISO]);

  /** APIからスケジュールを読み込む */
  useEffect(() => {
    loadSchedulesFromAPI(dateISO);
  }, [dateISO, loadSchedulesFromAPI]);
  useEffect(() => {
    saveJson(STORAGE_CLEANERS, cleaners);
  }, [cleaners]);
  useEffect(() => {
    saveJson(STORAGE_BLOCKS, blocks);
  }, [blocks]);

  useEffect(() => {
    localStorage.setItem('admin-schedule-karte-dock-height', String(karteDockHeight));
  }, [karteDockHeight]);

  /** 初回・マウント時: workers API から清掃事業部のみ取得して清掃員リストを更新（失敗時は既存の cleaners を維持） */
  useEffect(() => {
    let cancelled = false;
    const base = API_BASE.replace(/\/$/, '');
    fetch(`${base}/workers?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : (data?.items ?? data?.workers ?? []);
        const cleaningDept =
          items.filter(
            (w) =>
              (w.department && String(w.department).trim() === '清掃事業部') ||
              (w.parent_department && String(w.parent_department).trim() === '清掃事業部')
          ) || [];
        const withUnit = cleaningDept
          .map((w) => ({
            id: w.id,
            name: w.name || w.email || w.id || '',
            unit: getUnitFromName(w.name || w.email || w.id),
          }))
          .filter((w) => w.id);
        const cleaningFirst = [...withUnit.filter((w) => w.unit === 'cleaning'), ...withUnit.filter((w) => w.unit === 'maintenance')];
        if (cleaningFirst.length > 0) setCleaners(cleaningFirst);
      })
      .catch((err) => {
        if (!cancelled) console.warn('[AdminScheduleTimeline] workers API failed, keeping current cleaners', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 顧客一覧を取得 */
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
    const base = API_BASE.replace(/\/$/, '');
    fetch(`${base}/clients`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      cache: 'no-store'
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setClients(items);
      })
      .catch((err) => {
        if (!cancelled) console.warn('[AdminScheduleTimeline] clients API failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** ブランド一覧を取得 */
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
    const base = API_BASE.replace(/\/$/, '');
    fetch(`${base}/brands`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      cache: 'no-store'
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setBrands(items);
      })
      .catch((err) => {
        if (!cancelled) console.warn('[AdminScheduleTimeline] brands API failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 店舗一覧を取得 */
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
    const base = API_BASE.replace(/\/$/, '');
    fetch(`${base}/stores`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      cache: 'no-store'
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setStores(items);
      })
      .catch((err) => {
        if (!cancelled) console.warn('[AdminScheduleTimeline] stores API failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 選択された案件の店舗情報を取得 */
  useEffect(() => {
    if (!selectedAppt?.store_id) {
      setSelectedStore(null);
      return;
    }

    let cancelled = false;
    const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
    const base = API_BASE.replace(/\/$/, '');
    
    // 店舗IDから店舗情報を取得
    fetch(`${base}/stores/${selectedAppt.store_id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      cache: 'no-store'
    })
      .then((res) => {
        if (!res.ok) {
          // 404の場合は店舗一覧から検索を試みる
          if (res.status === 404) {
            return fetch(`${base}/stores?client_id=${selectedAppt.client_id || ''}`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              cache: 'no-store'
            }).then((storesRes) => {
              if (storesRes.ok) {
                return storesRes.json().then((storesData) => {
                  const items = Array.isArray(storesData) ? storesData : (storesData?.items ?? []);
                  const found = items.find((s) => String(s.id) === String(selectedAppt.store_id));
                  if (found) return found;
                  throw new Error('Store not found');
                });
              }
              throw new Error('Store not found');
            });
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSelectedStore(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[AdminScheduleTimeline] store API failed', err);
          setSelectedStore(null);
        }
      });
    
    return () => {
      cancelled = true;
    };
  }, [selectedAppt?.store_id, selectedAppt?.client_id]);


  /** 清掃員リストが差し替わったとき、SP で選択中の id がリストにいなければ先頭に合わせる */
  useEffect(() => {
    const ids = new Set(cleaners.map((c) => c.id));
    if (cleaners.length > 0 && !ids.has(activeCleanerSP)) {
      setActiveCleanerSP(cleaners[0].id);
    }
  }, [cleaners]);

  /** ユニット変更時、選択中の清掃員がそのユニットにいなければ「全員」に戻す */
  useEffect(() => {
    if (filterCleaner === 'all') return;
    const ids = new Set(cleanersForFilter.map((c) => c.id));
    if (!ids.has(filterCleaner)) setFilterCleaner('all');
  }, [filterUnit, cleanersForFilter, filterCleaner]);

  const conflictIds = useMemo(() => detectConflicts(appointments), [appointments]);

  /** Rolling 8 Days（今日＋7日）。毎日自動で右→左にスライドする */
  const todayKey = todayISO();
  const rollingDays = useMemo(() => {
    const baseDate = dayjs().startOf('day');
    return Array.from({ length: 8 }, (_, i) =>
      baseDate.add(i, 'day').format('YYYY-MM-DD')
    );
  }, [todayKey]);

  /** 事前連絡パネル用：列ヘッダーは「当日週の1週間前」の日付（連絡する週） */
  const contactWeekDayIsos = useMemo(() => {
    return rollingDays.map((iso) => {
      const d = new Date(iso + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    });
  }, [rollingDays]);

  const filteredAppointments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (a.date !== dateISO) return false;
      if (filterUnit === 'cleaning' && !cleaningUnitIds.has(a.cleaner_id)) return false;
      if (filterUnit === 'maintenance' && !maintenanceUnitIds.has(a.cleaner_id)) return false;
      if (filterCleaner !== 'all' && a.cleaner_id !== filterCleaner) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      if (filterWorkType !== 'all' && a.work_type !== filterWorkType) return false;
      if (!q) return true;
      const cleanerName = cleanersWithUnit.find((d) => d.id === a.cleaner_id)?.name ?? '';
      const hay = `${a.target_name} ${a.work_type} ${cleanerName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [appointments, dateISO, query, filterUnit, filterCleaner, filterStatus, filterWorkType, cleanersWithUnit, cleaningUnitIds, maintenanceUnitIds]);

  const weekFilteredAppointments = useMemo(() => {
    const daySet = new Set(rollingDays);
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (!daySet.has(a.date)) return false;
      if (filterUnit === 'cleaning' && !cleaningUnitIds.has(a.cleaner_id)) return false;
      if (filterUnit === 'maintenance' && !maintenanceUnitIds.has(a.cleaner_id)) return false;
      if (filterCleaner !== 'all' && a.cleaner_id !== filterCleaner) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      if (filterWorkType !== 'all' && a.work_type !== filterWorkType) return false;
      if (!q) return true;
      const cleanerName = cleanersWithUnit.find((d) => d.id === a.cleaner_id)?.name ?? '';
      const hay = `${a.target_name} ${a.work_type} ${cleanerName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [appointments, rollingDays, query, filterUnit, filterCleaner, filterStatus, filterWorkType, cleanersWithUnit, cleaningUnitIds, maintenanceUnitIds]);

  const summary = useMemo(() => {
    const total = filteredAppointments.length;
    const byStatus = new Map();
    for (const a of filteredAppointments) {
      byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
    }
    return { total, byStatus };
  }, [filteredAppointments]);

  const [modal, setModal] = useState({ open: false, appt: null, mode: 'view' });
  const [contactMode, setContactMode] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [saveConflictError, setSaveConflictError] = useState(null);
  const [conflictOverlayVisible, setConflictOverlayVisible] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalUserId, setBlockModalUserId] = useState(null);
  const [blockModalInitialStartAt, setBlockModalInitialStartAt] = useState(null);
  const [blockModalInitialEndAt, setBlockModalInitialEndAt] = useState(null);
  const [blockConflictError, setBlockConflictError] = useState(null);
  const [icsImportModal, setIcsImportModal] = useState({ open: false });
  const [isMisogiOpen, setIsMisogiOpen] = useState(false);

  /** defaultCleanerId: 清掃員ID。startMinOptional: 指定時はその時刻で新規作成（タイムラインクリック用） */
  function openCreate(defaultCleanerId, startMinOptional = null) {
    const dayEnd = 24 * 60;
    let start = startMinOptional != null ? startMinOptional : 9 * 60;
    start = roundTo30Minutes(start); // 30分単位に丸める
    let end = Math.min(start + 30, dayEnd);
    end = roundTo30Minutes(end); // 30分単位に丸める
    setModal({
      open: true,
      mode: 'create',
      appt: {
        id: `new_${Date.now()}`,
        schedule_id: newScheduleId('sch'),
        date: dateISO,
        cleaner_id: defaultCleanerId ?? cleanersWithUnit[0]?.id ?? cleaners[0]?.id ?? 'c1',
        cleaner_ids: defaultCleanerId ? [defaultCleanerId] : (cleanersWithUnit[0]?.id ? [cleanersWithUnit[0].id] : (cleaners[0]?.id ? [cleaners[0].id] : ['c1'])),
        start_min: start,
        end_min: end,
        target_name: '',
        work_type: '定期清掃（1ヶ月）',
        status: 'booked',
        memo: '',
        created_at: Date.now(),
        contact_note: '',
        contact_last_at: null,
        contact_status: 'pending',
        contact_reminders: [],
      },
    });
  }

  function openView(appt) {
    setModal({ open: true, mode: 'view', appt: { ...appt } });
  }

  function closeModal() {
    setModal({ open: false, appt: null, mode: 'view' });
    setSaveConflictError(null);
  }

  function saveModal(updated) {
    setSaveConflictError(null);

    // 複数の清掃員が選択されている場合、各清掃員ごとに案件を作成
    const cleanerIds = updated.cleaner_ids || (updated.cleaner_id ? [updated.cleaner_id] : []);
    
    if (cleanerIds.length === 0) {
      setSaveConflictError('清掃員を1人以上選択してください');
      return;
    }

    // 既存案件の更新か新規作成か
    const exists = appointments.some((p) => p.id === updated.id);
    
    if (exists) {
      // 既存案件の更新：最初の清掃員で更新（既存の動作を維持）
      const candidate = [apptToConflictShape({ ...updated, cleaner_id: cleanerIds[0], schedule_id: updated.schedule_id ?? updated.id })];
      const existingSameDay = appointments.filter(
        (p) => p.date === updated.date && p.id !== updated.id
      );
      const existingForCheck = existingSameDay.map(apptToConflictShape);
      const userIdToName = Object.fromEntries(cleanersWithUnit.map((c) => [c.id, c.name]));
      const conflicts = detectConflictsBeforeSave({
        candidateAppointments: candidate,
        existingAppointments: existingForCheck,
        blocks,
        userIdToName,
      });

      if (conflicts.length > 0) {
        setSaveConflictError(
          `409 Conflict（重複のため保存できません）\n${conflicts.map((c) => c.message).join('\n')}`
        );
        setConflictOverlayVisible(true);
        setTimeout(() => {
          setConflictOverlayVisible(false);
        }, 3000);
        return;
      }

      setAppointments((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? { ...updated, cleaner_id: cleanerIds[0], cleaner_ids: cleanerIds, schedule_id: updated.schedule_id ?? updated.id }
            : p
        )
      );
      closeModal();
    } else {
      // 新規作成：各清掃員ごとに案件を作成
      const newAppts = cleanerIds.map((cleanerId, index) => {
        const apptId = index === 0 ? updated.id : `new_${Date.now()}_${index}`;
        return {
          ...updated,
          id: apptId,
          cleaner_id: cleanerId,
          cleaner_ids: cleanerIds,
          schedule_id: index === 0 ? (updated.schedule_id ?? updated.id) : newScheduleId('sch'),
        };
      });

      // 重複チェック：すべての候補案件をチェック
      const candidates = newAppts.map((a) => apptToConflictShape(a));
      const existingSameDay = appointments.filter((p) => p.date === updated.date);
      const existingForCheck = existingSameDay.map(apptToConflictShape);
      const userIdToName = Object.fromEntries(cleanersWithUnit.map((c) => [c.id, c.name]));
      const conflicts = detectConflictsBeforeSave({
        candidateAppointments: candidates,
        existingAppointments: existingForCheck,
        blocks,
        userIdToName,
      });

      if (conflicts.length > 0) {
        setSaveConflictError(
          `409 Conflict（重複のため保存できません）\n${conflicts.map((c) => c.message).join('\n')}`
        );
        setConflictOverlayVisible(true);
        setTimeout(() => {
          setConflictOverlayVisible(false);
        }, 3000);
        return;
      }

      setAppointments((prev) => [...prev, ...newAppts]);
      closeModal();
    }
  }

  function deleteAppt(id) {
    const scheduleId = appointments.find((p) => p.id === id)?.schedule_id;
    setAppointments((prev) => prev.filter((p) => p.id !== id));
    if (selectedAppointmentId === id) setSelectedAppointmentId(null);
    if (selectedAppt?.schedule_id === scheduleId) setSelectedAppt(null);
    closeModal();
  }

  function handleScheduleCardClick(appt) {
    setSelectedAppt(appt);
  }

  function handleTimelineBackgroundClick() {
    setSelectedAppt(null);
  }

  function handleCloseKarteDock() {
    setSelectedAppt(null);
  }

  async function handleSaveKarte() {
    if (!kartePanelRef.current) return;
    setIsSavingKarte(true);
    try {
      await kartePanelRef.current.save();
      alert('カルテを保存しました');
    } catch (error) {
      console.error('[AdminScheduleTimelinePage] Failed to save karte:', error);
      alert('カルテの保存に失敗しました');
    } finally {
      setIsSavingKarte(false);
    }
  }

  function handleKarteDockResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingKarteDock(true);
    const startY = e.clientY ?? e.touches?.[0]?.clientY;
    const startHeight = karteDockHeight;

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      const currentY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (currentY !== undefined && startY !== undefined) {
        const delta = startY - currentY; // 上にドラッグすると高さが増える
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
  }

  /** スロット右クリックでブロック作成モーダルを開く。startMin はその日の分（0–1440）。 */
  function openBlockModalWithSlot(userId, startMin) {
    const dayEnd = 24 * 60;
    const start = startMin ?? 9 * 60;
    const end = Math.min(start + 60, dayEnd);
    setBlockConflictError(null);
    setBlockModalUserId(userId);
    setBlockModalInitialStartAt(`${dateISO}T${minutesToHHMM(start)}`);
    setBlockModalInitialEndAt(`${dateISO}T${minutesToHHMM(end)}`);
    setBlockModalOpen(true);
  }

  function closeBlockModal() {
    setBlockModalOpen(false);
    setBlockModalUserId(null);
    setBlockModalInitialStartAt(null);
    setBlockModalInitialEndAt(null);
    setBlockConflictError(null);
  }

  function createBlock(payload) {
    const newBlock = {
      id: `block_${Date.now()}`,
      user_id: payload.user_id,
      start_at: payload.start_at,
      end_at: payload.end_at,
      type: payload.type,
      reason_code: payload.reason_code ?? 'other',
      reason_note: payload.reason_note ?? null,
      visibility: payload.visibility ?? 'admin_only',
    };
    const existingAppointmentsForCheck = appointments.map(apptToConflictShape);
    const userIdToName = Object.fromEntries(cleanersWithUnit.map((c) => [c.id, c.name]));
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
    setBlocks((prev) => [...prev, newBlock]);
    closeBlockModal();
  }

  function saveContact(appointmentId, { contact_note, contact_status }) {
    const now = new Date().toISOString();
    setAppointments((prev) =>
      prev.map((p) =>
        p.id === appointmentId
          ? { ...p, contact_note: contact_note ?? p.contact_note, contact_status: contact_status ?? p.contact_status, contact_last_at: now }
          : p
      )
    );
  }

  function jumpToday() {
    setDateISO(todayISO());
  }

  function shiftDate(days) {
    const base = new Date(dateISO + 'T00:00:00');
    base.setDate(base.getDate() + days);
    setDateISO(`${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`);
  }

  function shiftWeek(delta) {
    const base = new Date(dateISO + 'T00:00:00');
    base.setDate(base.getDate() + delta * 7);
    setDateISO(`${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`);
  }

  function jumpThisWeek() {
    setDateISO(todayISO());
  }

  return (
    <div className="report-page admin-schedule-timeline-page" data-job="admin">
      <div className={`report-page-viz ${isMisogiOpen ? 'hidden' : ''}`}>
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content admin-schedule-timeline-content">
        <p className="admin-schedule-timeline-back">
          <Link to="/admin/entrance">← 管理エントランス</Link>
        </p>

        <header className="header">
          <div className="headerRow">
            <div className="titleBlock">
              <div className="title">清掃スケジュール</div>
              <div className="subtitle">
                {view === 'week' ? `${getWeekRangeLabel(dateISO)} の週` : `${isoToDateLabel(dateISO)} の割当`}
              </div>
            </div>
            <div className="headerActions">
              {view === 'week' ? (
                <>
                  <button type="button" className="btn" onClick={() => shiftWeek(-1)}>← 前週</button>
                  <button type="button" className="btn" onClick={jumpThisWeek}>今週</button>
                  <button type="button" className="btn" onClick={() => shiftWeek(1)}>翌週 →</button>
                  <label className="contactModeToggle">
                    <input type="checkbox" checked={contactMode} onChange={(e) => setContactMode(e.target.checked)} />
                    <span className="contactModeLabel">事前連絡</span>
                  </label>
                </>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => shiftDate(-1)}>← 前日</button>
                  <button type="button" className="btn" onClick={jumpToday}>今日</button>
                  <button type="button" className="btn" onClick={() => shiftDate(1)}>翌日 →</button>
                </>
              )}
              <button type="button" className="btnPrimary" onClick={() => openCreate(filterCleaner !== 'all' ? filterCleaner : cleanersWithUnit[0]?.id)}>＋ 割当追加</button>
              <button type="button" className="btn" onClick={() => setIcsImportModal({ open: true })}>📅 Googleカレンダー取り込み</button>
              <button type="button" className="btn" onClick={() => createRandomAppointments(cleanersWithUnit, dateISO, setAppointments, clients, API_BASE)}>🎲 ランダム割当（テスト）</button>
              <button type="button" className="btn" onClick={async () => {
                clearAllAppointments(setAppointments);
                // 少し待ってからゴールデンタイム案件を作成
                setTimeout(async () => {
                  await createGoldenTimeAppointments(cleanersWithUnit, dateISO, appointments, setAppointments, clients, API_BASE);
                }, 100);
              }}>🌙 全削除→ゴールデンタイム案件作成</button>
              <button type="button" className="btn" onClick={async () => {
                await createDaytimeAppointment(cleanersWithUnit, dateISO, appointments, setAppointments, clients, API_BASE);
              }}>☀ 昼間案件を1件作成</button>
            </div>
          </div>
          <div className="headerRow headerRow2">
            <div className="controlsLeft">
              <label className="field">
                <span>日付</span>
                <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
              </label>
              <label className="field grow">
                <span>検索</span>
                <input placeholder="現場名 / 作業種別 / 清掃員" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
            </div>
            <div className="controlsRight">
              <div className="field viewSwitcher">
                <span>表示</span>
                <div className="viewSwitcherButtons" role="group" aria-label="表示切替">
                  <button type="button" className={`viewSwitcherBtn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')} title="タイムライン" aria-pressed={view === 'day'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="4" width="4" height="3" rx="0.5"/><rect x="8" y="6" width="4" height="3" rx="0.5"/><rect x="14" y="8" width="4" height="3" rx="0.5"/></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')} title="週" aria-pressed={view === 'week'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="1" y="4" width="2.5" height="12" rx="0.5"/><rect x="5" y="4" width="2.5" height="12" rx="0.5"/><rect x="9" y="4" width="2.5" height="12" rx="0.5"/><rect x="13" y="4" width="2.5" height="12" rx="0.5"/><rect x="17" y="4" width="2.5" height="12" rx="0.5"/></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} title="一覧" aria-pressed={view === 'list'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="3" width="16" height="2" rx="0.5"/><rect x="2" y="9" width="16" height="2" rx="0.5"/><rect x="2" y="15" width="16" height="2" rx="0.5"/></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')} title="月（簡易）" aria-pressed={view === 'month'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="2" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="4" y="5" width="2.5" height="2.5" rx="0.3"/><rect x="8" y="5" width="2.5" height="2.5" rx="0.3"/><rect x="12" y="5" width="2.5" height="2.5" rx="0.3"/><rect x="4" y="9" width="2.5" height="2.5" rx="0.3"/><rect x="8" y="9" width="2.5" height="2.5" rx="0.3"/><rect x="12" y="9" width="2.5" height="2.5" rx="0.3"/></svg>
                  </button>
                </div>
              </div>
              <label className="field">
                <span>ユニット</span>
                <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
                  <option value="all">全て</option>
                  <option value="cleaning">清掃員（梅岡ユニット）</option>
                  <option value="maintenance">メンテナンス（遠藤ユニット）</option>
                </select>
              </label>
              <label className="field">
                <span>清掃員</span>
                <select value={filterCleaner} onChange={(e) => setFilterCleaner(e.target.value)}>
                  <option value="all">{filterUnit === 'all' ? '全員' : filterUnit === 'cleaning' ? '全員（清掃）' : '全員（メンテ）'}</option>
                  {cleanersForFilter.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>状態</span>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">全て</option>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>種別</span>
                <select value={filterWorkType} onChange={(e) => setFilterWorkType(e.target.value)}>
                  <option value="all">全て</option>
                  {WORK_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div className="summaryPills">
                <span className="pill">合計 {summary.total}</span>
                {STATUSES.map((s) => (
                  <span key={s.key} className="pill subtle">{s.label} {summary.byStatus.get(s.key) ?? 0}</span>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="main">
          {view === 'day' && (
            <div className="grid">
              <div className="pcOnly">
                <DayTimelinePC
                  dateISO={dateISO}
                  cleaners={cleanersWithUnit}
                  timelineUnitColumns={timelineUnitColumns}
                  appointments={filteredAppointments}
                  blocks={blocks}
                  conflictIds={conflictIds}
                  activeScheduleId={selectedAppt?.schedule_id ?? null}
                  onCardClick={handleScheduleCardClick}
                  onBackgroundClick={handleTimelineBackgroundClick}
                  onCreate={openCreate}
                  onOpenBlockModalWithSlot={openBlockModalWithSlot}
                  stores={stores}
                  clients={clients}
                  brands={brands}
                />
              </div>
              <div className="spOnly">
                <DayTimelineSP
                  dateISO={dateISO}
                  cleaners={cleanersWithUnit}
                  activeCleanerId={activeCleanerSP}
                  setActiveCleanerId={setActiveCleanerSP}
                  appointments={filteredAppointments}
                  blocks={blocks}
                  conflictIds={conflictIds}
                  activeScheduleId={selectedAppt?.schedule_id ?? null}
                  onCardClick={handleScheduleCardClick}
                  onCreate={openCreate}
                  onOpenBlockModalWithSlot={openBlockModalWithSlot}
                />
              </div>
            </div>
          )}
          {view === 'week' && !contactMode && (
            <WeekView
              dateISO={dateISO}
              setDateISO={setDateISO}
              rollingDays={rollingDays}
              cleaners={cleanersWithUnit}
              appointments={weekFilteredAppointments}
              conflictIds={conflictIds}
              onCardClick={setSelectedAppt}
              onCreate={openCreate}
            />
          )}
          {view === 'week' && contactMode && (
            <div className="contactModePanels">
              {/* 上段：日付は1週間前（連絡する週）、表示する予定は1週間後（実行週）。下段と同一予定で紐づく */}
              <ContactWeekPanel
                columnLabelIsos={contactWeekDayIsos}
                weekDayIsos={rollingDays}
                cleaners={cleanersWithUnit}
                appointments={weekFilteredAppointments}
                conflictIds={conflictIds}
                selectedAppointmentId={selectedAppointmentId}
                onSelectCard={(id) => {
                  setSelectedAppointmentId(id);
                  const appt = weekFilteredAppointments.find((a) => a.id === id);
                  if (appt) setSelectedAppt(appt);
                }}
                onSaveContact={saveContact}
                onOpen={openView}
                activeScheduleId={selectedAppt?.schedule_id ?? null}
              />
              <CleaningWeekPanel
                weekDayIsos={rollingDays}
                cleaners={cleanersWithUnit}
                appointments={weekFilteredAppointments}
                conflictIds={conflictIds}
                selectedAppointmentId={selectedAppointmentId}
                activeScheduleId={selectedAppt?.schedule_id ?? null}
                onCardClick={setSelectedAppt}
                onOpen={openView}
              />
            </div>
          )}
          {view === 'list' && (
            <DayList
              dateISO={dateISO}
              cleaners={cleanersWithUnit}
              appointments={filteredAppointments}
              conflictIds={conflictIds}
              onCardClick={setSelectedAppt}
              onCreate={openCreate}
            />
          )}
          {view === 'month' && (
            <MonthSimple dateISO={dateISO} setDateISO={setDateISO} />
          )}
        </main>

        {/* 重複エラーオーバーレイ吹き出し */}
        {conflictOverlayVisible && (
          <div className="conflictOverlay">
            <div className="conflictOverlayBubble">
              <div className="conflictOverlayMessage">
                スケジュールの重複を確認。時間を調整してください。
              </div>
            </div>
          </div>
        )}

        {selectedAppt && (
          <section className="karteDock" style={{ height: `${karteDockHeight}px` }}>
            <div 
              className={`karteDockHeader ${isResizingKarteDock ? 'resizing' : ''}`}
              onMouseDown={handleKarteDockResizeStart}
              onTouchStart={handleKarteDockResizeStart}
            >
              <div className="karteDockHeaderTitle">カルテ</div>
              <div className="karteDockHeaderActions">
                <button
                  type="button"
                  className="karteDockSaveBtn"
                  onClick={handleSaveKarte}
                  disabled={isSavingKarte || !selectedAppt?.store_id}
                  aria-label="カルテを保存"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  {isSavingKarte ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  className="karteDockCloseBtn"
                  onClick={handleCloseKarteDock}
                  aria-label="カルテを閉じる"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  ×
                </button>
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
                    const storeId = selectedAppt?.store_id;
                    const store = storeId ? selectedStore : null;
                    const client = store?.client_id ? clients.find((c) => String(c.id) === String(store.client_id)) : null;
                    const brand = store?.brand_id ? brands.find((b) => String(b.id) === String(store.brand_id)) : null;
                    const brandName = brand?.name || store?.brand_name || '';
                    const storeName = store?.name || store?.store_name || '';
                    const clientName = client?.name || client?.client_name || store?.client_name || '';
                    const phone = store?.phone || store?.tel || store?.phone_number || client?.phone || client?.tel || client?.phone_number || '';
                    
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
                  {(() => {
                    const storeId = selectedAppt?.store_id;
                    const store = storeId ? selectedStore : null;
                    const salesPerson = store?.sales_person || store?.sales_person_name || store?.salesPerson || '';
                    
                    return (
                      <>
                        {salesPerson && (
                          <>
                            <div className="kdSectionTitle">営業担当</div>
                            <div className="kdInfoRow">
                              <span>{salesPerson}</span>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                  <div className="kdSectionTitle">事前連絡</div>
                  <div className="kdContactReminders">
                    {['7日前', '3日前', '1日前'].map((reminder) => {
                      const isChecked = (selectedAppt.contact_reminders || []).includes(reminder);
                      return (
                        <label key={reminder} className="kdReminderCheckbox">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentReminders = selectedAppt.contact_reminders || [];
                              const newReminders = e.target.checked
                                ? [...currentReminders, reminder]
                                : currentReminders.filter((r) => r !== reminder);
                              setAppointments((prev) =>
                                prev.map((a) =>
                                  a.id === selectedAppt.id
                                    ? { ...a, contact_reminders: newReminders }
                                    : a
                                )
                              );
                              setSelectedAppt((prev) => (prev ? { ...prev, contact_reminders: newReminders } : null));
                            }}
                          />
                          <span>{reminder}</span>
                        </label>
                      );
                    })}
                  </div>
                  {(() => {
                    const cleanerId = selectedAppt?.cleaner_id;
                    const cleaner = cleanerId ? cleanersWithUnit.find((c) => String(c.id) === String(cleanerId)) : null;
                    const cleanerName = cleaner?.name || cleaner?.cleaner_name || '';
                    
                    return (
                      <>
                        {cleanerName && (
                          <>
                            <div className="kdSectionTitle">清掃担当</div>
                            <div className="kdInfoRow">
                              <span>{cleanerName}</span>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                  {(() => {
                    const storeId = selectedAppt?.store_id;
                    const store = storeId ? selectedStore : null;
                    const plan = store?.plan || store?.plan_name || '';
                    const securityBox = store?.security_box || store?.security_box_number || store?.box_number || '';
                    
                    return (
                      <>
                        {plan && (
                          <>
                            <div className="kdSectionTitle">プラン</div>
                            <div className="kdInfoRow">
                              <span>{plan}</span>
                            </div>
                          </>
                        )}
                        {securityBox && (
                          <>
                            <div className="kdSectionTitle">セキュリティボックス番号</div>
                            <div className="kdInfoRow">
                              <span>{securityBox}</span>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="karteDockRight">
                <div className="kdRightTop">
                  <div className="kdSectionTitle">担当</div>
                  <div className="kdMemberList">
                    {selectedAppt.cleaner_id && (
                      <span className="kdChip">
                        {cleanersWithUnit.find((c) => c.id === selectedAppt.cleaner_id)?.name ?? selectedAppt.cleaner_id}
                      </span>
                    )}
                  </div>
                </div>
                {(() => {
                  const storeId = selectedAppt?.store_id;
                  if (storeId && selectedStore) {
                    return (
                      <OfficeClientKartePanel
                        ref={kartePanelRef}
                        storeId={storeId}
                        store={selectedStore}
                        brands={brands}
                        clients={clients}
                        getBrandName={(store) => {
                          const brand = brands.find((b) => String(b.id) === String(store.brand_id));
                          return brand?.name || store.brand_name || '';
                        }}
                        getClientName={(store) => {
                          const client = clients.find((c) => String(c.id) === String(store.client_id));
                          return client?.name || client?.client_name || store.client_name || '';
                        }}
                        isLocked={false}
                      />
                    );
                  } else if (storeId) {
                    return <div className="kdEmpty">店舗情報を読み込み中...</div>;
                  } else {
                    return <div className="kdEmpty">店舗が選択されていません。案件作成時に店舗を選択してください。</div>;
                  }
                })()}
              </div>
            </div>
          </section>
        )}

        <MisogiSupportWidget
          selectedSchedule={selectedAppt}
          rollingDays={rollingDays}
          visibleSchedules={weekFilteredAppointments}
          conflictIds={conflictIds}
          apiBase={API_BASE}
          onOpenChange={setIsMisogiOpen}
        />

        {modal.open && modal.appt && (
          <AppointmentModal
            cleaners={cleanersWithUnit}
            appt={modal.appt}
            mode={modal.mode}
            onClose={closeModal}
            onSave={saveModal}
            onDelete={deleteAppt}
            conflictIds={conflictIds}
            saveConflictError={saveConflictError}
            clients={clients}
            stores={stores}
            brands={brands}
            onClientChange={async (clientId) => {
              if (!clientId) {
                setStores([]);
                return;
              }
              try {
                const response = await fetch(`${API_BASE}/clients/${clientId}/stores`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token)}`,
                  },
                });
                if (response.ok) {
                  const data = await response.json();
                  setStores(data.stores || []);
                }
              } catch (error) {
                console.error('[AdminScheduleTimelinePage] Failed to fetch stores:', error);
              }
            }}
            apiBase={API_BASE}
          />
        )}

        {blockModalOpen && (
          <BlockCreateModal
            open={blockModalOpen}
            onClose={closeBlockModal}
            onCreate={createBlock}
            cleaners={cleanersWithUnit}
            dateISO={dateISO}
            initialUserId={blockModalUserId}
            initialStartAt={blockModalInitialStartAt}
            initialEndAt={blockModalInitialEndAt}
          />
        )}

        {icsImportModal.open && (
          <IcsImportModal
            apiBase={API_BASE}
            onClose={() => setIcsImportModal({ open: false })}
            onSuccess={async () => {
              setIcsImportModal({ open: false });
              // バックエンドAPIからスケジュールを再読み込み
              try {
                await loadSchedulesFromAPI(dateISO);
                alert('Googleカレンダーの取り込みが完了しました。\n画面に反映されました。');
              } catch (err) {
                console.error('[AdminScheduleTimeline] Failed to reload schedules after ICS import', err);
                alert('Googleカレンダーの取り込みが完了しました。\n画面の更新に失敗しました。ページをリロードしてください。');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/** MISOGIサポートシステム（仮） - Draggable overlay with Visualizer */
function MisogiSupportWidget({ selectedSchedule, rollingDays, visibleSchedules, conflictIds, apiBase, onOpenChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [vizState, setVizState] = useState('normal'); // normal / warning / danger
  const overlayRef = React.useRef(null);
  const headerRef = React.useRef(null);

  const getToken = () => {
    return localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
  };


  const handleStartDrag = (e) => {
    if (e.target.closest('.misogi-close-btn') || e.target.closest('.misogi-input-area')) return;
    setDragging(true);
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (rect && clientX !== undefined && clientY !== undefined) {
      setDragStart({
        x: clientX - rect.left,
        y: clientY - rect.top
      });
    }
  };

  useEffect(() => {
    if (!dragging) return;
    
    const handleMove = (e) => {
      if (!dragging) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX !== undefined && clientY !== undefined) {
        setPos({
          x: clientX - dragStart.x,
          y: clientY - dragStart.y
        });
      }
    };
    
    const handleEnd = () => {
      setDragging(false);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [dragging, dragStart]);

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage = inputText.trim();
    setInputText('');
    setLoading(true);

    // ユーザーメッセージを表示（1往復だけ保持するため、既存のメッセージはクリア）
    setMessages([{ role: 'user', text: userMessage }]);

    try {
      const selectedScheduleData = selectedSchedule ? {
        id: selectedSchedule.id,
        schedule_id: selectedSchedule.schedule_id,
        date: selectedSchedule.date,
        target_name: selectedSchedule.target_name,
        cleaner_id: selectedSchedule.cleaner_id,
        start_min: selectedSchedule.start_min,
        end_min: selectedSchedule.end_min,
        work_type: selectedSchedule.work_type,
        status: selectedSchedule.status
      } : null;

      const visibleSchedulesData = visibleSchedules.map(a => ({
        id: a.id,
        schedule_id: a.schedule_id,
        date: a.date,
        target_name: a.target_name,
        cleaner_id: a.cleaner_id,
        start_min: a.start_min,
        end_min: a.end_min,
        work_type: a.work_type,
        status: a.status,
        conflict: conflictIds.has(a.id)
      }));

      const token = getToken();
      if (!token) {
        throw new Error('認証トークンが取得できませんでした');
      }

      const response = await fetch(`${apiBase}/ai/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'schedule_assistant',
          text: userMessage,
          selectedSchedule: selectedScheduleData,
          rollingDays: rollingDays,
          visibleSchedules: visibleSchedulesData
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result || {};

      // 状態判定
      let newVizState = 'normal';
      if (result.overlaps && Array.isArray(result.overlaps) && result.overlaps.length >= 2) {
        newVizState = 'danger';
      } else if (result.overlaps && (Array.isArray(result.overlaps) ? result.overlaps.length >= 1 : result.overlaps !== 'なし')) {
        newVizState = 'warning';
      }
      if (result.congestion && result.congestion !== 'なし' && result.congestion.includes('high')) {
        newVizState = 'danger';
      }
      setVizState(newVizState);

      // AI返答を整形
      let aiMessage = result.message || result.notes_summary || '承知いたしました。';
      if (result.overlaps && result.overlaps !== 'なし' && !Array.isArray(result.overlaps)) {
        aiMessage += `\n\n重複: ${result.overlaps}`;
      }
      if (result.congestion && result.congestion !== 'なし') {
        aiMessage += `\n\n過密: ${result.congestion}`;
      }
      if (result.contact_deadline && result.contact_deadline !== 'なし') {
        aiMessage += `\n\n事前連絡期限: ${result.contact_deadline}`;
      }

      // 1往復だけ保持（最新のユーザーメッセージとAI返答のみ）
      setMessages([{ role: 'user', text: userMessage }, { role: 'ai', text: aiMessage, raw: result }]);
    } catch (error) {
      console.error('[MisogiSupportWidget] Error:', error);
      // 1往復だけ保持（最新のユーザーメッセージとエラーメッセージのみ）
      setMessages([{ role: 'user', text: userMessage }, { role: 'ai', text: '申し訳ございません。接続に失敗いたしました。', error: true }]);
      setVizState('normal');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* 常設ボタン */}
      <button
        type="button"
        className="misogi-support-btn"
        onClick={() => {
          setIsOpen(true);
          onOpenChange?.(true);
        }}
        style={{ display: isOpen ? 'none' : 'block' }}
      >
        MISOGIサポートシステム（仮）
      </button>

      {/* Draggable Overlay */}
      {isOpen && (
        <div
          ref={overlayRef}
          className={`misogi-overlay status-${vizState}`}
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            cursor: dragging ? 'grabbing' : 'grab'
          }}
        >
          <div
            ref={headerRef}
            className="misogi-header"
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
          >
            <button
              type="button"
              className="misogi-close-btn"
              onClick={() => {
                setIsOpen(false);
                onOpenChange?.(false);
              }}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>

          <div
            className="misogi-visualizer-container"
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          >
            <Visualizer mode="base" className="misogi-visualizer" />
          </div>

          {/* MISOGIのコメント（ビジュアライザーの真下、中央寄せ） */}
          <div className="misogi-ai-message-container">
            {messages.length === 0 ? (
              <div className="misogi-message ai">
                <div className="misogi-bubble">
                  静かに見守っています...
                </div>
              </div>
            ) : (
              messages.filter(msg => msg.role === 'ai').map((msg, idx) => (
                <div key={idx} className="misogi-message ai">
                  <div className={`misogi-bubble ${msg.error ? 'error' : ''}`}>
                    {msg.text.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < msg.text.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="misogi-message ai">
                <div className="misogi-bubble loading">
                  考えています...
                </div>
              </div>
            )}
          </div>

          {/* ユーザーのコメント（MISOGIコメントの下、中央寄せ） */}
          <div className="misogi-user-message-container">
            {messages.filter(msg => msg.role === 'user').map((msg, idx) => (
              <div key={idx} className="misogi-message user">
                <div className="misogi-bubble">
                  {msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < msg.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="misogi-input-area">
            <input
              type="text"
              className="misogi-input"
              placeholder="メッセージを入力..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              type="button"
              className="misogi-send-btn"
              onClick={sendMessage}
              disabled={!inputText.trim() || loading}
            >
              送信
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** GoogleカレンダーICS取り込みモーダル */
function IcsImportModal({ apiBase, onClose, onSuccess }) {
  const [icsUrl, setIcsUrl] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [toDate, setToDate] = useState(() => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 90);
    return `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  });
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const getToken = () => {
    return localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
  };

  const handleImport = async (isDryRun) => {
    if (!icsUrl.trim()) {
      setError('ICS URLを入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('認証トークンが取得できませんでした');
      }

      const response = await fetch(`${apiBase}/admin/import/google-ics`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ics_url: icsUrl.trim(),
          from: fromDate,
          to: toDate,
          dry_run: isDryRun
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || '取り込みに失敗しました');
      }

      setResult(data);
      if (!isDryRun && data.success) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error('[IcsImportModal] Error:', err);
      setError(err.message || '取り込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modalBackdrop" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: '600px' }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Googleカレンダー取り込み</div>
            <div className="muted">ICS形式のカレンダーURLからスケジュールを取り込みます</div>
          </div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modalBody">
          {error && (
            <div className="modalConflictError" role="alert" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}
          {result && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px' }}>
              {result.dry_run ? (
                <>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>プレビュー結果</div>
                  <div>見つかったイベント: {result.found}件</div>
                  <div>期間: {result.range?.from} 〜 {result.range?.to}</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>取り込み完了</div>
                  <div>追加: {result.inserted}件</div>
                  <div>スキップ（重複）: {result.skipped}件</div>
                  {result.errors && result.errors.length > 0 && (
                    <div style={{ marginTop: '8px', color: 'rgba(255, 120, 120, 0.9)' }}>
                      エラー: {result.errors.length}件
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="formGrid">
            <label className="field span2">
              <span>ICS URL（Googleカレンダーの「秘密のアドレス」）</span>
              <input
                type="text"
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/..."
                disabled={loading}
              />
            </label>
            <label className="field">
              <span>開始日</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={loading}
              />
            </label>
            <label className="field">
              <span>終了日</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={loading}
              />
            </label>
            <label className="field span2">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={loading}
              />
              <span style={{ marginLeft: '8px' }}>プレビュー（dry_run）</span>
            </label>
          </div>
        </div>
        <div className="modalFooter">
          <div className="left">
            <button type="button" className="btn" onClick={onClose} disabled={loading}>
              閉じる
            </button>
          </div>
          <div className="right">
            {dryRun ? (
              <button
                type="button"
                className="btnPrimary"
                onClick={() => handleImport(true)}
                disabled={loading || !icsUrl.trim()}
              >
                {loading ? '処理中...' : 'プレビュー'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setDryRun(true)}
                  disabled={loading}
                >
                  プレビューに戻る
                </button>
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={() => handleImport(false)}
                  disabled={loading || !icsUrl.trim()}
                >
                  {loading ? '取り込み中...' : '取り込み実行'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayTimelinePC({ dateISO, cleaners, timelineUnitColumns, appointments, blocks, conflictIds, activeScheduleId, onCardClick, onBackgroundClick, onCreate, onOpenBlockModalWithSlot, stores = [], clients = [], brands = [] }) {
  // ゴールデンタイム主体：21:00〜翌10:00（13時間）のみ表示
  const NIGHT_START = 21 * 60;  // 21:00
  const NIGHT_END = 10 * 60;    // 10:00（翌日）
  const dayStart = NIGHT_START;  // 21:00スタート
  const dayEnd = NIGHT_END + 24 * 60; // 翌10:00（1440分後）
  const step = 60;              // 1時間間隔
  const rows = [];
  // 21:00, 22:00, 23:00, 0:00, 1:00, ..., 9:00, 10:00 を生成（13時間）
  for (let t = dayStart; t <= dayEnd; t += step) {
    const displayMin = t % (24 * 60); // 24時間表記に変換
    rows.push(displayMin);
  }

  const { cleaning: cleaningCols, maintenance: maintenanceCols } = timelineUnitColumns ?? { cleaning: cleaners.filter((c) => c.unit === 'cleaning'), maintenance: cleaners.filter((c) => c.unit === 'maintenance') };

  // 昼イベントと夜イベントを分離
  const { daytimeEvents, nighttimeAppointments, nighttimeBlocks } = useMemo(() => {
    const daytime = [];
    const nightAppts = [];
    const nightBlocks = [];

    // 案件を昼/夜に分類
    for (const a of appointments) {
      if (isDaytimeEvent(a.start_min, a.end_min)) {
        daytime.push(a);
      } else {
        nightAppts.push(a);
      }
    }

    // ブロックを昼/夜に分類
    for (const b of blocks ?? []) {
      const display = blockDisplayForDay(b, dateISO);
      if (!display) continue;
      if (isDaytimeEvent(display.start_min, display.end_min)) {
        // 昼イベントとして扱う（必要に応じて）
      } else {
        nightBlocks.push({ block: b, start_min: display.start_min, end_min: display.end_min });
      }
    }

    return {
      daytimeEvents: daytime,
      nighttimeAppointments: nightAppts,
      nighttimeBlocks: nightBlocks
    };
  }, [appointments, blocks, dateISO]);

  const byCleanerItems = useMemo(() => {
    const map = new Map();
    for (const d of cleaners) map.set(d.id, []);
    // 夜イベントのみを追加
    for (const a of nighttimeAppointments) {
      map.get(a.cleaner_id)?.push({ type: 'appointment', data: a, start_min: a.start_min, end_min: a.end_min });
    }
    for (const b of nighttimeBlocks) {
      if (b.block.user_id == null) {
        for (const d of cleaners) map.get(d.id)?.push({ type: 'block', block: b.block, start_min: b.start_min, end_min: b.end_min });
      } else {
        const list = map.get(b.block.user_id);
        if (list) list.push({ type: 'block', block: b.block, start_min: b.start_min, end_min: b.end_min });
      }
    }
    for (const [, list] of map.entries()) {
      list.sort((x, y) => x.start_min - y.start_min);
    }
    return map;
  }, [cleaners, nighttimeAppointments, nighttimeBlocks]);

  // 全清掃員を縦に並べる（梅岡ユニット → 遠藤ユニットの順）
  const allCleaners = [...cleaningCols, ...maintenanceCols];
  const allCleanerRows = useMemo(() => {
    return allCleaners.map((c) => ({
      cleaner: c,
      unit: getUnitFromName(c.name),
      items: byCleanerItems.get(c.id) ?? []
    }));
  }, [allCleaners, byCleanerItems]);

  return (
    <section className="timelinePC timelinePCHorizontal">
      <div className="timelinePCContainerHorizontal">
        {/* 左側：名簿（縦並び） */}
        <div className="timelineNameListContainer">
          {/* 昼イベントタグ列がある場合、名簿側にもスペーサーを追加 */}
          {daytimeEvents.length > 0 && (
            <div className="timelineNameListSpacer" style={{ height: '44px' }} />
          )}
          <div className="timelineNameListHeader">
            <div className="nameListHeaderCell">名簿</div>
          </div>
          <div className="timelineNameListBody">
            {allCleanerRows.map((row) => (
              <div key={row.cleaner.id} className={`nameListCell unit-${row.unit}`}>
                <span className="name">{row.cleaner.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右側：時間軸（横）とタイムライン本体 */}
        <div className="timelineTimeAreaContainer">
          {/* 昼イベントタグ列（タイムライン最上段） */}
          {daytimeEvents.length > 0 && (
            <div className="daytimeEventRow">
              <div className="daytimeEventRowInner">
                {daytimeEvents.map((appt) => {
                  const meta = statusMeta(appt.status);
                  const conflict = conflictIds.has(appt.id);
                  // 店舗情報を取得
                  const store = appt.store_id ? stores.find((s) => String(s.id) === String(appt.store_id)) : null;
                  const client = appt.client_id ? clients.find((c) => String(c.id) === String(appt.client_id)) : null;
                  const brand = store?.brand_id ? brands.find((b) => String(b.id) === String(store.brand_id)) : null;
                  
                  // ブランド名、店舗名を取得
                  const brandName = brand?.name || store?.brand_name || '';
                  const storeName = store?.name || store?.store_name || appt.target_name || '';
                  
                  // 事前連絡タグを生成（チェックされているものだけ表示）
                  const reminders = appt.contact_reminders || [];
                  const reminderTags = [];
                  if (reminders.includes('7日前')) reminderTags.push('7◯');
                  if (reminders.includes('3日前')) reminderTags.push('3◯');
                  if (reminders.includes('1日前')) reminderTags.push('1◯');
                  const reminderDisplay = reminderTags.length > 0 ? reminderTags.join(' ') : '';
                  
                  return (
                    <button
                      key={appt.id}
                      type="button"
                      className={`daytimeChip ${meta.colorClass} ${conflict ? 'conflict' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onCardClick(appt); }}
                      title={`${minutesToHHMM(appt.start_min)}-${minutesToHHMM(appt.end_min)} ${appt.target_name}`}
                    >
                      <span className="daytimeChipIcon">☀</span>
                      {brandName && <span className="daytimeChipBrand">{brandName}</span>}
                      {brandName && storeName && <span>/</span>}
                      {storeName && <span className="daytimeChipStore">{storeName}</span>}
                      {(brandName || storeName) && <span>/</span>}
                      <span className="daytimeChipTime">{minutesToHHMM(appt.start_min)}-{minutesToHHMM(appt.end_min)}</span>
                      {reminderDisplay && (
                        <>
                          <span>/</span>
                          <span className="daytimeChipReminders">{reminderDisplay}</span>
                        </>
                      )}
                      {appt.work_type === '夜間' && <span className="daytimeChipNightIcon">🌙</span>}
                      <span className="daytimeChipStatus">({meta.label})</span>
                      {conflict && <span className="daytimeChipWarn">⚠</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 時間ヘッダー（上部、横並び） */}
          <div className="timelineTimeHeaderHorizontal">
            {rows.map((t) => (
              <div key={t} className="timeHeaderCell">{minutesToHHMM(t)}</div>
            ))}
          </div>

          {/* タイムライン本体（横スクロール可能） */}
          <div className="timelineTimeBodyContainer" onClick={onBackgroundClick} role="presentation">
            {allCleanerRows.map((row) => (
              <CleanerRow
                key={row.cleaner.id}
                cleaner={row.cleaner}
                rows={rows}
                dayStart={dayStart}
                dayEnd={dayEnd}
                items={row.items}
                conflictIds={conflictIds}
                activeScheduleId={activeScheduleId}
                onCardClick={onCardClick}
                onSlotClick={(cleanerId, startMin) => { onCreate(cleanerId, startMin); }}
                onSlotRightClick={onOpenBlockModalWithSlot}
                stores={stores}
                clients={clients}
                brands={brands}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="legend">
        <span className="legendTitle">凡例:</span>
        {STATUSES.map((s) => (
          <span key={s.key} className={`legendItem ${s.colorClass}`}>{s.label}</span>
        ))}
        <span className="legendItem s-conflict">重複⚠</span>
        <span className="legendItem blockCard">🔒 クローズ</span>
        <span className="legendItem unit-cleaning-legend">清掃</span>
        <span className="legendItem unit-maintenance-legend">メンテナンス</span>
      </div>
    </section>
  );
}

function CleanerRow({ cleaner, rows, dayStart, dayEnd, items, conflictIds, activeScheduleId, onCardClick, onSlotClick, onSlotRightClick, stores = [], clients = [], brands = [] }) {
  const NIGHT_START = 21 * 60; // 21:00
  const NIGHT_DURATION = 13 * 60; // 13時間（21:00〜翌10:00）
  const rowRef = React.useRef(null);
  const [rowWidth, setRowWidth] = React.useState(0);

  // 親要素の幅を取得してpxPerMinを計算
  React.useEffect(() => {
    const updateWidth = () => {
      if (rowRef.current) {
        const width = rowRef.current.offsetWidth;
        setRowWidth(width);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const pxPerMin = rowWidth > 0 ? rowWidth / NIGHT_DURATION : 0;

  return (
    <div className="cleanerRow" ref={rowRef}>
      <div className="cleanerRowGrid">
        {rows.map((t) => {
          // 表示上の時間tを実際の時間（分）に変換（21:00基準のoffsetMinから元の時間に戻す）
          const actualMin = (t < NIGHT_START) ? (t + 24 * 60) : t;
          return (
            <button
              key={t}
              type="button"
              className="slotCellHorizontal"
              onClick={(e) => { e.stopPropagation(); onSlotClick?.(cleaner.id, actualMin); }}
              onContextMenu={(e) => { e.preventDefault(); onSlotRightClick?.(cleaner.id, actualMin); }}
              aria-label={`${minutesToHHMM(t)}に割当追加。右クリックでクローズ追加`}
            />
          );
        })}
      </div>
      {rowWidth > 0 && (
        <div className="cleanerRowOverlay" style={{ width: rowWidth }}>
          {items.map((item) => {
            if (item.type === 'block') {
              const { block, start_min, end_min } = item;
              // offsetMinベースで位置計算（21:00を0分とする）
              const startOffset = toOffsetMin(start_min);
              const endOffset = toOffsetMin(end_min);
              const left = startOffset * pxPerMin;
              const width = Math.max(60, (endOffset - startOffset) * pxPerMin);
              return (
                <div
                  key={block.id}
                  className="apptCard scheduleCard blockCard"
                  style={{ left, width }}
                  title={`🔒 クローズ ${minutesToHHMM(start_min)}–${minutesToHHMM(end_min)}`}
                >
                  <div className="apptTop">
                    <span className="apptTime">{minutesToHHMM(start_min)}–{minutesToHHMM(end_min)}</span>
                  </div>
                  <div className="apptName">🔒 クローズ</div>
                  <div className="apptMeta">{block.reason_code === 'sleep' ? '睡眠' : block.reason_code === 'move' ? '移動' : block.reason_code === 'private' ? '私用' : 'その他'}</div>
                </div>
              );
            }
            // item.type === 'appointment'
            const a = item.data;
            // offsetMinベースで位置計算（21:00を0分とする）
            const startOffset = toOffsetMin(a.start_min);
            const endOffset = toOffsetMin(a.end_min);
            const left = startOffset * pxPerMin;
            const width = Math.max(60, (endOffset - startOffset) * pxPerMin);
            const meta = statusMeta(a.status);
            const conflict = conflictIds.has(a.id);
            const isLinked = activeScheduleId != null && a.schedule_id === activeScheduleId;
            
            // 店舗情報を取得
            const store = a.store_id ? stores.find((s) => String(s.id) === String(a.store_id)) : null;
            const client = a.client_id ? clients.find((c) => String(c.id) === String(a.client_id)) : null;
            const brand = store?.brand_id ? brands.find((b) => String(b.id) === String(store.brand_id)) : null;
            
            // ブランド名、店舗名を取得
            const brandName = brand?.name || store?.brand_name || '';
            const storeName = store?.name || store?.store_name || a.target_name || '';
            
            // 事前連絡タグを生成（チェックされているものだけ表示）
            const reminders = a.contact_reminders || [];
            const reminderTags = [];
            if (reminders.includes('7日前')) reminderTags.push('7◯');
            if (reminders.includes('3日前')) reminderTags.push('3◯');
            if (reminders.includes('1日前')) reminderTags.push('1◯');
            const reminderDisplay = reminderTags.length > 0 ? reminderTags.join(' ') : '';
            
            return (
              <button
                key={a.id}
                type="button"
                className={`apptCard scheduleCard ${meta.colorClass} ${conflict ? 'conflict' : ''} ${isLinked ? 'is-linked' : ''}`}
                style={{ left, width }}
                onClick={(e) => { e.stopPropagation(); onCardClick(a); }}
                title={`${minutesToHHMM(a.start_min)}-${minutesToHHMM(a.end_min)} ${a.target_name}`}
              >
                <div className="apptContent">
                  <div className="apptSingleLine">
                    {brandName && <span className="apptBrand">{brandName}</span>}
                    {brandName && storeName && <span className="apptSeparator">/</span>}
                    {storeName && <span className="apptStore">{storeName}</span>}
                    {(brandName || storeName) && <span className="apptSeparator">/</span>}
                    <span className="apptTime">{minutesToHHMM(a.start_min)}–{minutesToHHMM(a.end_min)}</span>
                    {reminderDisplay && (
                      <>
                        <span className="apptSeparator">/</span>
                        <span className="apptReminders">{reminderDisplay}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DayTimelineSP({ dateISO, cleaners, activeCleanerId, setActiveCleanerId, appointments, blocks, conflictIds, activeScheduleId, onCardClick, onCreate, onOpenBlockModalWithSlot, stores = [], clients = [], brands = [] }) {
  const dayStart = 0;           // 0:00スタート
  const dayEnd = 24 * 60;       // 24:00まで（24時間表記）
  const step = 60;              // 1時間間隔
  const rows = [];
  for (let t = dayStart; t <= dayEnd; t += step) rows.push(t);

  const items = useMemo(() => {
    const list = [];
    for (const a of appointments.filter((x) => x.cleaner_id === activeCleanerId)) {
      list.push({ type: 'appointment', data: a, start_min: a.start_min, end_min: a.end_min });
    }
    for (const b of blocks ?? []) {
      if (b.user_id !== activeCleanerId && b.user_id != null) continue;
      const display = blockDisplayForDay(b, dateISO);
      if (display) list.push({ type: 'block', block: b, start_min: display.start_min, end_min: display.end_min });
    }
    list.sort((x, y) => x.start_min - y.start_min);
    return list;
  }, [appointments, blocks, activeCleanerId, dateISO]);

  const slots = useMemo(() => {
    const byStart = new Map();
    for (const item of items) byStart.set(item.start_min, (byStart.get(item.start_min) ?? []).concat(item));
    return rows.map((t) => ({ t, items: byStart.get(t) ?? [] }));
  }, [items, rows]);

  return (
    <section className="timelineSP">
      <div className="doctorTabs">
        {cleaners.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`tab ${d.id === activeCleanerId ? 'active' : ''}`}
            onClick={() => setActiveCleanerId(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>
      <div className="spList">
        <div className="spHint">
          <span className="muted">{isoToDateLabel(dateISO)}</span>
          <span className="muted"> / {cleaners.find((d) => d.id === activeCleanerId)?.name}</span>
        </div>
        {slots.map((s) => (
          <div key={s.t} className="spSlot">
            <div className="spTime">{minutesToHHMM(s.t)}</div>
            <div className="spSlotBody">
              {s.items.length === 0 ? (
                <button
                  type="button"
                  className="spEmpty"
                  onClick={() => onCreate(activeCleanerId, s.t)}
                  onContextMenu={(e) => { e.preventDefault(); onOpenBlockModalWithSlot?.(activeCleanerId, s.t); }}
                >
                  空き（タップで割当追加・長押しメニューでクローズ追加）
                </button>
              ) : (
                s.items.map((item) => {
                  if (item.type === 'block') {
                    const { block, start_min, end_min } = item;
                    return (
                      <div key={block.id} className="spAppt scheduleCard blockCard">
                        <div className="spApptRow">
                          <div className="spApptMain">
                            <div className="spApptName">🔒 クローズ</div>
                            <div className="spApptMeta">{block.reason_code === 'sleep' ? '睡眠' : block.reason_code === 'move' ? '移動' : block.reason_code === 'private' ? '私用' : 'その他'}</div>
                          </div>
                          <div className="spApptTime">{minutesToHHMM(start_min)}–{minutesToHHMM(end_min)}</div>
                        </div>
                      </div>
                    );
                  }
                  const a = item.data;
                  const meta = statusMeta(a.status);
                  const conflict = conflictIds.has(a.id);
                  const isLinked = activeScheduleId != null && a.schedule_id === activeScheduleId;
                  
                  // 店舗情報を取得
                  const store = a.store_id ? stores.find((s) => String(s.id) === String(a.store_id)) : null;
                  const client = a.client_id ? clients.find((c) => String(c.id) === String(a.client_id)) : null;
                  const brand = store?.brand_id ? brands.find((b) => String(b.id) === String(store.brand_id)) : null;
                  
                  // ブランド名、店舗名を取得
                  const brandName = brand?.name || store?.brand_name || '';
                  const storeName = store?.name || store?.store_name || a.target_name || '';
                  
                  // 事前連絡タグを生成（チェックされているものだけ表示）
                  const reminders = a.contact_reminders || [];
                  const reminderTags = [];
                  if (reminders.includes('7日前')) reminderTags.push('7◯');
                  if (reminders.includes('3日前')) reminderTags.push('3◯');
                  if (reminders.includes('1日前')) reminderTags.push('1◯');
                  const reminderDisplay = reminderTags.length > 0 ? reminderTags.join(' ') : '';
                  
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`spAppt scheduleCard ${meta.colorClass} ${conflict ? 'conflict' : ''} ${isLinked ? 'is-linked' : ''}`}
                      onClick={() => onCardClick(a)}
                    >
                      <div className="spApptSingleLine">
                        {brandName && <span className="spApptBrand">{brandName}</span>}
                        {brandName && storeName && <span>/</span>}
                        {storeName && <span className="spApptStore">{storeName}</span>}
                        {(brandName || storeName) && <span>/</span>}
                        <span className="spApptTime">{minutesToHHMM(a.start_min)}–{minutesToHHMM(a.end_min)}</span>
                        {reminderDisplay && (
                          <>
                            <span>/</span>
                            <span className="spApptReminders">{reminderDisplay}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DayList({ dateISO, cleaners, appointments, conflictIds, onCardClick, onCreate }) {
  const sorted = useMemo(() => [...appointments].sort((a, b) => a.start_min - b.start_min), [appointments]);

  return (
    <section className="listView">
      <div className="listHeader">
        <div className="listTitle">一覧（{isoToDateLabel(dateISO)}）</div>
        <button type="button" className="btnPrimary" onClick={() => onCreate()}>＋ 割当追加</button>
      </div>
      <div className="table">
        <div className="row head">
          <div>時間</div>
          <div>現場</div>
          <div>清掃員</div>
          <div>種別</div>
          <div>状態</div>
          <div>注意</div>
        </div>
        {sorted.map((a) => {
          const d = cleaners.find((x) => x.id === a.cleaner_id);
          const meta = statusMeta(a.status);
          const conflict = conflictIds.has(a.id);
          return (
            <button key={a.id} type="button" className="row body" onClick={() => onCardClick?.(a)}>
              <div>{minutesToHHMM(a.start_min)}–{minutesToHHMM(a.end_min)}</div>
              <div className="strong">{a.target_name}</div>
              <div>{d?.name ?? '-'}</div>
              <div>{a.work_type}</div>
              <div><span className={`badge ${meta.colorClass}`}>{meta.label}</span></div>
              <div>{conflict ? <span className="warn">重複⚠</span> : '-'}</div>
            </button>
          );
        })}
        {sorted.length === 0 && <div className="empty">該当する割当がありません</div>}
      </div>
    </section>
  );
}

function WeekView({ dateISO, setDateISO, rollingDays, cleaners, appointments, conflictIds, onCardClick, onCreate }) {
  const byDate = useMemo(() => {
    const map = new Map();
    for (const iso of rollingDays) map.set(iso, []);
    for (const a of appointments) map.get(a.date)?.push(a);
    for (const [, list] of map.entries()) {
      list.sort((x, y) => x.start_min - y.start_min);
    }
    return map;
  }, [rollingDays, appointments]);

  const weekDayNames = ['日', '月', '火', '水', '木', '金', '土'];

  function renderDayColumn(iso, isToday) {
    const dayAppts = byDate.get(iso) ?? [];
    const isActive = iso === dateISO;
    return (
      <div key={iso} className={`weekCol ${isActive ? 'active' : ''} ${isToday ? 'todayCol' : ''}`}>
        <button
          type="button"
          className="weekColHead"
          onClick={() => setDateISO(iso)}
          aria-pressed={isActive}
        >
          {isToday && <div className="todayBadge">TODAY</div>}
          <span className="weekColDate">{isoToDateLabel(iso)}</span>
          <span className="weekColCount">{dayAppts.length}件</span>
        </button>
        <div className="weekColBody">
          {dayAppts.length === 0 ? (
            <div className="weekEmpty">割当なし</div>
          ) : (
            dayAppts.map((a) => {
              const meta = statusMeta(a.status);
              const conflict = conflictIds.has(a.id);
              const cleanerName = cleaners.find((d) => d.id === a.cleaner_id)?.name ?? '';
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`weekAppt ${meta.colorClass} ${conflict ? 'conflict' : ''}`}
                  onClick={() => onCardClick?.(a)}
                  title={`${a.target_name} ${cleanerName}`}
                >
                  <span className="weekApptTime">{minutesToHHMM(a.start_min)}</span>
                  <span className="weekApptName">{a.target_name}</span>
                  {conflict && <span className="warn">⚠</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="weekView">
      <div className="weekTitle">ローリング8日（今日＋7日）</div>
      <div className="rollingWeekGrid">
        <div className="todayColumn">
          {rollingDays[0] != null && renderDayColumn(rollingDays[0], true)}
        </div>
        <div className="futureColumns">
          {rollingDays.slice(1).map((d) => renderDayColumn(d, false))}
        </div>
      </div>
    </section>
  );
}

/** 事前連絡モード：上段（連絡用）。列ヘッダーは1週間前の日付、中身は1週間後の予定（実行週）。同一 schedule_id で下段と紐づきハイライト */
function ContactWeekPanel({
  columnLabelIsos,
  weekDayIsos,
  cleaners,
  appointments,
  conflictIds,
  selectedAppointmentId,
  onSelectCard,
  onSaveContact,
  onOpen,
  activeScheduleId,
}) {
  const byDate = useMemo(() => {
    const map = new Map();
    for (const iso of weekDayIsos) map.set(iso, []);
    for (const a of appointments) map.get(a.date)?.push(a);
    for (const [, list] of map.entries()) {
      list.sort((x, y) => x.start_min - y.start_min);
    }
    return map;
  }, [weekDayIsos, appointments]);

  return (
    <section className="contactWeekPanel">
      <div className="contactWeekPanelTitle">事前連絡（1週間前・連絡用／表示は1週間後の予定）</div>
      <div className="weekGrid">
        {weekDayIsos.map((iso, i) => {
          const dayAppts = byDate.get(iso) ?? [];
          const labelIso = columnLabelIsos[i] ?? iso;
          return (
            <div key={iso} className="weekCol">
              <div className="weekColHead static">
                <span className="weekColDate">{isoToDateLabel(labelIso)}</span>
                <span className="weekColCount">{dayAppts.length}件</span>
              </div>
              <div className="weekColBody">
                {dayAppts.length === 0 ? (
                  <div className="weekEmpty">割当なし</div>
                ) : (
                  dayAppts.map((a) => (
                    <ContactCard
                      key={a.id}
                      appt={a}
                      cleaners={cleanersWithUnit}
                      conflictIds={conflictIds}
                      isSelected={selectedAppointmentId === a.id}
                      isLinked={activeScheduleId != null && (a.schedule_id ?? a.id) === activeScheduleId}
                      onSelect={() => onSelectCard(a.id)}
                      onSaveContact={onSaveContact}
                      onOpen={onOpen}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ContactCard({ appt, cleaners, conflictIds, isSelected, isLinked, onSelect, onSaveContact, onOpen }) {
  const [localNote, setLocalNote] = useState(appt.contact_note ?? '');
  const [localStatus, setLocalStatus] = useState(appt.contact_status ?? 'pending');
  const contactMeta = contactStatusMeta(appt.contact_status ?? 'pending');
  const conflict = conflictIds.has(appt.id);
  const cleanerName = cleaners.find((d) => d.id === appt.cleaner_id)?.name ?? '';

  useEffect(() => {
    setLocalNote(appt.contact_note ?? '');
    setLocalStatus(appt.contact_status ?? 'pending');
  }, [appt.id, appt.contact_note, appt.contact_status]);

  function handleSave() {
    onSaveContact(appt.id, { contact_note: localNote.trim(), contact_status: localStatus });
  }

  return (
    <div
      className={`contactCard ${contactMeta.colorClass} ${isSelected ? 'selected' : ''} ${isLinked ? 'is-linked' : ''} ${conflict ? 'conflict' : ''}`}
      data-schedule-id={appt.id}
    >
      <button
        type="button"
        className="contactCardHeader"
        onClick={() => onSelect()}
        aria-pressed={isSelected}
      >
        <span className="contactCardTime">{minutesToHHMM(appt.start_min)}</span>
        <span className="contactCardName">{appt.target_name}</span>
        <span className="contactCardStatus">{contactStatusMeta(localStatus).label}</span>
        {conflict && <span className="warn">⚠</span>}
      </button>
      <div className="contactCardBody" onClick={(e) => e.stopPropagation()}>
        <textarea
          className="contactCardNote"
          placeholder="連絡メモ"
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={handleSave}
          rows={2}
        />
        <div className="contactCardActions">
          <select
            value={localStatus}
            onChange={(e) => {
              const v = e.target.value;
              setLocalStatus(v);
              onSaveContact(appt.id, { contact_status: v });
            }}
            className="contactStatusSelect"
          >
            {CONTACT_STATUSES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <button type="button" className="btn small" onClick={handleSave}>保存</button>
          <button type="button" className="btn small" onClick={() => onOpen(appt)}>詳細</button>
        </div>
      </div>
    </div>
  );
}

/** 事前連絡モード：下段（参照用）。上段で選択したカードを schedule_id で紐づきハイライト */
function CleaningWeekPanel({
  weekDayIsos,
  cleaners,
  appointments,
  conflictIds,
  selectedAppointmentId,
  activeScheduleId,
  onCardClick,
  onOpen,
}) {
  const byDate = useMemo(() => {
    const map = new Map();
    for (const iso of weekDayIsos) map.set(iso, []);
    for (const a of appointments) map.get(a.date)?.push(a);
    for (const [, list] of map.entries()) {
      list.sort((x, y) => x.start_min - y.start_min);
    }
    return map;
  }, [weekDayIsos, appointments]);

  return (
    <section className="cleaningWeekPanel">
      <div className="cleaningWeekPanelTitle">清掃週間（参照用）</div>
      <div className="weekGrid">
        {weekDayIsos.map((iso) => {
          const dayAppts = byDate.get(iso) ?? [];
          return (
            <div key={iso} className="weekCol">
              <div className="weekColHead static">
                <span className="weekColDate">{isoToDateLabel(iso)}</span>
                <span className="weekColCount">{dayAppts.length}件</span>
              </div>
              <div className="weekColBody">
                {dayAppts.length === 0 ? (
                  <div className="weekEmpty">割当なし</div>
                ) : (
                  dayAppts.map((a) => {
                    const meta = statusMeta(a.status);
                    const contactMeta = contactStatusMeta(a.contact_status ?? 'pending');
                    const conflict = conflictIds.has(a.id);
                    const isHighlight = selectedAppointmentId === a.id;
                    const isLinked = activeScheduleId != null && (a.schedule_id ?? a.id) === activeScheduleId;
                    const lastAt = formatContactLastAt(a.contact_last_at);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`weekAppt cleaningCard ${meta.colorClass} ${contactMeta.colorClass} ${isHighlight ? 'highlight' : ''} ${isLinked ? 'is-linked' : ''} ${conflict ? 'conflict' : ''}`}
                        onClick={() => (onCardClick ? onCardClick(a) : onOpen?.(a))}
                        data-schedule-id={a.schedule_id ?? a.id}
                      >
                        <span className="weekApptTime">{minutesToHHMM(a.start_min)}</span>
                        <span className="weekApptName">{a.target_name}</span>
                        {conflict && <span className="warn">⚠</span>}
                        {(a.contact_note || lastAt) && (
                          <div className="cleaningCardContact">
                            {a.contact_note && <span className="cleaningCardNote">{a.contact_note}</span>}
                            {lastAt && <span className="cleaningCardLastAt">{lastAt}</span>}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MonthSimple({ dateISO, setDateISO }) {
  const d = new Date(dateISO + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  function selectDay(day) {
    setDateISO(`${year}-${pad2(month + 1)}-${pad2(day)}`);
  }

  return (
    <section className="monthView">
      <div className="monthTitle">{year}/{month + 1}</div>
      <div className="monthGrid">
        {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
          <div key={w} className="monthHead">{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="monthCell blank" />;
          const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const isActive = iso === dateISO;
          return (
            <button key={idx} type="button" className={`monthCell ${isActive ? 'active' : ''}`} onClick={() => selectDay(day)}>
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const APPOINTMENT_MODAL_TABS = [
  { key: 'basic', label: '基本' },
  { key: 'memo', label: 'メモ' },
];

function AppointmentModal({ cleaners, appt, mode, onClose, onSave, onDelete, conflictIds, saveConflictError, clients = [], stores = [], brands = [], onClientChange, apiBase }) {
  const [local, setLocal] = useState(() => {
    const ensured = ensureContactFields(appt);
    // cleaner_idsが存在しない場合はcleaner_idから作成
    if (!ensured.cleaner_ids && ensured.cleaner_id) {
      ensured.cleaner_ids = [ensured.cleaner_id];
    }
    return ensured;
  });
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedClientId, setSelectedClientId] = useState(appt.client_id || '');
  const [selectedBrandId, setSelectedBrandId] = useState(appt.brand_id || '');
  const [localBrands, setLocalBrands] = useState([]);
  const [localStores, setLocalStores] = useState([]);
  const [unifiedSearchQuery, setUnifiedSearchQuery] = useState('');
  const conflict = conflictIds.has(appt.id);

  // 統合検索：法人名、ブランド名、店舗名を一度に検索
  const unifiedSearchResults = useMemo(() => {
    if (!unifiedSearchQuery || !unifiedSearchQuery.trim()) return [];
    if (!stores || stores.length === 0) return [];
    if (!clients || !brands) return [];
    
    const query = unifiedSearchQuery.toLowerCase().trim();
    if (!query) return [];
    
    const results = [];
    
    stores.forEach((store) => {
      if (!store) return;
      
      try {
        const storeName = (store.name || store.store_name || store.id || '').toLowerCase();
        const client = store.client_id ? (clients.find((c) => String(c.id) === String(store.client_id)) || null) : null;
        const clientName = (client?.name || client?.client_name || client?.company_name || '').toLowerCase();
        const brand = store.brand_id ? (brands.find((b) => String(b.id) === String(store.brand_id)) || null) : null;
        const brandName = (brand?.name || brand?.brand_name || '').toLowerCase();
        
        // 検索対象：店舗名、法人名、ブランド名、電話番号
        const phone = (store.phone || store.tel || store.phone_number || '').toLowerCase();
        const searchText = `${storeName} ${clientName} ${brandName} ${phone}`.trim();
        
        if (searchText && searchText.includes(query)) {
          results.push({
            store,
            client: client || null,
            brand: brand || null,
            displayText: `${brandName || '（ブランド不明）'} / ${storeName || store.id || '（店舗不明）'} / ${clientName || '（法人不明）'}`,
            searchText: searchText
          });
        }
      } catch (error) {
        console.warn('[AppointmentModal] Error processing store for search:', store, error);
      }
    });
    
    // 検索結果をソート（店舗名でソート）
    results.sort((a, b) => {
      const aName = (a.store?.name || a.store?.store_name || '').toLowerCase();
      const bName = (b.store?.name || b.store?.store_name || '').toLowerCase();
      return aName.localeCompare(bName);
    });
    
    return results;
  }, [unifiedSearchQuery, stores, clients, brands]);

  useEffect(() => {
    const ensured = ensureContactFields(appt);
    // cleaner_idsが存在しない場合はcleaner_idから作成
    if (!ensured.cleaner_ids && ensured.cleaner_id) {
      ensured.cleaner_ids = [ensured.cleaner_id];
    }
    setLocal(ensured);
    setSelectedBrandId(appt.brand_id || '');
    setSelectedClientId(appt.client_id || '');
  }, [appt]);

  // 法人選択時にブランドリストを更新
  useEffect(() => {
    if (selectedClientId) {
      // 選択された法人に紐づくブランドを取得
      const clientStores = stores.filter((s) => String(s.client_id) === String(selectedClientId));
      const clientBrandIds = new Set(clientStores.map((s) => s.brand_id).filter(Boolean));
      const clientBrands = brands.filter((b) => clientBrandIds.has(String(b.id)));
      setLocalBrands(clientBrands);
    } else {
      setLocalBrands([]);
      setSelectedBrandId('');
      setLocalStores([]);
    }
  }, [selectedClientId, stores, brands]);

  // ブランド選択時に店舗リストを更新
  useEffect(() => {
    if (selectedBrandId && selectedClientId) {
      // 選択されたブランドに紐づく店舗を取得（法人も一致するもの）
      const brandStores = stores.filter((s) => 
        String(s.brand_id) === String(selectedBrandId) &&
        String(s.client_id) === String(selectedClientId)
      );
      setLocalStores(brandStores);
    } else {
      setLocalStores([]);
    }
  }, [selectedBrandId, selectedClientId, stores]);

  const handleClientChange = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedBrandId('');
    setLocalStores([]);
    setLocal((p) => ({ ...p, client_id: clientId, brand_id: null, store_id: null, target_name: '' }));
  };

  const handleBrandChange = (brandId) => {
    setSelectedBrandId(brandId);
    setLocalStores([]);
    setLocal((p) => ({ ...p, brand_id: brandId, store_id: null, target_name: '' }));
  };

  const handleStoreChange = (storeId) => {
    const store = localStores.find((s) => s.id === storeId);
    setLocal((p) => ({
      ...p,
      store_id: storeId,
      target_name: store ? (store.name || store.store_name || '') : p.target_name
    }));
  };

  function setField(key, value) {
    setLocal((p) => ({ ...p, [key]: value }));
  }

  function safeTimeChange(startHHMM, endHHMM) {
    let start = hhmmToMinutes(startHHMM);
    let end = hhmmToMinutes(endHHMM);
    start = clamp(start, 0, 24 * 60);
    end = clamp(end, 0, 24 * 60);
    if (end <= start) end = start + 15;
    setLocal((p) => ({ ...p, start_min: start, end_min: end }));
  }

  const meta = statusMeta(local.status);

  return (
    <div className="modalBackdrop" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog">
        <div className="modalHeader">
          <div>
            <div className="modalTitle">
              割当 {mode === 'create' ? '作成' : '詳細'}
              {conflict && <span className="warn">（重複⚠）</span>}
            </div>
            <div className="muted">{isoToDateLabel(local.date)}</div>
          </div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modalTabs" role="tablist">
          {APPOINTMENT_MODAL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`modalTab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {saveConflictError && (
          <div className="modalConflictError" role="alert">
            {saveConflictError}
          </div>
        )}
        <div className="modalBody">
          {activeTab === 'basic' && (
            <div className="formGrid">
              <label className="field">
                <span>日付</span>
                <input
                  type="date"
                  value={local.date || dateISO}
                  onChange={(e) => setField('date', e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>
              <label className="field span2">
                <span>清掃員（複数選択可）</span>
                <div className="cleanerCheckboxes" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
                  {cleaners.map((d) => {
                    const cleanerIds = local.cleaner_ids || (local.cleaner_id ? [local.cleaner_id] : []);
                    const isChecked = cleanerIds.includes(d.id);
                    return (
                      <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const currentIds = local.cleaner_ids || (local.cleaner_id ? [local.cleaner_id] : []);
                            const newIds = e.target.checked
                              ? [...currentIds, d.id]
                              : currentIds.filter((id) => id !== d.id);
                            setLocal((p) => ({ ...p, cleaner_ids: newIds, cleaner_id: newIds[0] || null }));
                          }}
                        />
                        <span>{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </label>
              <label className="field span2" style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text)' }}>店舗検索（法人・ブランド・店舗名で検索）</span>
                  <Link
                    to="/office/clients/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: 'rgba(58, 108, 255, 0.15)',
                      border: '1px solid rgba(58, 108, 255, 0.3)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(58, 108, 255, 0.25)';
                      e.target.style.borderColor = 'rgba(58, 108, 255, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(58, 108, 255, 0.15)';
                      e.target.style.borderColor = 'rgba(58, 108, 255, 0.3)';
                    }}
                  >
                    <span>＋</span>
                    <span>顧客新規登録</span>
                  </Link>
                </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text)' }}>
                      <i className="fas fa-search" style={{ color: 'var(--muted)', fontSize: '14px' }}></i>
                      <input
                        type="text"
                        value={unifiedSearchQuery}
                        onChange={(e) => setUnifiedSearchQuery(e.target.value)}
                        placeholder="法人名・ブランド名・店舗名・電話番号で検索..."
                        style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                      />
                      {unifiedSearchQuery && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUnifiedSearchQuery('');
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0 4px' }}
                          aria-label="検索をクリア"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {unifiedSearchQuery && unifiedSearchResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', maxHeight: '400px', overflowY: 'auto', background: 'rgba(18, 22, 33, 0.95)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}>
                        {unifiedSearchResults.map((result, idx) => {
                          const store = result.store;
                          const client = result.client;
                          const brand = result.brand;
                          
                          return (
                            <div
                              key={store?.id || idx}
                              onClick={() => {
                                if (store) {
                                  if (client) {
                                    handleClientChange(client.id);
                                  }
                                  if (brand) {
                                    handleBrandChange(brand.id);
                                  }
                                  handleStoreChange(store.id);
                                  setUnifiedSearchQuery('');
                                }
                              }}
                              style={{
                                padding: '12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'var(--text)',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '15px' }}>
                                {store?.name || store?.store_name || store?.id || '（店舗不明）'}
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '2px' }}>
                                {brand?.name || brand?.brand_name ? `ブランド: ${brand.name || brand.brand_name}` : 'ブランド: （不明）'}
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '2px' }}>
                                {client?.name || client?.client_name ? `法人: ${client.name || client.client_name}` : '法人: （不明）'}
                              </div>
                              {store?.phone || store?.tel || store?.phone_number ? (
                                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>📞 {store.phone || store.tel || store.phone_number}</div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {unifiedSearchQuery && unifiedSearchResults.length === 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', padding: '12px', background: 'rgba(18, 22, 33, 0.95)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px', zIndex: 1000, color: 'var(--muted)', fontSize: '14px' }}>
                        {stores.length === 0 ? '店舗データが読み込まれていません' : '該当する店舗が見つかりません'}
                      </div>
                    )}
                  </div>
              </label>
              {selectedClientId && (
                <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '4px', background: 'rgba(58, 108, 255, 0.1)', border: '1px solid rgba(58, 108, 255, 0.3)', fontSize: '13px', color: 'var(--text)', gridColumn: 'span 2' }}>
                  <div><strong>法人:</strong> {clients.find((c) => String(c.id) === String(selectedClientId))?.name || clients.find((c) => String(c.id) === String(selectedClientId))?.client_name || selectedClientId}</div>
                  {selectedBrandId && (
                    <div style={{ marginTop: '4px' }}><strong>ブランド:</strong> {brands.find((b) => String(b.id) === String(selectedBrandId))?.name || brands.find((b) => String(b.id) === String(selectedBrandId))?.brand_name || selectedBrandId}</div>
                  )}
                  {local.store_id && (
                    <div style={{ marginTop: '4px' }}><strong>店舗:</strong> {localStores.find((s) => String(s.id) === String(local.store_id))?.name || localStores.find((s) => String(s.id) === String(local.store_id))?.store_name || local.store_id}</div>
                  )}
                </div>
              )}
              <div style={{ marginTop: '12px', gridColumn: 'span 2' }}>
                <Link
                  to="/office/clients/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    background: 'rgba(58, 108, 255, 0.15)',
                    border: '1px solid rgba(58, 108, 255, 0.3)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(58, 108, 255, 0.25)';
                    e.target.style.borderColor = 'rgba(58, 108, 255, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(58, 108, 255, 0.15)';
                    e.target.style.borderColor = 'rgba(58, 108, 255, 0.3)';
                  }}
                >
                  <span>＋</span>
                  <span>顧客新規登録</span>
                </Link>
              </div>
              <label className="field">
                <span>開始</span>
                <input type="time" value={minutesToHHMM(local.start_min)} onChange={(e) => safeTimeChange(e.target.value, minutesToHHMM(local.end_min))} step={1800} />
              </label>
              <label className="field">
                <span>終了</span>
                <input type="time" value={minutesToHHMM(local.end_min)} onChange={(e) => safeTimeChange(minutesToHHMM(local.start_min), e.target.value)} step={1800} />
              </label>
              <label className="field">
                <span>種別</span>
                <select value={local.work_type} onChange={(e) => setField('work_type', e.target.value)}>
                  {WORK_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>状態</span>
                <select value={local.status} onChange={(e) => setField('status', e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <div className={`badge preview ${meta.colorClass}`}>表示: {meta.label}</div>
              </label>
            </div>
          )}
          {activeTab === 'memo' && (
            <div className="formGrid">
              <label className="field span2">
                <span>メモ</span>
                <textarea value={local.memo} onChange={(e) => setField('memo', e.target.value)} placeholder="例）鍵あり、入室注意" rows={5} />
              </label>
            </div>
          )}
        </div>
        <div className="modalFooter">
          <div className="left">
            {mode !== 'create' && (
              <button type="button" className="btnDanger" onClick={() => onDelete(local.id)}>削除</button>
            )}
          </div>
          <div className="right">
            <button type="button" className="btn" onClick={onClose}>閉じる</button>
            <button type="button" className="btnPrimary" onClick={() => onSave(local)} disabled={!local.target_name?.trim()} title={!local.target_name?.trim() ? '現場名が必要です' : ''}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
