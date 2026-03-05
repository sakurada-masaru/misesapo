import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { detectConflicts as detectConflictsBeforeSave } from '../../shared/utils/scheduleConflicts';
import { newScheduleId } from '../../shared/utils/scheduleId';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';
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

/** workers API 用ベース（localhost は /api、本番は VITE_API_BASE または prod） */
function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

// UI は常に同一オリジン相対 (/api) を正とする。
const API_BASE = (import.meta.env?.DEV || isLocalUiHost())
    ? '/api'
    : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);

const STATUSES = [
  { key: 'planned', label: '予定', colorClass: 's-booked' },
  { key: 'torikeshi', label: '取消', colorClass: 's-cancelled' },
];

/** 実行状態（dispatch）: 予定状態と分離して管理 */
const DISPATCH_STATUSES = [
  { key: 'todo', label: '未着手', colorClass: 's-booked' },
  { key: 'enroute', label: '移動中', colorClass: 's-checkedin' },
  { key: 'working', label: '作業中', colorClass: 's-inprogress' },
  { key: 'done', label: '完了', colorClass: 's-done' },
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
  { id: '__unassigned__', name: '📋 未割当', unit: 'cleaning' },
  { id: 'W002', name: '梅岡アレサンドレユウジ', unit: 'cleaning' },
  { id: 'W01000', name: '松岡ジョナス', unit: 'cleaning' },
  { id: 'W01005', name: 'ソウザ　レムエル', unit: 'cleaning' },
  { id: 'W740024', name: 'Noemi Midory', unit: 'cleaning' },
  { id: 'W01003', name: '松岡ガブリエレ', unit: 'cleaning' },
  { id: 'W021', name: '遠藤虹輝', unit: 'maintenance' },
  { id: 'W006', name: '佐々木一真', unit: 'maintenance' },
  { id: 'W01006', name: '中澤裕', unit: 'maintenance' },
  { id: 'W003', name: '中島郁哉', unit: 'maintenance' },
  { id: 'W005', name: '吉井奎吾', unit: 'maintenance' },
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
  return Math.max(startMin, DAYTIME_START) < Math.min(endMin, DAYTIME_END);
}

/** 時間を基準のoffsetMinに変換（0:00基準に戻す） */
function toOffsetMin(min) {
  return min % 1440;
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
  const statuses = ['planned'];
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
  const statuses = ['planned'];
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
      status: 'planned',
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
    { cleaner_id: 'c1', start: '09:00', end: '09:30', target_name: 'A店', work_type: '定期', status: 'planned' },
    { cleaner_id: 'c1', start: '10:00', end: '10:30', target_name: 'B店', work_type: '特別', status: 'checked_in' },
    { cleaner_id: 'c2', start: '09:30', end: '10:00', target_name: 'C店', work_type: '定期', status: 'in_progress' },
    { cleaner_id: 'c2', start: '10:15', end: '10:45', target_name: 'D店', work_type: '入念', status: 'planned' },
    { cleaner_id: 'c3', start: '13:00', end: '13:30', target_name: 'E店', work_type: '定期', status: 'done' },
    { cleaner_id: 'c4', start: '15:00', end: '15:30', target_name: 'F店', work_type: '夜間', status: 'torikeshi' },
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
    status: normalizeYoteiStatus(appt.status),
    schedule_id: appt.schedule_id ?? appt.id,
    contact_note: appt.contact_note ?? '',
    contact_last_at: appt.contact_last_at ?? null,
    contact_status: appt.contact_status ?? 'pending',
    contact_reminders: appt.contact_reminders ?? [], // 事前連絡リマインダー（例：['7日前', '3日前', '1日前']）
    cleaner_ids: appt.cleaner_ids || (appt.cleaner_id ? [appt.cleaner_id] : []), // 複数清掃員対応
    dispatch_status: appt.dispatch_status ?? normalizeDispatchStatusFromSchedule(appt.status),
  };
}

function normalizeYoteiStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'torikeshi' || s === 'cancelled') return 'torikeshi';
  return 'planned';
}

/** DynamoDBのスケジュールデータをフロントエンド形式に変換 */
function convertScheduleToAppointment(schedule) {
  // 日付フィールド（複数のフィールド名に対応）
  const date = schedule.scheduled_date || schedule.date || '';

  // 開始時間の取得（複数のフィールド名に対応）
  const startTimeStr = schedule.start_time || schedule.startTime || schedule.scheduled_time || schedule.time_slot || '';
  const startMin = schedule.start_min ?? (startTimeStr ? hhmmToMinutes(startTimeStr) : 540);

  // 終了時間の取得（なければ開始時間+2時間）
  const endTimeStr = schedule.end_time || schedule.endTime || '';
  const endMin = schedule.end_min ?? (endTimeStr ? hhmmToMinutes(endTimeStr) : startMin + 120);

  // 店舗名の取得（ブランド名を必ず前につける）
  const bName = schedule.brand_name || '';
  const sName = schedule.store_name || schedule.storeName || schedule.target_name || schedule.summary || '';
  let targetName = bName && sName ? `[${bName}] ${sName}` : (sName || bName || '要契約確認');
  // すでに [ブランド] 形式で始まっている場合は二重につけない
  if (bName && sName.startsWith(`[${bName}]`)) targetName = sName;

  // 担当者IDの取得（複数のフィールド名に対応）
  const workerId = schedule.worker_id || schedule.assigned_to || schedule.sales_id || '';

  return {
    id: schedule.id,
    schedule_id: schedule.id,
    date: date,
    cleaner_id: workerId,
    start_min: startMin,
    end_min: endMin,
    start: startTimeStr || minutesToHHMM(startMin),
    end: endTimeStr || minutesToHHMM(endMin),
    target_name: targetName,
    work_type: schedule.work_type || schedule.order_type || 'その他',
    status: normalizeYoteiStatus(schedule.status),
    dispatch_status: normalizeDispatchStatusFromSchedule(schedule.status || 'planned'),
    memo: schedule.description || schedule.memo || schedule.notes || '',
    location: schedule.location || schedule.address || '',
    store_id: schedule.store_id || null,
    client_id: schedule.client_id || null,
    brand_name: schedule.brand_name || '',
    origin: schedule.origin || schedule.type || 'manual',
    external_id: schedule.external_id || schedule.googleEventId || null,
    contact_note: '',
    contact_last_at: null,
    contact_status: 'pending',
    contact_reminders: [],
    cleaner_ids: schedule.worker_ids || (workerId ? [workerId] : []),
    attendee_emails: schedule.attendee_emails || [],
    created_at: schedule.created_at ? new Date(schedule.created_at).getTime() : Date.now(),
    updated_at: schedule.updated_at ? new Date(schedule.updated_at).getTime() : Date.now(),
  };
}

/** メールアドレス一覧モーダル */
function EmailListModal({ emails, schedules, onClose }) {
  // メールアドレスごとに、どのスケジュールに含まれているかを集計
  const emailToSchedules = {};
  emails.forEach(email => {
    emailToSchedules[email] = schedules.filter(s =>
      s.attendee_emails && s.attendee_emails.includes(email)
    );
  });

  return (
    <div className="modalBackdrop" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: '800px' }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">参加者メールアドレス一覧</div>
            <div className="muted">Googleカレンダーから取り込んだスケジュールの参加者メールアドレス（{emails.length}件）</div>
          </div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modalBody" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {emails.map((email, idx) => {
              const relatedSchedules = emailToSchedules[email] || [];
              return (
                <div key={idx} style={{ padding: '12px', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--panel)' }}>
                  <div style={{ fontSize: '1em', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '8px' }}>
                    {email}
                  </div>
                  <div style={{ fontSize: '0.85em', color: 'var(--muted)' }}>
                    参加スケジュール: {relatedSchedules.length}件
                    {relatedSchedules.length > 0 && (
                      <div style={{ marginTop: '4px', paddingLeft: '8px' }}>
                        {relatedSchedules.slice(0, 3).map(s => (
                          <div key={s.id} style={{ marginTop: '2px' }}>
                            • {s.target_name} ({s.date} {s.start}-{s.end})
                          </div>
                        ))}
                        {relatedSchedules.length > 3 && (
                          <div style={{ marginTop: '2px', color: 'var(--muted)' }}>
                            ...他{relatedSchedules.length - 3}件
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modalFooter">
          <div className="right">
            <button type="button" className="btn" onClick={onClose}>閉じる</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** フィルターオーバーレイモーダル */
function FilterOverlay({
  filterUnit,
  setFilterUnit,
  filterCleaner,
  setFilterCleaner,
  filterStatus,
  setFilterStatus,
  filterWorkType,
  setFilterWorkType,
  filterStore,
  setFilterStore,
  cleanersForFilter,
  stores = [],
  brands = [],
  onClose
}) {
  const hasActiveFilters = filterUnit !== 'all' || filterCleaner !== 'all' || filterStatus !== 'all' || filterWorkType !== 'all' || filterStore !== 'all';

  const handleReset = () => {
    setFilterUnit('all');
    setFilterCleaner('all');
    setFilterStatus('all');
    setFilterWorkType('all');
    setFilterStore('all');
  };

  return (
    <div className="modalBackdrop" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: '500px' }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">フィルター</div>
            <div className="muted">スケジュールを絞り込みます</div>
          </div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modalBody">
          <div className="formGrid">
            <label className="field span2">
              <span>現場を選択</span>
              <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)}>
                <option value="all">全ての現場</option>
                {stores.map(s => {
                  const brand = brands.find(b => String(b.id) === String(s.brand_id));
                  const bName = brand?.name || s.brand_name || '';
                  const sName = s.name || s.store_name || '';
                  const fullLabel = bName && sName ? `[${bName}] ${sName}` : (sName || bName || s.id);
                  return { ...s, fullLabel };
                }).sort((a, b) => a.fullLabel.localeCompare(b.fullLabel)).map(s => (
                  <option key={s.id} value={s.id}>{s.fullLabel}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ユニット</span>
              <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
                <option value="all">全て</option>
                <option value="cleaning">清掃ユニット</option>
                <option value="maintenance">メンテユニット</option>
              </select>
            </label>
            <label className="field">
              <span>清掃員</span>
              <select value={filterCleaner} onChange={(e) => setFilterCleaner(e.target.value)}>
                <option value="all">全員</option>
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
              <span>種別（プラン）</span>
              <select value={filterWorkType} onChange={(e) => setFilterWorkType(e.target.value)}>
                <option value="all">全て</option>
                {WORK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="modalFooter">
          <div className="left">
            {hasActiveFilters && (
              <button type="button" className="btn" onClick={handleReset}>
                リセット
              </button>
            )}
          </div>
          <div className="right">
            <button type="button" className="btnPrimary" onClick={onClose}>
              適用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 未割り当てスケジュール割り当てモーダル */
function UnassignedSchedulesModal({ schedules, cleaners, onClose, onAssign }) {
  const [assignments, setAssignments] = useState({}); // { schedule_id: [worker_id1, worker_id2, ...] }
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState(''); // 日付フィルター
  const [filterTime, setFilterTime] = useState(''); // 時間フィルター（開始時刻）
  const [filterStore, setFilterStore] = useState(''); // 現場名検索
  const [filterEmail, setFilterEmail] = useState(''); // メールアドレス検索

  // 日時順（若い順）にソート
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      // まず日付で比較
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      // 日付が同じ場合は開始時刻で比較
      const aStart = a.start_min ?? (a.start ? hhmmToMinutes(a.start) : 0);
      const bStart = b.start_min ?? (b.start ? hhmmToMinutes(b.start) : 0);
      return aStart - bStart;
    });
  }, [schedules]);

  // フィルター適用
  const filteredSchedules = useMemo(() => {
    return sortedSchedules.filter((schedule) => {
      // 日付フィルター
      if (filterDate && schedule.date !== filterDate) {
        return false;
      }

      // 時間フィルター（開始時刻が指定時刻以降）
      if (filterTime) {
        const filterStartMin = hhmmToMinutes(filterTime);
        const scheduleStartMin = schedule.start_min ?? (schedule.start ? hhmmToMinutes(schedule.start) : 0);
        if (scheduleStartMin < filterStartMin) {
          return false;
        }
      }

      // 現場名検索
      if (filterStore) {
        const storeLower = filterStore.toLowerCase();
        const targetName = (schedule.target_name || '').toLowerCase();
        if (!targetName.includes(storeLower)) {
          return false;
        }
      }

      // メールアドレス検索
      if (filterEmail) {
        const emailLower = filterEmail.toLowerCase();
        const hasEmail = schedule.attendee_emails && schedule.attendee_emails.some(
          (email) => email.toLowerCase().includes(emailLower)
        );
        if (!hasEmail) {
          return false;
        }
      }

      return true;
    });
  }, [sortedSchedules, filterDate, filterTime, filterStore, filterEmail]);

  const handleAssign = async () => {
    setSaving(true);
    try {
      let totalAssignments = 0;
      for (const [scheduleId, workerIds] of Object.entries(assignments)) {
        if (Array.isArray(workerIds) && workerIds.length > 0) {
          // 最初の清掃員で既存のスケジュールを更新、2番目以降で新しいスケジュールを作成
          for (let i = 0; i < workerIds.length; i++) {
            const workerId = workerIds[i];
            if (workerId) {
              await onAssign(scheduleId, workerId, i === 0);
              totalAssignments++;
            }
          }
        }
      }
      // 全ての割り当てが完了したらスケジュールを再読み込み
      // 注意: onAssign関数内でも再読み込みしているが、最後に1回だけ再読み込みする方が効率的
      // しかし、エラーハンドリングのため、各onAssign呼び出し後に再読み込みする方が安全
      alert(`${totalAssignments}件の割り当てが完了しました`);
      onClose();
    } catch (err) {
      alert('割り当てに失敗しました: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 清掃員の選択状態を切り替え
  const toggleCleaner = (scheduleId, workerId) => {
    setAssignments((prev) => {
      const current = prev[scheduleId] || [];
      const newList = current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId];
      return { ...prev, [scheduleId]: newList };
    });
  };

  return (
    <div className="modalBackdrop" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: '900px' }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">未割り当てスケジュールの清掃員割り当て</div>
            <div className="muted">メールアドレスから清掃員を選択してください（{filteredSchedules.length}件 / 全{schedules.length}件）</div>
          </div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modalBody" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* フィルターエリア */}
          <div style={{ padding: '16px', background: 'var(--panel2)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text)' }}>フィルター</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '0.85em' }}>日付</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{ fontSize: '0.9em' }}
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '0.85em' }}>開始時刻以降</span>
                <input
                  type="time"
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  style={{ fontSize: '0.9em' }}
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '0.85em' }}>現場名検索</span>
                <input
                  type="text"
                  value={filterStore}
                  onChange={(e) => setFilterStore(e.target.value)}
                  placeholder="現場名で検索"
                  style={{ fontSize: '0.9em' }}
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '0.85em' }}>メールアドレス検索</span>
                <input
                  type="text"
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  placeholder="メールアドレスで検索"
                  style={{ fontSize: '0.9em' }}
                />
              </label>
            </div>
            {(filterDate || filterTime || filterStore || filterEmail) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFilterDate('');
                  setFilterTime('');
                  setFilterStore('');
                  setFilterEmail('');
                }}
                style={{ marginTop: '12px', fontSize: '0.85em' }}
              >
                フィルターをクリア
              </button>
            )}
          </div>

          <div className="formGrid">
            {filteredSchedules.length === 0 ? (
              <div style={{ gridColumn: 'span 2', padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                {schedules.length === 0 ? '未割り当てのスケジュールがありません' : 'フィルター条件に一致するスケジュールがありません'}
              </div>
            ) : (
              filteredSchedules.map((schedule) => (
                <div key={schedule.id} style={{ gridColumn: 'span 2', padding: '16px', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '12px', background: 'var(--panel)' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ fontSize: '1.1em' }}>{schedule.target_name}</strong>
                    <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginTop: '4px' }}>
                      📅 {schedule.date} ⏰ {schedule.start} - {schedule.end}
                    </div>
                    {schedule.location && (
                      <div style={{ fontSize: '0.85em', color: 'var(--muted)', marginTop: '4px' }}>
                        📍 {schedule.location}
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--panel2)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.85em', color: 'var(--muted)', marginBottom: '6px', fontWeight: 'bold' }}>参加者メールアドレス:</div>
                    {schedule.attendee_emails && schedule.attendee_emails.length > 0 ? (
                      <div style={{ fontSize: '0.9em' }}>
                        {schedule.attendee_emails.map((email, idx) => (
                          <div key={idx} style={{ padding: '2px 0', fontFamily: 'monospace' }}>{email}</div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85em', color: 'var(--muted)' }}>メールアドレスなし</div>
                    )}
                  </div>
                  <div className="field">
                    <span style={{ display: 'block', marginBottom: '8px' }}>清掃員を選択（複数選択可）</span>
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid var(--line)',
                      borderRadius: '4px',
                      padding: '8px',
                      background: 'var(--bg)'
                    }}>
                      {cleaners.length === 0 ? (
                        <div style={{ padding: '8px', color: 'var(--muted)', fontSize: '0.9em' }}>清掃員が登録されていません</div>
                      ) : (
                        cleaners.map((cleaner) => {
                          const isSelected = (assignments[schedule.id] || []).includes(cleaner.id);
                          return (
                            <label
                              key={cleaner.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                marginBottom: '4px',
                                background: isSelected ? 'var(--panel2)' : 'transparent',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'var(--panel2)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCleaner(schedule.id, cleaner.id)}
                                disabled={saving}
                                style={{ marginRight: '8px', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.9em', flex: 1 }}>{cleaner.name}</span>
                              {cleaner.unit && (
                                <span style={{ fontSize: '0.8em', color: 'var(--muted)', marginLeft: '8px' }}>
                                  ({cleaner.unit})
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                    {(assignments[schedule.id] || []).length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '0.85em', color: 'var(--muted)' }}>
                        選択中: {(assignments[schedule.id] || []).length}名
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="modalFooter">
          <div className="left">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>キャンセル</button>
          </div>
          <div className="right">
            <button
              type="button"
              className="btnPrimary"
              onClick={handleAssign}
              disabled={saving || Object.values(assignments).every(arr => !Array.isArray(arr) || arr.length === 0)}
            >
              {saving ? '割り当て中...' : (() => {
                const total = Object.values(assignments).reduce((sum, arr) => {
                  return sum + (Array.isArray(arr) ? arr.length : 0);
                }, 0);
                return `割り当て実行（${total}件）`;
              })()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusMeta(statusKey) {
  return STATUSES.find((s) => s.key === normalizeYoteiStatus(statusKey)) ?? STATUSES[0];
}

function dispatchStatusMeta(statusKey) {
  return DISPATCH_STATUSES.find((s) => s.key === statusKey) ?? DISPATCH_STATUSES[0];
}

function normalizeDispatchStatusFromSchedule(scheduleStatus) {
  if (scheduleStatus === 'done') return 'done';
  if (scheduleStatus === 'in_progress') return 'working';
  if (scheduleStatus === 'checked_in') return 'enroute';
  return 'todo';
}

function categoryFromWorkType(workType = '') {
  const t = String(workType);
  if (t.includes('害虫') || t.includes('駆除') || t.includes('ゴキブリ') || t.includes('ネズミ')) return 'PEST';
  if (t.includes('メンテ') || t.includes('修理') || t.includes('工事') || t.includes('補修') || t.includes('排水')) return 'MAINT';
  return 'CLEAN';
}

function executionStatusMetaFromAppt(appt) {
  const status = appt?.dispatch_status || normalizeDispatchStatusFromSchedule(appt?.status);
  return dispatchStatusMeta(status);
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
  if (!appt) return null;
  const dateOnly = (appt.date || '').slice(0, 10);
  const startAt = `${dateOnly}T${pad2(Math.floor(appt.start_min / 60))}:${pad2(appt.start_min % 60)}:00`;
  const endAt = `${dateOnly}T${pad2(Math.floor(appt.end_min / 60))}:${pad2(appt.end_min % 60)}:00`;
  return {
    id: appt.id,
    schedule_id: appt.schedule_id ?? appt.id,
    assignee_id: appt.cleaner_id || appt.worker_id || appt.assigned_to,
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
  // localStorageの古いデータを使わず、defaultCleanersを使用（APIから読み込み後に更新される）
  const [cleaners, setCleaners] = useState(defaultCleaners);
  const [dateISO, setDateISO] = useState(todayISO());
  const [view, setView] = useState('day');
  const [query, setQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterCleaner, setFilterCleaner] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterWorkType, setFilterWorkType] = useState('all');
  const [filterStore, setFilterStore] = useState('all');
  const [timelinePart, setTimelinePart] = useState('night'); // 'day' or 'night'
  const [activeCleanerSP, setActiveCleanerSP] = useState(defaultCleaners[0]?.id ?? 'W002');

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
  const [houkokuSaveError, setHoukokuSaveError] = useState(null);
  const kartePanelRef = useRef(null);

  /** 16:00を境に業務日付を算出する関数 */
  const calculateBizDate = (isoStartAt) => {
    const d = dayjs(isoStartAt);
    const hour = d.hour();
    // 16:00 (16時) 以降なら翌日扱い
    if (hour >= 16) {
      return d.add(1, 'day').format('YYYY-MM-DD');
    }
    return d.format('YYYY-MM-DD');
  };

  const upsertDispatchStatus = useCallback(async ({ scheduleId, workerId, storeId, workType, isoStartAt, status }) => {
    // Phase1: /yotei のみをI/Oの正とするため、dispatch API への保存は行わない。
    // 将来の ugoki フェーズで再有効化する。
    return Promise.resolve({ scheduleId, workerId, storeId, workType, isoStartAt, status });
  }, []);

  /** 報告書の下書きを自動起票する関数 */
  const createHoukokuDrafts = async (scheduleData, workerIds) => {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${String(token).trim()}`
    };
    const base = API_BASE.replace(/\/$/, '');

    // scheduleData.start_at から業務日付を取得
    const bizDate = calculateBizDate(scheduleData.start_at);
    const results = [];

    for (const wId of workerIds) {
      if (!wId || wId === '__unassigned__') continue;

      const houkokuId = `${scheduleData.schedule_id || scheduleData.id}#${wId}#${bizDate}`;
      const payload = {
        id: houkokuId,
        type: scheduleData.work_type || 'regular',
        state: 'draft',
        schedule_id: scheduleData.schedule_id || scheduleData.id,
        proposal_id: scheduleData.proposal_id || null,
        worker_id: wId,
        biz_date: bizDate,
        store_id: scheduleData.store_id || null,
        customer_id: scheduleData.client_id || null,
        services: scheduleData.services || [],
        planned_start_at: scheduleData.start_at,
        planned_end_at: scheduleData.end_at,
        meta: {
          auto_generated: true,
          generated_at: new Date().toISOString()
        }
      };

      try {
        const res = await fetch(`${base}/houkoku`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
        // 409 (Conflict) は既に存在するので成功とみなす
        if (!res.ok && res.status !== 409) {
          throw new Error(`Houkoku API Error: ${res.status}`);
        }
        results.push({ worker_id: wId, success: true });
      } catch (err) {
        console.error(`[HoukokuDraft] Failed for ${wId}:`, err);
        results.push({ worker_id: wId, success: false, error: err.message });
      }
    }

    const fails = results.filter(r => !r.success);
    if (fails.length > 0) {
      setHoukokuSaveError({
        schedule: scheduleData,
        workerIds: workerIds,
        message: '一部の清掃員の報告書起票に失敗しました。'
      });
    } else {
      setHoukokuSaveError(null);
    }
  };

  const [isSavingKarte, setIsSavingKarte] = useState(false);
  const [isEditingSelectedAppt, setIsEditingSelectedAppt] = useState(false);
  const [originalSelectedAppt, setOriginalSelectedAppt] = useState(null);

  /** 報告書の下書きを自動起票する関数（実装済み） */
  // ... (関数本体は定義済み)

  /** APIからスケジュールを読み込む関数 */
  const loadSchedulesFromAPI = useCallback((targetDateISO = dateISO) => {
    setIsLoadingSchedules(true);

    const token = getToken(); // 常に最新のトークンを取得
    const base = API_BASE.replace(/\/$/, '');

    // 日付範囲を計算（選択日付の前後30日）
    const selectedDate = dayjs(targetDateISO);
    const dateFrom = selectedDate.subtract(30, 'day').format('YYYY-MM-DD');
    const dateTo = selectedDate.add(30, 'day').format('YYYY-MM-DD');

    const schedulesUrl = `${base}/yotei?date_from=${dateFrom}&date_to=${dateTo}&limit=2000`;
    const headers = token ? { 'Authorization': `Bearer ${String(token).trim()}` } : {};

    // blocks は一旦機能停止。schedules のみ取得する。
    return fetch(schedulesUrl, { headers, cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Schedules HTTP ${res.status}`))))
      .then((sData) => {
        const sList = Array.isArray(sData) ? sData : (sData?.items || []);
        const converted = sList.map(convertScheduleToAppointment).map(ensureContactFields);
        setAppointments(converted);
      })
      .catch((err) => {
        console.warn('[AdminScheduleTimeline] API Load failed:', err);
      })
      .finally(() => {
        setIsLoadingSchedules(false);
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
      if (filterStore !== 'all' && String(a.store_id) !== String(filterStore)) return false;
      if (!q) return true;
      const cleanerName = cleanersWithUnit.find((d) => d.id === a.cleaner_id)?.name ?? '';
      const hay = `${a.target_name} ${a.work_type} ${cleanerName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [appointments, dateISO, query, filterUnit, filterCleaner, filterStatus, filterWorkType, filterStore, cleanersWithUnit, cleaningUnitIds, maintenanceUnitIds]);

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
      if (filterStore !== 'all' && String(a.store_id) !== String(filterStore)) return false;
      if (!q) return true;
      const cleanerName = cleanersWithUnit.find((d) => d.id === a.cleaner_id)?.name ?? '';
      const hay = `${a.target_name} ${a.work_type} ${cleanerName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [appointments, rollingDays, query, filterUnit, filterCleaner, filterStatus, filterWorkType, filterStore, cleanersWithUnit, cleaningUnitIds, maintenanceUnitIds]);

  const summary = useMemo(() => {
    const total = filteredAppointments.length;
    const byStatus = new Map();
    let recleanCount = 0; // 清掃事故案件の数
    let unassignedCount = 0; // 未割り当て案件の数
    let needsContractReviewCount = 0; // 要契約確認の数

    for (const a of filteredAppointments) {
      byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
      // 清掃事故案件をカウント
      if (a.work_type === '再清掃' || a.work_type === '再清掃案件') {
        recleanCount++;
      }
      // 未割り当て案件をカウント（cleaner_idがnullまたはundefined）
      if (!a.cleaner_id) {
        unassignedCount++;
      }
      // 「要契約確認」をカウント
      if (a.target_name === '要契約確認') {
        needsContractReviewCount++;
      }
    }
    return { total, byStatus, recleanCount, unassignedCount, needsContractReviewCount };
  }, [filteredAppointments]);

  const [modal, setModal] = useState({ open: false, appt: null, mode: 'view' });
  const [contactMode, setContactMode] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [saveConflictError, setSaveConflictError] = useState(null);
  const [conflictOverlayVisible, setConflictOverlayVisible] = useState(false);
  const [icsImportModal, setIcsImportModal] = useState({ open: false });
  const [unassignedModal, setUnassignedModal] = useState({ open: false });
  const [emailListModal, setEmailListModal] = useState({ open: false });
  const [filterOverlayOpen, setFilterOverlayOpen] = useState(false);
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
        status: 'planned',
        dispatch_status: 'todo',
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

  async function saveModal(updated) {
    setSaveConflictError(null);

    // 複数の清掃員が選択されている場合、各清掃員ごとに案件を作成
    const cleanerIds = updated.cleaner_ids || (updated.cleaner_id ? [updated.cleaner_id] : []);

    if (cleanerIds.length === 0) {
      setSaveConflictError('清掃員を1人以上選択してください');
      return;
    }

    const token = getToken();
    const base = API_BASE.replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token.trim()}`;

    // 通用ペイロード作成用関数
    const createPayload = (workerId) => {
      // 古い文字列（updated.start）が残っている場合でも、常に最新の数値(start_min)から生成し直す
      const startStr = minutesToHHMM(updated.start_min);
      const endStr = minutesToHHMM(updated.end_min);
      const timeSlot = `${startStr}-${endStr}`;

      return {
        schedule_id: updated.schedule_id || updated.id,
        cleaner_id: workerId,
        date: updated.date,
        scheduled_date: updated.date,
        start_time: startStr,
        end_time: endStr,
        time_slot: timeSlot,
        scheduled_time: timeSlot,
        start_min: updated.start_min,
        end_min: updated.end_min,
        start_at: `${updated.date}T${startStr}:00`,
        end_at: `${updated.date}T${endStr}:00`,
        duration_minutes: (updated.end_min - updated.start_min) || 60,
        target_name: updated.target_name,
        store_name: updated.target_name,
        store_id: updated.store_id || null,
        client_id: updated.client_id || null,
        brand_name: updated.brand_name || '',
        work_type: updated.work_type || 'その他',
        status: normalizeYoteiStatus(updated.status),
        dispatch_status: updated.dispatch_status || normalizeDispatchStatusFromSchedule(updated.status),
        worker_id: workerId,
        assigned_to: workerId,
        worker_ids: cleanerIds,
        description: updated.memo || '',
        notes: updated.memo || '',
        memo: updated.memo || '',
        origin: updated.origin || 'manual'
      };
    };

    // 既存案件の更新か新規作成か
    const exists = appointments.some((p) => p.id === updated.id);

    if (exists) {
      const candidate = [apptToConflictShape({ ...updated, cleaner_id: cleanerIds[0], schedule_id: updated.schedule_id ?? updated.id })];
      // 日付の頭10文字(YYYY-MM-DD)で比較するように修正
      const existingSameDay = appointments.filter((p) => (p.date || '').slice(0, 10) === updated.date.slice(0, 10) && p.id !== updated.id);
      const existingForCheck = existingSameDay.map(apptToConflictShape);
      const userIdToName = Object.fromEntries(cleanersWithUnit.map((c) => [c.id, c.name]));
      const conflicts = detectConflictsBeforeSave({
        candidateAppointments: candidate,
        existingAppointments: existingForCheck,
        blocks: [],
        userIdToName,
      });

      if (conflicts.length > 0) {
        setSaveConflictError(`重複のため保存できません\n${conflicts.map((c) => c.message).join('\n')}`);
        setConflictOverlayVisible(true);
        setTimeout(() => setConflictOverlayVisible(false), 3000);
        return;
      }

      try {
        const scheduleId = updated.schedule_id || updated.id;
        const payload = createPayload(cleanerIds[0]);
        console.log('[AdminScheduleTimeline] Saving update schedule payload:', payload);

        const res = await fetch(`${base}/yotei/${scheduleId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });

        if (res.status === 409) {
          const conflictData = await res.json().catch(() => ({}));
          let message = conflictData.message || conflictData.error || "他のスケジュールやクローズ（休み）と重複しています。";

          // サーバーのエラーコードを日本語に翻訳
          if (message === 'worker_unavailable' || message === 'WORKER_UNAVAILABLE') {
            message = "担当者が対応不可の時間帯です（稼働時間外、または休みと重なっています）。";
          }
          if (message === 'yotei_conflict' || message === 'YOTEI_CONFLICT') {
            message = "担当者の予定が重複しています。時間帯を変更してください。";
          }
          throw new Error(message);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // 実行状態（dispatch）を同期
        const dispatchStatus = updated.dispatch_status || normalizeDispatchStatusFromSchedule(updated.status);
        await Promise.all(
          cleanerIds.map((cid) => upsertDispatchStatus({
            scheduleId,
            workerId: cid,
            storeId: updated.store_id,
            workType: updated.work_type,
            isoStartAt: `${updated.date}T${minutesToHHMM(updated.start_min)}:00`,
            status: dispatchStatus,
          }).catch((e) => {
            console.warn('[AdminScheduleTimeline] dispatch sync failed (update):', e);
          }))
        );

        // 保存成功後に再読み込みして同期を確実にする
        await loadSchedulesFromAPI(updated.date);

        // 報告書の下書きを自動起票
        createHoukokuDrafts({ ...payload, schedule_id: scheduleId }, cleanerIds);

        closeModal();
      } catch (err) {
        console.error('[AdminScheduleTimeline] Save update failed:', err);
        setSaveConflictError(`保存に失敗しました: ${err.message}`);
      }
    } else {
      // 新規作成
      const newApptsData = cleanerIds.map((cid) => createPayload(cid));

      // 重複チェック
      const candidates = newApptsData.map((a, i) => apptToConflictShape({ ...a, id: `temp_${i}` }));
      // 日付の頭10文字(YYYY-MM-DD)で比較するように修正
      const existingSameDay = appointments.filter((p) => (p.date || '').slice(0, 10) === updated.date.slice(0, 10));
      const existingForCheck = existingSameDay.map(apptToConflictShape);

      console.log('[AdminScheduleTimeline] Save Create - Diagnostic:', {
        candidates,
        existingCount: existingForCheck.length,
        blocksCount: 0,
        existingForCheck
      });

      const userIdToName = Object.fromEntries(cleanersWithUnit.map((c) => [c.id, c.name]));
      const conflicts = detectConflictsBeforeSave({
        candidateAppointments: candidates,
        existingAppointments: existingForCheck,
        blocks: [],
        userIdToName,
      });

      if (conflicts.length > 0) {
        setSaveConflictError(`重複のため保存できません\n${conflicts.map((c) => c.message).join('\n')}`);
        setConflictOverlayVisible(true);
        setTimeout(() => setConflictOverlayVisible(false), 3000);
        return;
      }

      try {
        for (const payload of newApptsData) {
          console.log('[AdminScheduleTimeline] Saving new schedule payload:', payload);
          const res = await fetch(`${base}/yotei`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          if (res.status === 409) {
            const conflictData = await res.json().catch(() => ({}));
            console.warn('[AdminScheduleTimeline] Schedule create 409 conflict detail:', conflictData);
            let message = conflictData.message || conflictData.error || "他のスケジュールやクローズ（休み）と重複しています。";
            const detail = Array.isArray(conflictData.conflicts) && conflictData.conflicts.length > 0
              ? `\n${conflictData.conflicts.map((c) => {
                  const who = c.worker_id || '担当者';
                  const range = c.start_at && c.end_at ? `${c.start_at} - ${c.end_at}` : '';
                  const cid = c.id ? ` (${c.id})` : '';
                  return `- ${who}${cid} / ${range}`.trim();
                }).join('\n')}`
              : '';

            // サーバーのエラーコードを日本語に翻訳
            if (message === 'worker_unavailable' || message === 'WORKER_UNAVAILABLE') {
              message = "担当者が対応不可の時間帯です（稼働時間外、または休みと重なっています）。";
            }
            if (message === 'yotei_conflict' || message === 'YOTEI_CONFLICT') {
              message = "担当者の予定が重複しています。時間帯を変更してください。";
            }
            throw new Error(`${message}${detail}`);
          }

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const created = await res.json().catch(() => ({}));
          const createdScheduleId = created?.id || created?.schedule_id || payload.schedule_id || payload.id;
          const dispatchStatus = payload.dispatch_status || normalizeDispatchStatusFromSchedule(payload.status);
          if (createdScheduleId) {
            await upsertDispatchStatus({
              scheduleId: createdScheduleId,
              workerId: payload.worker_id,
              storeId: payload.store_id,
              workType: payload.work_type,
              isoStartAt: payload.start_at,
              status: dispatchStatus,
            }).catch((e) => {
              console.warn('[AdminScheduleTimeline] dispatch sync failed (create):', e);
            });
          }

          // 報告書の下書きを自動起票
          createHoukokuDrafts(payload, [payload.cleaner_id]);
        }

        // 保存成功後に再読み込みして同期を確実にする
        await loadSchedulesFromAPI(updated.date);
        closeModal();
      } catch (err) {
        console.error('[AdminScheduleTimeline] Save create failed:', err);
        setSaveConflictError(`新規作成に失敗しました: ${err.message}`);
      }
    }
  }

  const getToken = () => {
    return localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
  };

  async function deleteAppt(id) {
    const schedule = appointments.find((p) => p.id === id);
    const scheduleId = schedule?.schedule_id || schedule?.id;

    if (!scheduleId) {
      alert('削除対象のスケジュールIDが見つかりません');
      return;
    }

    try {
      const token = getToken();
      const base = API_BASE.replace(/\/$/, '');
      const response = await fetch(`${base}/yotei/${scheduleId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`削除に失敗しました: ${response.status}`);
      }

      setAppointments((prev) => prev.filter((p) => p.id !== id));
      if (selectedAppointmentId === id) setSelectedAppointmentId(null);
      if (selectedAppt?.id === id || selectedAppt?.schedule_id === scheduleId) setSelectedAppt(null);
      closeModal();
      alert('スケジュールを削除しました');
    } catch (error) {
      console.error('[AdminScheduleTimelinePage] Delete failed:', error);
      alert(`削除に失敗しました: ${error.message}`);
    }
  }

  function handleScheduleCardClick(appt) {
    setSelectedAppt(appt);
  }

  function handleTimelineBackgroundClick() {
    setSelectedAppt(null);
  }

  function handleCloseKarteDock() {
    setSelectedAppt(null);
    setIsEditingSelectedAppt(false);
    setOriginalSelectedAppt(null);
  }

  const handleEditSelectedAppt = () => {
    setOriginalSelectedAppt({ ...selectedAppt });
    setIsEditingSelectedAppt(true);
  };

  const handleCancelSelectedApptEdit = () => {
    if (originalSelectedAppt) {
      setAppointments((prev) => prev.map((a) => (a.id === originalSelectedAppt.id ? originalSelectedAppt : a)));
      setSelectedAppt(originalSelectedAppt);
    }
    setIsEditingSelectedAppt(false);
    setOriginalSelectedAppt(null);
  };

  const handleSelectedApptFieldChange = (field, value) => {
    if (!selectedAppt) return;
    const updated = { ...selectedAppt, [field]: value };
    if (field === 'start_time') updated.start_min = hhmmToMinutes(value);
    if (field === 'end_time') updated.end_min = hhmmToMinutes(value);

    setSelectedAppt(updated);
    // タイムラインに即時反映
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleSaveSelectedApptEdit = async () => {
    if (!selectedAppt) return;
    setIsSavingKarte(true);
    try {
      const token = getToken();
      const base = API_BASE.replace(/\/$/, '');
      const scheduleId = selectedAppt.schedule_id || selectedAppt.id;
      const cleanerIds = selectedAppt.cleaner_ids || (selectedAppt.cleaner_id ? [selectedAppt.cleaner_id] : []);

      if (cleanerIds.length === 0) {
        alert('清掃員を1人以上選択してください');
        setIsSavingKarte(false);
        return;
      }

      // 最初の清掃員で既存のスケジュールを更新
      const payload = {
        date: selectedAppt.date,
        scheduled_date: selectedAppt.date,
        start_time: selectedAppt.start_time || minutesToHHMM(selectedAppt.start_min),
        end_time: selectedAppt.end_time || minutesToHHMM(selectedAppt.end_min),
        start_min: selectedAppt.start_min,
        end_min: selectedAppt.end_min,
        work_type: selectedAppt.work_type,
        target_name: selectedAppt.target_name,
        store_id: selectedAppt.store_id || null,
        worker_id: cleanerIds[0],
        assigned_to: cleanerIds[0],
        worker_ids: cleanerIds,
        status: normalizeYoteiStatus(selectedAppt.status),
        dispatch_status: selectedAppt.dispatch_status || normalizeDispatchStatusFromSchedule(selectedAppt.status),
        description: selectedAppt.memo || selectedAppt.notes || '',
      };

      console.log('[AdminScheduleTimeline] Saving update via KarteDock:', payload);

      const res = await fetch(`${base}/yotei/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const dispatchStatus = payload.dispatch_status || normalizeDispatchStatusFromSchedule(payload.status);
      await Promise.all(
        cleanerIds.map((cid) => upsertDispatchStatus({
          scheduleId,
          workerId: cid,
          storeId: selectedAppt.store_id,
          workType: selectedAppt.work_type,
          isoStartAt: `${selectedAppt.date}T${minutesToHHMM(selectedAppt.start_min)}:00`,
          status: dispatchStatus,
        }).catch((e) => {
          console.warn('[AdminScheduleTimeline] dispatch sync failed (karte edit):', e);
        }))
      );

      // 2番目以降の清掃員がいる場合、新規作成（AppointmentModal.saveModalのロジックと同様）
      if (cleanerIds.length > 1) {
        for (let i = 1; i < cleanerIds.length; i++) {
          const extraPayload = { ...payload, worker_id: cleanerIds[i], assigned_to: cleanerIds[i] };
          await fetch(`${base}/yotei`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(extraPayload),
          });
        }
      }

      // 最新状態を再読み込み
      await loadSchedulesFromAPI(selectedAppt.date);

      setIsEditingSelectedAppt(false);
      setOriginalSelectedAppt(null);
      alert('変更を保存しました');
    } catch (err) {
      console.error('[AdminScheduleTimeline] Karte edit save failed:', err);
      alert(`保存に失敗しました: ${err.message}`);
    } finally {
      setIsSavingKarte(false);
    }
  };

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

  // blocks 機能は一時停止中（再開時に専用仕様で復帰）

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
              <div style={{ fontSize: '0.75em', color: 'var(--muted)', marginTop: '4px' }}>
                清掃サイクル『🌙:16:00-翌04:00』『☀️:04:00-16:00』16:00以降は翌営業日案件
              </div>
              {houkokuSaveError && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #ef4444',
                  borderRadius: '4px',
                  fontSize: '0.85em',
                  color: '#b91c1c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span>⚠️ {houkokuSaveError.message}</span>
                  <button
                    onClick={() => createHoukokuDrafts(houkokuSaveError.schedule, houkokuSaveError.workerIds)}
                    style={{
                      padding: '2px 8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    再実行
                  </button>
                  <button
                    onClick={() => setHoukokuSaveError(null)}
                    style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    閉じる
                  </button>
                </div>
              )}
            </div>
            <div className="headerActions">
              {view === 'week' ? (
                <>
                  <button type="button" className="btn" onClick={() => shiftWeek(-1)}>← 前週</button>
                  <button type="button" className="btn" onClick={jumpThisWeek}>今週</button>
                  <button type="button" className="btn" onClick={() => shiftWeek(1)}>翌週 →</button>
                  <button type="button" className="btn" onClick={() => setView('day')} title="日別のタイムラインに戻る">日別表示</button>
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
                  <button type="button" className="btn" onClick={() => setView('week')} title="週間予定を見る">週間予定閲覧</button>
                </>
              )}
              <button type="button" className="btnPrimary" onClick={() => openCreate(filterCleaner !== 'all' ? filterCleaner : cleanersWithUnit[0]?.id)}>＋ 割当追加</button>
              <button type="button" className="btn" onClick={() => setIcsImportModal({ open: true })}>📅 Googleカレンダー取り込み</button>
              <button type="button" className="btn" onClick={() => {
                const icsSchedules = appointments.filter(a => a.origin === 'google_ics');
                if (icsSchedules.length === 0) {
                  alert('Googleカレンダーから取り込んだスケジュールがありません');
                  return;
                }
                // 全メールアドレスを抽出
                const allEmails = new Set();
                icsSchedules.forEach(schedule => {
                  if (schedule.attendee_emails && schedule.attendee_emails.length > 0) {
                    schedule.attendee_emails.forEach(email => allEmails.add(email));
                  }
                });
                setEmailListModal({ open: true, emails: Array.from(allEmails).sort(), schedules: icsSchedules });
              }}>📧 参加者メールアドレス一覧</button>
              <button type="button" className="btn" onClick={() => {
                const unassigned = appointments.filter(a => !a.cleaner_id && a.origin === 'google_ics');
                if (unassigned.length === 0) {
                  alert('未割り当てのスケジュールがありません');
                  return;
                }
                setUnassignedModal({ open: true, schedules: unassigned });
              }}>👤 未割り当て清掃員割り当て</button>
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
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="4" width="4" height="3" rx="0.5" /><rect x="8" y="6" width="4" height="3" rx="0.5" /><rect x="14" y="8" width="4" height="3" rx="0.5" /></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')} title="週" aria-pressed={view === 'week'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="1" y="4" width="2.5" height="12" rx="0.5" /><rect x="5" y="4" width="2.5" height="12" rx="0.5" /><rect x="9" y="4" width="2.5" height="12" rx="0.5" /><rect x="13" y="4" width="2.5" height="12" rx="0.5" /><rect x="17" y="4" width="2.5" height="12" rx="0.5" /></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} title="一覧" aria-pressed={view === 'list'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="3" width="16" height="2" rx="0.5" /><rect x="2" y="9" width="16" height="2" rx="0.5" /><rect x="2" y="15" width="16" height="2" rx="0.5" /></svg>
                  </button>
                  <button type="button" className={`viewSwitcherBtn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')} title="月（簡易）" aria-pressed={view === 'month'}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><rect x="2" y="2" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><rect x="4" y="5" width="2.5" height="2.5" rx="0.3" /><rect x="8" y="5" width="2.5" height="2.5" rx="0.3" /><rect x="12" y="5" width="2.5" height="2.5" rx="0.3" /><rect x="4" y="9" width="2.5" height="2.5" rx="0.3" /><rect x="8" y="9" width="2.5" height="2.5" rx="0.3" /><rect x="12" y="9" width="2.5" height="2.5" rx="0.3" /></svg>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className={`btn ${filterUnit !== 'all' || filterCleaner !== 'all' || filterStatus !== 'all' || filterWorkType !== 'all' || filterStore !== 'all' ? 'btnPrimary' : ''}`}
                onClick={() => setFilterOverlayOpen(true)}
                title="フィルター"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                  <path d="M1.5 3a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm2 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 9zm1 3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z" />
                </svg>
                フィルター
                {(filterUnit !== 'all' || filterCleaner !== 'all' || filterStatus !== 'all' || filterWorkType !== 'all' || filterStore !== 'all') && (
                  <span style={{ marginLeft: '4px', fontSize: '0.85em' }}>●</span>
                )}
              </button>
              <div className="summaryPills">
                <span className="pill">合計 {summary.total}</span>
                {STATUSES.map((s) => (
                  <span key={s.key} className="pill subtle">{s.label} {summary.byStatus.get(s.key) ?? 0}</span>
                ))}
                <span className="pill subtle" style={{ color: '#dc2626', fontWeight: 'bold' }}>清掃事故 {summary.recleanCount}</span>
                {summary.needsContractReviewCount > 0 && (
                  <span className="pill subtle" style={{ color: '#dc2626', fontWeight: 'bold' }}>要契約確認 {summary.needsContractReviewCount}</span>
                )}
                {summary.unassignedCount > 0 && (
                  <span className="pill subtle" style={{ color: '#f59e0b', fontWeight: 'bold' }}>未割り当て {summary.unassignedCount}</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* 清掃事故案件エリア（mainコンテナの上、全幅独立コンテナ） */}
        {(view === 'day' || view === 'week') && (() => {
          // 表示する予定リストを選択
          const appointmentsToShow = view === 'day' ? filteredAppointments : weekFilteredAppointments;

          const recleanEvents = appointmentsToShow.filter(a => {
            const isDaytime = isDaytimeEvent(a.start_min, a.end_min);
            const isReclean = a.work_type === '再清掃' || a.work_type === '再清掃案件';
            return isReclean && isDaytime;
          });

          return (
            <div className="recleanEventsContainer" style={{ width: '100%', padding: '12px 16px', background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9em', color: 'var(--accent-red)' }}>清掃事故案件:</span>
                {recleanEvents.length > 0 ? (
                  recleanEvents.map((appt) => {
                    const meta = executionStatusMetaFromAppt(appt);
                    const conflict = conflictIds.has(appt.id);
                    const store = appt.store_id ? stores.find((s) => String(s.id) === String(appt.store_id)) : null;
                    const client = appt.client_id ? clients.find((c) => String(c.id) === String(appt.client_id)) : null;
                    const brand = store?.brand_id ? brands.find((b) => String(b.id) === String(store.brand_id)) : null;
                    const brandName = brand?.name || store?.brand_name || '';
                    const storeName = store?.name || store?.store_name || appt.target_name || '';
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
                        className={`daytimeChip ${appt.is_accident ? 'accidentChip' : meta.colorClass} ${conflict ? 'conflict' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleScheduleCardClick(appt); }}
                        title={`${minutesToHHMM(appt.start_min)}-${minutesToHHMM(appt.end_min)} ${appt.target_name}`}
                      >
                        <span className="daytimeChipIcon">☀</span>
                        <span className="daytimeChipStore">{appt.target_name}</span>
                        <span>/</span>
                        <span className="daytimeChipTime">{minutesToHHMM(appt.start_min)}-{minutesToHHMM(appt.end_min)}</span>
                        {reminderDisplay && (
                          <>
                            <span>/</span>
                            <span className="daytimeChipReminders">{reminderDisplay}</span>
                          </>
                        )}
                        <span className="daytimeChipStatus">({meta.label})</span>
                        {conflict && <span className="daytimeChipWarn">⚠</span>}
                      </button>
                    );
                  })
                ) : (
                  <span style={{ color: 'var(--muted)', fontSize: '0.9em' }}>清掃事故案件なし</span>
                )}
              </div>
            </div>
          );
        })()}

        <main className="main">
          {view === 'day' && (
            <div className="grid">
              <div className="pcOnly">
                <DayTimelinePC
                  dateISO={dateISO}
                  cleaners={cleanersWithUnit}
                  timelineUnitColumns={timelineUnitColumns}
                  appointments={filteredAppointments}
                  blocks={[]}
                  conflictIds={conflictIds}
                  activeScheduleId={selectedAppt?.schedule_id ?? null}
                  onCardClick={handleScheduleCardClick}
                  onBackgroundClick={handleTimelineBackgroundClick}
                  onCreate={openCreate}
                  onOpenBlockModalWithSlot={undefined}
                  stores={stores}
                  clients={clients}
                  brands={brands}
                  timelinePart={timelinePart}
                  onTimelinePartChange={setTimelinePart}
                />
              </div>
              <div className="spOnly">
                <DayTimelineSP
                  dateISO={dateISO}
                  cleaners={cleanersWithUnit}
                  activeCleanerId={activeCleanerSP}
                  setActiveCleanerId={setActiveCleanerSP}
                  appointments={filteredAppointments}
                  blocks={[]}
                  conflictIds={conflictIds}
                  activeScheduleId={selectedAppt?.schedule_id ?? null}
                  onCardClick={handleScheduleCardClick}
                  onCreate={openCreate}
                  onOpenBlockModalWithSlot={undefined}
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
              apiBase={API_BASE}
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
            <MonthSimple dateISO={dateISO} setDateISO={setDateISO} appointments={appointments} />
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
              <div className="karteDockHeaderTitle">スケジュール詳細 ＆ お客様カルテ</div>
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
                <div style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="kdSectionTitle" style={{ fontSize: '1.1em', color: '#647fff', borderLeft: '4px solid #647fff', paddingLeft: '8px', margin: 0 }}>
                      {isEditingSelectedAppt ? 'スケジュール詳細 (編集)' : 'スケジュール詳細'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!isEditingSelectedAppt ? (
                        <>
                          <button type="button" className="btn small" style={{ padding: '4px 8px', fontSize: '0.85em' }} onClick={handleEditSelectedAppt}>編集</button>
                          <button type="button" className="btnDanger small" style={{ padding: '4px 8px', fontSize: '0.85em' }} onClick={() => { if (window.confirm('このスケジュールを削除しますか？')) deleteAppt(selectedAppt.id); }}>削除</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btnPrimary small" style={{ padding: '4px 8px', fontSize: '0.85em' }} onClick={handleSaveSelectedApptEdit} disabled={isSavingKarte}>保存</button>
                          <button type="button" className="btn small" style={{ padding: '4px 8px', fontSize: '0.85em' }} onClick={handleCancelSelectedApptEdit}>停止</button>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditingSelectedAppt ? (
                    <>
                      <div className="kdTitle" style={{ fontSize: '1.4em', marginBottom: '8px' }}>{selectedAppt.target_name ?? '—'}</div>
                      <div className="kdMeta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div><span className="kdInfoLabel">日付：</span>{selectedAppt.date ?? '—'}</div>
                        <div><span className="kdInfoLabel">時間：</span>{minutesToHHMM(selectedAppt.start_min)}〜{minutesToHHMM(selectedAppt.end_min)}</div>
                        <div><span className="kdInfoLabel">プラン：</span>{selectedAppt.work_type ?? '—'}</div>
                        <div><span className="kdInfoLabel">ID：</span><span style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{selectedAppt.schedule_id || selectedAppt.id || '—'}</span></div>
                        {(() => {
                          const storeId = selectedAppt?.store_id;
                          const store = storeId ? selectedStore : null;
                          const plan = store?.plan || store?.plan_name || '';
                          return plan ? <div><span className="kdInfoLabel">店舗契約プラン：</span>{plan}</div> : null;
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="kdEditForm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="kdTitle" style={{ gridColumn: 'span 2', fontSize: '1.4em', marginBottom: '4px' }}>{selectedAppt.target_name ?? '—'}</div>
                      <label className="field" style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '11px' }}>日付</span>
                        <input type="date" value={selectedAppt.date} onChange={(e) => handleSelectedApptFieldChange('date', e.target.value)} style={{ padding: '6px', fontSize: '0.9em' }} />
                      </label>
                      <div className="field" style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '11px' }}>時間</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input type="time" value={selectedAppt.start_time || minutesToHHMM(selectedAppt.start_min)} onChange={(e) => handleSelectedApptFieldChange('start_time', e.target.value)} style={{ padding: '6px', fontSize: '0.9em', width: '45%' }} />
                          <span>〜</span>
                          <input type="time" value={selectedAppt.end_time || minutesToHHMM(selectedAppt.end_min)} onChange={(e) => handleSelectedApptFieldChange('end_time', e.target.value)} style={{ padding: '6px', fontSize: '0.9em', width: '45%' }} />
                        </div>
                      </div>
                      <label className="field" style={{ minWidth: 0, gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '11px' }}>プラン</span>
                        <select value={selectedAppt.work_type} onChange={(e) => handleSelectedApptFieldChange('work_type', e.target.value)} style={{ padding: '6px', fontSize: '0.9em' }}>
                          {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <div className="field" style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '11px' }}>担当作業員 (追加・変更)</span>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          padding: '12px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '12px',
                          border: '1px solid var(--line)',
                          maxHeight: '140px',
                          overflowY: 'auto'
                        }}>
                          {cleanersWithUnit.map(c => {
                            const currentIds = selectedAppt.cleaner_ids || (selectedAppt.cleaner_id ? [selectedAppt.cleaner_id] : []);
                            const isSelected = currentIds.some(id => String(id) === String(c.id));
                            return (
                              <label key={c.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                background: isSelected ? 'rgba(100,140,255,0.1)' : 'transparent',
                                borderRadius: '16px',
                                border: `1px solid ${isSelected ? 'rgba(100,140,255,0.3)' : 'var(--line)'}`,
                                cursor: 'pointer',
                                fontSize: '0.85em',
                                color: isSelected ? '#a0c0ff' : 'var(--text)',
                                transition: 'all 0.2s'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newIds = e.target.checked
                                      ? [...currentIds.map(String), String(c.id)]
                                      : currentIds.map(String).filter(id => id !== String(c.id));

                                    if (newIds.length === 0) {
                                      alert('少なくとも1人の作業員を選択してください');
                                      return;
                                    }

                                    const updated = {
                                      ...selectedAppt,
                                      cleaner_id: newIds[0],
                                      cleaner_ids: newIds
                                    };
                                    setSelectedAppt(updated);
                                    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
                                  }}
                                />
                                {c.name}
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                          ※複数選択して保存すると、人数分の割り当てが新規作成されます。
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="kdTwoColumnGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="kdLeftColumn">
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
                          <div className="kdSectionTitle">店舗情報</div>
                          {storeName && <div className="kdInfoRow"><span className="kdInfoLabel">店舗：</span>{storeName}</div>}
                          {brandName && <div className="kdInfoRow"><span className="kdInfoLabel">ブランド：</span>{brandName}</div>}
                          {clientName && <div className="kdInfoRow"><span className="kdInfoLabel">法人：</span>{clientName}</div>}
                          {phone && <div className="kdInfoRow"><span className="kdInfoLabel">電話：</span>{phone}</div>}
                        </>
                      );
                    })()}

                    <div className="kdSectionTitle">清掃担当</div>
                    <div className="kdInfoRow" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(() => {
                        const cleanerIds = selectedAppt?.cleaner_ids || (selectedAppt?.cleaner_id ? [selectedAppt.cleaner_id] : []);
                        return cleanerIds.map(id => cleanersWithUnit.find(c => String(c.id) === String(id))).filter(Boolean).map(c => (
                          <span key={c.id} style={{ background: 'rgba(100,150,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85em', border: '1px solid rgba(100,150,255,0.2)' }}>
                            {c.name}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="kdRightColumn">
                    <div className="kdSectionTitle">事前連絡</div>
                    <div className="kdContactReminders" style={{ marginBottom: '12px' }}>
                      {['7日前', '3日前', '1日前'].map((reminder) => {
                        const isChecked = (selectedAppt.contact_reminders || []).includes(reminder);
                        return (
                          <label key={reminder} className="kdReminderCheckbox" style={{ marginRight: '10px' }}>
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
                      const storeId = selectedAppt?.store_id;
                      const store = storeId ? selectedStore : null;
                      const securityBox = store?.security_box || store?.security_box_number || store?.box_number || '';
                      const extractedSecurityCode = selectedAppt.security_code;

                      if (securityBox || extractedSecurityCode) {
                        return (
                          <>
                            <div className="kdSectionTitle" style={{ color: '#ec4899', borderLeft: '4px solid #ec4899', paddingLeft: '8px' }}>🔑 キーボックス</div>
                            <div className="kdInfoRow">
                              <span>{securityBox || '（顧客DB未登録）'}</span>
                            </div>
                            {extractedSecurityCode && (
                              <div className="kdInfoRow" style={{ color: '#f59e0b', fontSize: '0.85em', marginTop: '4px', background: 'rgba(245, 158, 11, 0.1)', padding: '4px', borderRadius: '4px' }}>
                                <span>抽出：<b>{extractedSecurityCode}</b></span>
                              </div>
                            )}
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {selectedAppt.notes && (
                  <div style={{ marginTop: '12px' }}>
                    <div className="kdSectionTitle" style={{ color: '#3a6cff', borderLeft: '4px solid #3a6cff', paddingLeft: '8px' }}>カレンダー指示事項</div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', fontSize: '0.85em', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {selectedAppt.notes}
                    </div>
                  </div>
                )}

                {(() => {
                  const storeId = selectedAppt.store_id;
                  if (!storeId) return null;
                  const storeHistory = appointments
                    .filter(a => String(a.store_id) === String(storeId) && a.id !== selectedAppt.id)
                    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());

                  if (storeHistory.length === 0) return null;

                  return (
                    <div style={{ marginTop: '16px' }}>
                      <div className="kdSectionTitle" style={{ color: '#f59e0b', borderLeft: '4px solid #f59e0b', paddingLeft: '8px' }}>この現場の前後予定</div>
                      <div className="kdHistoryList" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {storeHistory.map(h => (
                          <div
                            key={h.id}
                            className="kdHistoryItem"
                            style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85em', display: 'flex', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                            onClick={() => {
                              setDateISO(h.date);
                              setSelectedAppt(h);
                            }}
                          >
                            <span>📅 {h.date}</span>
                            <span>🕒 {minutesToHHMM(h.start_min)}〜</span>
                            <span style={{ color: 'var(--muted)' }}>{h.work_type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="karteDockRight">
                <div className="kdSectionTitle" style={{ fontSize: '1.1em', color: '#10b981', borderLeft: '4px solid #10b981', paddingLeft: '8px', marginBottom: '12px' }}>お客様カルテ</div>
                <div className="kdRightTop">
                  <div className="kdMemberList" style={{ display: 'none' }}>
                    {(selectedAppt.cleaner_ids || (selectedAppt.cleaner_id ? [selectedAppt.cleaner_id] : [])).map(cid => {
                      const c = cleanersWithUnit.find((cl) => cl.id === cid);
                      return (
                        <span key={cid} className="kdChip">
                          {c?.name ?? cid}
                        </span>
                      );
                    })}
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
            dateISO={dateISO}
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

        {filterOverlayOpen && (
          <FilterOverlay
            filterUnit={filterUnit}
            setFilterUnit={setFilterUnit}
            filterCleaner={filterCleaner}
            setFilterCleaner={setFilterCleaner}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterWorkType={filterWorkType}
            setFilterWorkType={setFilterWorkType}
            filterStore={filterStore}
            setFilterStore={setFilterStore}
            cleanersForFilter={cleanersForFilter}
            stores={stores}
            brands={brands}
            onClose={() => setFilterOverlayOpen(false)}
          />
        )}

        {emailListModal.open && (
          <EmailListModal
            emails={emailListModal.emails || []}
            schedules={emailListModal.schedules || []}
            onClose={() => setEmailListModal({ open: false })}
          />
        )}

        {unassignedModal.open && (
          <UnassignedSchedulesModal
            schedules={unassignedModal.schedules || []}
            cleaners={cleanersWithUnit}
            onClose={async () => {
              setUnassignedModal({ open: false });
              // モーダルを閉じた後にスケジュールを再読み込み（割り当てが完了している場合）
              await loadSchedulesFromAPI(dateISO);
            }}
            onAssign={async (scheduleId, workerId, isFirst) => {
              const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
              const base = API_BASE.replace(/\/$/, '');

              try {
                if (isFirst) {
                  // 最初の清掃員: 既存のスケジュールを更新
                  const updateResponse = await fetch(`${base}/yotei/${scheduleId}`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      worker_id: workerId,
                      assigned_to: workerId
                    })
                  });

                  if (!updateResponse.ok) {
                    throw new Error(`HTTP ${updateResponse.status}`);
                  }
                } else {
                  // 2番目以降の清掃員: 新しいスケジュールを作成
                  // まず元のスケジュール情報を取得
                  const getResponse = await fetch(`${base}/yotei/${scheduleId}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                    },
                  });

                  if (!getResponse.ok) {
                    throw new Error(`Failed to fetch schedule: HTTP ${getResponse.status}`);
                  }

                  const originalSchedule = await getResponse.json();
                  const schedule = originalSchedule.schedule || originalSchedule;

                  // 新しいスケジュールを作成
                  const newScheduleData = {
                    date: schedule.scheduled_date || schedule.date,
                    scheduled_date: schedule.scheduled_date || schedule.date,
                    time_slot: schedule.scheduled_time || schedule.time_slot || `${schedule.start_time || '09:00'}-${schedule.end_time || '10:00'}`,
                    scheduled_time: schedule.scheduled_time || schedule.time_slot || `${schedule.start_time || '09:00'}-${schedule.end_time || '10:00'}`,
                    start_time: schedule.start_time || minutesToHHMM(schedule.start_min || 540),
                    end_time: schedule.end_time || minutesToHHMM(schedule.end_min || 600),
                    start_min: schedule.start_min,
                    end_min: schedule.end_min,
                    duration_minutes: schedule.duration_minutes || 60,
                    store_id: schedule.store_id,
                    client_id: schedule.client_id || schedule.store_id,
                    store_name: schedule.store_name || schedule.target_name,
                    client_name: schedule.client_name,
                    brand_name: schedule.brand_name,
                    address: schedule.address,
                    phone: schedule.phone,
                    email: schedule.email,
                    work_type: schedule.work_type || 'その他',
                    work_content: schedule.work_content || schedule.memo || '',
                    notes: schedule.notes || schedule.memo || '',
                    status: normalizeYoteiStatus(schedule.status),
                    worker_id: workerId,
                    assigned_to: workerId,
                    origin: schedule.origin || 'manual',
                    external_id: schedule.external_id,
                    attendee_emails: schedule.attendee_emails || [],
                  };

                  const createResponse = await fetch(`${base}/yotei`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newScheduleData)
                  });

                  if (!createResponse.ok) {
                    throw new Error(`Failed to create schedule: HTTP ${createResponse.status}`);
                  }
                }

                // 最後の割り当てが完了したらスケジュールを再読み込み
                // 注意: 複数の割り当てがある場合、各割り当てごとに再読み込みすると非効率なので、
                // handleAssign関数内で最後に1回だけ再読み込みする方が良い
                // しかし、現在の実装では各onAssign呼び出し後に再読み込みしている
                // 最適化が必要な場合は、handleAssign関数を変更する必要がある
              } catch (err) {
                console.error('[AdminScheduleTimeline] Failed to assign worker', err);
                throw err;
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
  const [importMode, setImportMode] = useState('url'); // 'url' or 'content'
  const [icsUrl, setIcsUrl] = useState('');
  const [icsContent, setIcsContent] = useState('');
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
    if (importMode === 'url' && !icsUrl.trim()) {
      setError('ICS URLを入力してください');
      return;
    }
    if (importMode === 'content' && !icsContent.trim()) {
      setError('ICSの内容を入力してください');
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

      const body = {
        from: fromDate,
        to: toDate,
        dry_run: isDryRun
      };

      if (importMode === 'url') {
        body.ics_url = icsUrl.trim();
      } else {
        body.ics_content = icsContent.trim();
      }

      const response = await fetch(`${apiBase}/admin/import/google-ics`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
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
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: '700px' }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">カレンダー取り込み (ICS)</div>
            <div className="muted">GoogleカレンダーのURL、またはICSファイルを直接貼り付けて取り込みます</div>
          </div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modalBody">
          {error && (
            <div className="modalConflictError" role="alert" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              className={`btn ${importMode === 'url' ? 'btnPrimary' : ''}`}
              onClick={() => setImportMode('url')}
              style={{ flex: 1 }}
            >
              URLから取得
            </button>
            <button
              className={`btn ${importMode === 'content' ? 'btnPrimary' : ''}`}
              onClick={() => setImportMode('content')}
              style={{ flex: 1 }}
            >
              内容を直接貼り付け
            </button>
          </div>

          {result && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(100, 150, 255, 0.1)', border: '1px solid rgba(100, 150, 255, 0.3)', borderRadius: '8px' }}>
              {result.dry_run ? (
                <>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#3a6cff' }}>✨ プレビュー結果</div>
                  <div>対象イベント: {result.found}件 見つかりました</div>
                  <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginTop: '4px' }}>
                    期間: {result.range?.from} 〜 {result.range?.to}
                  </div>
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
            {importMode === 'url' ? (
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
            ) : (
              <label className="field span2">
                <span>ICSの内容（カレンダーデータ全文）</span>
                <textarea
                  value={icsContent}
                  onChange={(e) => setIcsContent(e.target.value)}
                  placeholder="BEGIN:VCALENDAR..."
                  disabled={loading}
                  rows={8}
                  style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', resize: 'vertical' }}
                />
              </label>
            )}
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
                disabled={loading || (importMode === 'url' ? !icsUrl.trim() : !icsContent.trim())}
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
                  disabled={loading || (importMode === 'url' ? !icsUrl.trim() : !icsContent.trim())}
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

function DayTimelinePC({ dateISO, cleaners, timelineUnitColumns, appointments, blocks, conflictIds, activeScheduleId, onCardClick, onBackgroundClick, onCreate, onOpenBlockModalWithSlot, stores = [], clients = [], brands = [], timelinePart = 'night', onTimelinePartChange }) {
  // 12時間表示を「日勤/夜勤」で分割
  // ☀️ 日勤: 04:00〜16:00
  // 🌙 夜勤: 16:00〜翌04:00
  const isDayShift = timelinePart === 'day';
  const dayStart = isDayShift ? 4 * 60 : 16 * 60;
  const dayEnd = isDayShift ? 16 * 60 : 4 * 60;
  const step = 60;              // 1時間間隔
  const rows = [];

  // 時間行を生成（夜勤は日跨ぎ）
  if (isDayShift) {
    for (let t = dayStart; t < dayEnd; t += step) {
      rows.push(t);
    }
  } else {
    for (let t = dayStart; t < 24 * 60; t += step) {
      rows.push(t);
    }
    for (let t = 0; t < dayEnd; t += step) {
      rows.push(t);
    }
  }


  const { cleaning: cleaningCols, maintenance: maintenanceCols } = timelineUnitColumns ?? { cleaning: cleaners.filter((c) => c.unit === 'cleaning'), maintenance: cleaners.filter((c) => c.unit === 'maintenance') };

  // 昼イベント（再清掃案件のみ）とタイムライン表示用の案件を分離
  const { daytimeEvents, timelineAppointments } = useMemo(() => {
    const recleanEvents = []; // 再清掃案件のみ（イベントタグ用）
    const timelineAppts = []; // タイムラインに表示する案件

    // 案件を分類
    for (const a of appointments) {
      const isReclean = a.is_accident || a.work_type === '再清掃' || a.work_type === '再清掃案件';
      const isDaytime = isDaytimeEvent(a.start_min, a.end_min);

      // 上部の「清掃事故案件」リストに表示する条件
      if (isReclean && isDaytime) {
        recleanEvents.push(a);
      }

      // AM/PM時間帯フィルタリング
      let overlapsTimeRange = false;
      if (isDayShift) {
        // 日勤(04:00-16:00)
        overlapsTimeRange = a.start_min >= 4 * 60 && a.start_min < 16 * 60;
      } else {
        // 夜勤(16:00-翌04:00)
        overlapsTimeRange = a.start_min >= 16 * 60 || a.start_min < 4 * 60;
      }
      if (overlapsTimeRange) {
        timelineAppts.push(a);
      }
    }

    return {
      daytimeEvents: recleanEvents, // 再清掃案件のみ
      timelineAppointments: timelineAppts
    };
  }, [appointments, dateISO, dayStart, dayEnd]);


  const byCleanerItems = useMemo(() => {
    const map = new Map();
    for (const d of cleaners) map.set(d.id, []);

    // タイムラインに表示する案件を追加
    for (const a of timelineAppointments) {
      const cIds = a.cleaner_ids && a.cleaner_ids.length > 0 ? a.cleaner_ids : (a.cleaner_id ? [a.cleaner_id] : []);

      let assigned = false;
      for (const cId of cIds) {
        if (map.has(cId)) {
          map.get(cId).push({ type: 'appointment', data: a, start_min: a.start_min, end_min: a.end_min });
          assigned = true;
        }
      }

      // マッチする清掃員がいない場合、最初の清掃員（未割当行）に割り当て
      if (!assigned && cleaners.length > 0) {
        map.get(cleaners[0].id)?.push({ type: 'appointment', data: a, start_min: a.start_min, end_min: a.end_min });
      }
    }
    for (const [, list] of map.entries()) {
      list.sort((x, y) => x.start_min - y.start_min);
    }
    return map;
  }, [cleaners, timelineAppointments]);


  // 全清掃員を縦に並める（梅岡ユニット → 遠藤ユニットの順）
  const allCleaners = [...cleaningCols, ...maintenanceCols];
  const allCleanerRows = useMemo(() => {
    return allCleaners.map((c) => ({
      cleaner: c,
      unit: getUnitFromName(c.name),
      items: byCleanerItems.get(c.id) ?? []
    }));
  }, [allCleaners, byCleanerItems]);

  return (
    <section className={`timelinePC timelinePCHorizontal ${isDayShift ? 'timelinePart-day' : 'timelinePart-night'}`}>
      <div className="timelinePCContainerHorizontal">
        {/* 左側：名簿（縦並び） */}
        <div className="timelineNameListContainer">
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
          {/* 時間ヘッダー（上部、横並び） */}
          <div className="timelineTimeHeaderHorizontal">
            {rows.map((t, idx) => (
              <div key={`${t}-${idx}`} className="timeHeaderCell">
                <span style={{ marginRight: '4px' }}>{isDayShift ? '☀️' : '🌙'}</span>
                {minutesToHHMM(t)}
              </div>
            ))}
          </div>

          {/* タイムライン本体（横スクロール可能） */}
          <div className="timelineTimeBodyContainer" onClick={onBackgroundClick} role="presentation">
            {allCleanerRows.map((row) => (
              <CleanerRow
                key={row.cleaner.id}
                cleaner={row.cleaner}
                cleaners={cleaners}
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
                isDayShift={isDayShift}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="legend" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span className="legendTitle">凡例:</span>
        {STATUSES.map((s) => (
          <span key={s.key} className={`legendItem ${s.colorClass}`}>{s.label}</span>
        ))}
        <span className="legendItem s-conflict">重複⚠</span>
        <span className="legendItem unit-cleaning-legend">清掃</span>
        <span className="legendItem unit-maintenance-legend">メンテナンス</span>
        {onTimelinePartChange && (
          <div style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className={`btn ${timelinePart === 'night' ? 'btnPrimary' : ''}`}
              onClick={() => onTimelinePartChange(timelinePart === 'day' ? 'night' : 'day')}
              title={timelinePart === 'day' ? '夜勤に切り替え' : '日勤に切り替え'}
              style={{ minWidth: '100px', fontSize: '0.9em' }}
            >
              {timelinePart === 'day' ? '🌙 夜勤 16-04' : '☀️ 日勤 04-16'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function CleanerRow({ cleaner, cleaners = [], rows, dayStart, dayEnd, items, conflictIds, activeScheduleId, onCardClick, onSlotClick, onSlotRightClick, stores = [], clients = [], brands = [], isDayShift = false }) {
  const start = dayStart || 0;
  const end = dayEnd || 1440;
  const duration = end >= start ? (end - start) : ((24 * 60 - start) + end);
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

  const pxPerMin = rowWidth > 0 ? rowWidth / duration : 0;

  // 時間をoffsetMinに変換する関数（16:00境界対応）
  const toOffsetMin = (min) => {
    if (!isDayShift) {
      // 夜勤パート(16:00-04:00): 16:00が0、04:00が720(12時間後)
      if (min >= 16 * 60) {
        return min - 16 * 60;
      } else {
        // 0:00-04:00は24時間足して16:00からのオフセットに
        return min + 24 * 60 - 16 * 60;
      }
    } else {
      // 日勤パート(04:00-16:00): 04:00が0
      return min - 4 * 60;
    }
  };

  return (
    <div className="cleanerRow" ref={rowRef}>
      <div className="cleanerRowGrid">
        {rows.map((t, idx) => {
          // 表示上の時間tはそのまま使用（dayStartから始まる連続した時間）
          return (
            <button
              key={`${t}-${idx}`}
              type="button"
              className="slotCellHorizontal"
              onClick={(e) => { e.stopPropagation(); onSlotClick?.(cleaner.id, t); }}
              aria-label={`${minutesToHHMM(t)}に割当追加`}
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
            const meta = executionStatusMetaFromAppt(a);
            const conflict = conflictIds.has(a.id);
            const isLinked = activeScheduleId != null && a.schedule_id === activeScheduleId;

            // 清掃員情報を取得
            const cleaner = cleaners.find((c) => String(c.id) === String(a.cleaner_id));
            const cleanerName = cleaner?.name || '';

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

            // 作業中の場合、清掃員名を表示
            const isInProgress = a.status === 'in_progress';

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
                    <span className="apptStore">{a.target_name}</span>
                    <span className="apptSeparator">/</span>
                    <span className="apptTime">{minutesToHHMM(a.start_min)}–{minutesToHHMM(a.end_min)}</span>
                    {reminderDisplay && (
                      <>
                        <span className="apptSeparator">/</span>
                        <span className="apptReminders">{reminderDisplay}</span>
                      </>
                    )}
                  </div>
                  {isInProgress && cleanerName && (
                    <div className="apptWorkerBadge" style={{ marginTop: '4px', fontSize: '0.85em', fontWeight: '600', color: '#f59e0b' }}>
                      🔨 {cleanerName} 作業中
                    </div>
                  )}
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
                >
                  空き（タップで割当追加）
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
                  const meta = executionStatusMetaFromAppt(a);
                  const conflict = conflictIds.has(a.id);
                  const isLinked = activeScheduleId != null && a.schedule_id === activeScheduleId;

                  // 清掃員情報を取得
                  const cleaner = cleaners.find((c) => String(c.id) === String(a.cleaner_id));
                  const cleanerName = cleaner?.name || '';

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

                  // 作業中の場合、清掃員名を表示
                  const isInProgress = a.status === 'in_progress';

                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`spAppt scheduleCard ${meta.colorClass} ${conflict ? 'conflict' : ''} ${isLinked ? 'is-linked' : ''}`}
                      onClick={() => onCardClick(a)}
                    >
                      <div className="spApptSingleLine">
                        <span className="spApptStore">{a.target_name}</span>
                        <span>/</span>
                        <span className="spApptTime">{minutesToHHMM(a.start_min)}–{minutesToHHMM(a.end_min)}</span>
                        {reminderDisplay && (
                          <>
                            <span>/</span>
                            <span className="spApptReminders">{reminderDisplay}</span>
                          </>
                        )}
                      </div>
                      {isInProgress && cleanerName && (
                        <div style={{ marginTop: '4px', fontSize: '0.85em', fontWeight: '600', color: '#f59e0b' }}>
                          🔨 {cleanerName} 作業中
                        </div>
                      )}
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
          const meta = executionStatusMetaFromAppt(a);
          const conflict = conflictIds.has(a.id);
          const isInProgress = a.status === 'in_progress';
          return (
            <button key={a.id} type="button" className="row body" onClick={() => onCardClick?.(a)}>
              <div>{minutesToHHMM(a.start_min)}–{minutesToHHMM(a.end_min)}</div>
              <div className="strong">{a.target_name}</div>
              <div>
                {d?.name ?? '-'}
                {isInProgress && d?.name && (
                  <span style={{ marginLeft: '4px', fontSize: '0.85em', fontWeight: '600', color: '#f59e0b' }}>
                    🔨 作業中
                  </span>
                )}
              </div>
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

function WeekView({ dateISO, setDateISO, rollingDays, cleaners, appointments, conflictIds, onCardClick, onCreate, apiBase }) {
  const byDate = useMemo(() => {
    const map = new Map();
    for (const iso of rollingDays) map.set(iso, []);
    for (const a of appointments) map.get(a.date)?.push(a);
    for (const [, list] of map.entries()) {
      list.sort((x, y) => x.start_min - y.start_min);
    }
    return map;
  }, [rollingDays, appointments]);

  const [availabilityMatrixByDay, setAvailabilityMatrixByDay] = useState({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const workerIds = cleaners
        .map((c) => String(c?.id || '').trim())
        .filter((id) => id && id !== '__unassigned__');
      if (workerIds.length === 0 || rollingDays.length === 0) {
        if (!cancelled) setAvailabilityMatrixByDay({});
        return;
      }

      try {
        const from = rollingDays[0];
        const to = rollingDays[rollingDays.length - 1];
        const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
        const base = String(apiBase || '').replace(/\/$/, '');
        const url = `${base}/sales/availability-matrix?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&service=cleaning&worker_ids=${encodeURIComponent(workerIds.join(','))}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setAvailabilityMatrixByDay({});
          return;
        }
        const data = await res.json();
        const workers = Array.isArray(data?.workers) ? data.workers : [];
        const map = {};
        rollingDays.forEach((iso) => {
          let openCount = 0;
          let scheduledCount = 0;
          let closedCount = 0;
          workers.forEach((w) => {
            const status = String(w?.days?.[iso] || '').toLowerCase();
            if (status === 'scheduled') scheduledCount += 1;
            else if (status === 'open') openCount += 1;
            else closedCount += 1;
          });
          map[iso] = {
            freeCount: openCount,
            totalStaff: workerIds.length,
            isFull: openCount === 0,
            detailText: `休み ${closedCount}名 / 予定 ${scheduledCount}名`,
          };
        });
        if (!cancelled) setAvailabilityMatrixByDay(map);
      } catch {
        if (!cancelled) setAvailabilityMatrixByDay({});
      }
    };
    run();
    return () => { cancelled = true; };
  }, [apiBase, cleaners, rollingDays]);

  // 各日の空き状況（稼働していない清掃員の数 + 最大連続空き時間）を計算
  const availabilityData = useMemo(() => {
    if (Object.keys(availabilityMatrixByDay).length > 0) {
      return rollingDays.map((iso) => ({
        iso,
        freeCount: availabilityMatrixByDay[iso]?.freeCount ?? 0,
        totalStaff: availabilityMatrixByDay[iso]?.totalStaff ?? cleaners.length,
        isFull: !!availabilityMatrixByDay[iso]?.isFull,
        detailText: availabilityMatrixByDay[iso]?.detailText || '-',
      }));
    }

    const totalStaff = cleaners.length;
    return rollingDays.map(iso => {
      const dayAppts = byDate.get(iso) ?? [];

      // スタッフごとの予定を整理
      const cleanerSchedules = new Map(); // Map<cleanerId, Array<{start, end}>>
      cleaners.forEach(c => cleanerSchedules.set(String(c.id), []));

      dayAppts.forEach(a => {
        const ids = a.cleaner_ids ? a.cleaner_ids.map(String) : (a.cleaner_id ? [String(a.cleaner_id)] : []);
        ids.forEach(id => {
          if (cleanerSchedules.has(id)) {
            cleanerSchedules.get(id).push({ start: a.start_min, end: a.end_min });
          }
        });
      });

      let overallMaxContinuousMinutes = 0;
      let busyCount = 0;

      // 各スタッフの「最大連続空き時間」を計算（実働時間 09:00 - 21:00 = 720分間を想定）
      const WORK_DAY_START = 0; // システムの最小単位（実際は運用に合わせる、ここでは 0-1440）
      const WORK_DAY_END = 1440;

      cleanerSchedules.forEach((schList, cleanerId) => {
        if (schList.length > 0) busyCount++;

        // 予定を時間順にソート
        const sorted = [...schList].sort((a, b) => a.start - b.start);

        // 隙間を計算
        let currentPos = WORK_DAY_START;
        let maxGap = 0;

        sorted.forEach(s => {
          if (s.start > currentPos) {
            maxGap = Math.max(maxGap, s.start - currentPos);
          }
          currentPos = Math.max(currentPos, s.end);
        });

        if (WORK_DAY_END > currentPos) {
          maxGap = Math.max(maxGap, WORK_DAY_END - currentPos);
        }

        overallMaxContinuousMinutes = Math.max(overallMaxContinuousMinutes, maxGap);
      });

      const freeCount = Math.max(0, totalStaff - busyCount);
      // 未稼働のスタッフがいれば、その人は丸一日（1440分）空いている
      if (freeCount > 0) overallMaxContinuousMinutes = 1440;

      return {
        iso,
        freeCount,
        totalStaff,
        isFull: freeCount === 0 && overallMaxContinuousMinutes < 60, // 1時間未満しか空きがないならFULL扱い
        detailText: `最長連続 ${(overallMaxContinuousMinutes / 60).toFixed(1)}h`
      };
    });
  }, [rollingDays, byDate, cleaners, availabilityMatrixByDay]);

  function renderDayColumn(iso, isToday) {
    const dayAppts = byDate.get(iso) ?? [];
    const isActive = iso === dateISO;
    return (
      <div key={iso} className={`weekCol ${isActive ? 'active' : ''} ${isToday ? 'todayCol' : ''}`}>
        {isToday ? (
          <div className="todayBadge">TODAY</div>
        ) : (
          (() => {
            const diff = Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(rollingDays[0] + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
            if (diff === 1) return <div className="contactDayLabelOutside">1日前 連絡日</div>;
            if (diff === 3) return <div className="contactDayLabelOutside">3日前 連絡日</div>;
            if (diff === 7) return <div className="contactDayLabelOutside">7日前 連絡日</div>;
            return null;
          })()
        )}
        <button
          type="button"
          className="weekColHead"
          onClick={() => setDateISO(iso)}
          aria-pressed={isActive}
        >
          <span className="weekColDate">{isoToDateLabel(iso)}</span>
          <span className="weekColCount">{dayAppts.length}件</span>
        </button>
        <div className="weekColBody">
          {dayAppts.length === 0 ? (
            <div className="weekEmpty">割当なし</div>
          ) : (
            dayAppts.map((a) => {
              const meta = executionStatusMetaFromAppt(a);
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
      <div className="weekAvailabilityHeader">
        <div className="availabilityTitleContainer">
          <span className="availabilityTitleIcon">📊</span>
          <span className="availabilityTitle">スケジュールの空き状況</span>
          <span className="availabilitySubtitle">（稼働可能スタッフ数 / 全{cleaners.length}名）</span>
        </div>
        <div className="availabilityGrid">
          <div className="availabilityTodayCell">
            {availabilityData[0] && (
              <div className={`av-cell ${availabilityData[0].isFull ? 'is-full' : ''}`}>
                <div className="av-main">
                  <span className="av-count">{availabilityData[0].freeCount}</span>
                  <span className="av-label">名 空き</span>
                </div>
                <div className="av-detail">
                  <span className="av-highlight">{availabilityData[0].detailText}</span>
                </div>
              </div>
            )}
          </div>
          <div className="availabilityFutureGrid">
            {availabilityData.slice(1).map((stat, i) => (
              <div key={stat.iso} className={`av-cell ${stat.isFull ? 'is-full' : ''}`}>
                <span className="av-count">{stat.freeCount}名</span>
                <span className="av-detail">{stat.detailText}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
              {(() => {
                const diff = Math.round((new Date(weekDayIsos[i] + 'T00:00:00').getTime() - new Date(weekDayIsos[0] + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
                if (diff === 1) return <div className="contactDayLabelOutside">1日前 連絡日</div>;
                if (diff === 3) return <div className="contactDayLabelOutside">3日前 連絡日</div>;
                if (diff === 7) return <div className="contactDayLabelOutside">7日前 連絡日</div>;
                return null;
              })()}
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
                      cleaners={cleaners}
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
                    const meta = executionStatusMetaFromAppt(a);
                    const contactMeta = contactStatusMeta(a.contact_status ?? 'pending');
                    const conflict = conflictIds.has(a.id);
                    const isHighlight = selectedAppointmentId === a.id;
                    const isLinked = activeScheduleId != null && (a.schedule_id ?? a.id) === activeScheduleId;
                    const lastAt = formatContactLastAt(a.contact_last_at);

                    // 清掃員情報を取得
                    const cleaner = cleaners.find((c) => String(c.id) === String(a.cleaner_id));
                    const cleanerName = cleaner?.name || '';
                    const isInProgress = a.status === 'in_progress';

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
                        {isInProgress && cleanerName && (
                          <span style={{ fontSize: '0.85em', fontWeight: '600', color: '#f59e0b', marginLeft: '4px' }}>
                            🔨 {cleanerName}
                          </span>
                        )}
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

function MonthSimple({ dateISO, setDateISO, appointments = [] }) {
  const d = new Date(dateISO + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const apptsByDate = useMemo(() => {
    const map = new Map();
    for (const a of appointments) {
      map.set(a.date, (map.get(a.date) || 0) + 1);
    }
    return map;
  }, [appointments]);

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
          const count = apptsByDate.get(iso) || 0;

          return (
            <button key={idx} type="button" className={`monthCell ${isActive ? 'active' : ''}`} onClick={() => selectDay(day)} style={{ position: 'relative' }}>
              <div className="monthCellNum">{day}</div>
              {count > 0 && (
                <div className="monthCellCount" style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  background: 'rgba(68, 127, 255, 0.8)',
                  color: 'white',
                  fontSize: '10px',
                  padding: '1px 4px',
                  borderRadius: '4px',
                  lineHeight: '1'
                }}>
                  {count}
                </div>
              )}
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

function AppointmentModal({ dateISO, cleaners, appt, mode, onClose, onSave, onDelete, conflictIds, saveConflictError, clients = [], stores = [], brands = [], onClientChange, apiBase }) {
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(0); // 0: なし, 1: 一次確認, 2: 最終確認
  const conflict = conflictIds.has(appt.id);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!local.target_name?.trim()) return;
    setIsSaving(true);
    try {
      await onSave(local);
    } catch (err) {
      console.error('[AppointmentModal] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

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

    console.log('[AppointmentModal] Unified search results:', results.length, 'query:', query);
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
    const brand = brands.find((b) => String(b.id) === String(selectedBrandId));
    const bName = brand?.name || brand?.brand_name || store?.brand_name || '';
    const sName = store?.name || store?.store_name || '';
    const targetName = bName && sName ? `[${bName}] ${sName}` : (sName || bName || '');

    setLocal((p) => ({
      ...p,
      store_id: storeId,
      target_name: store ? targetName : p.target_name
    }));
  };

  function setField(key, value) {
    setLocal((p) => ({ ...p, [key]: value }));
  }

  function safeTimeChange(startHHMM, endHHMM) {
    if (!startHHMM || !endHHMM) return;
    const start = hhmmToMinutes(startHHMM);
    const end = hhmmToMinutes(endHHMM);
    setLocal((p) => ({ ...p, start_min: start, end_min: end }));
  }

  const meta = statusMeta(local.status);
  const dispatchMeta = dispatchStatusMeta(local.dispatch_status || normalizeDispatchStatusFromSchedule(local.status));

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
                    to="/admin/torihikisaki-touroku"
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
                    <span>顧客登録(新)</span>
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
                                  setSelectedClientId(client.id);
                                }
                                if (brand) {
                                  setSelectedBrandId(brand.id);
                                }

                                // 即座に名称を確定させる
                                const bName = brand?.name || brand?.brand_name || '';
                                const sName = store?.name || store?.store_name || '';
                                const targetName = bName && sName ? `[${bName}] ${sName}` : (sName || bName || '');

                                setLocal((p) => ({
                                  ...p,
                                  client_id: client?.id || p.client_id,
                                  brand_id: brand?.id || p.brand_id,
                                  store_id: store.id,
                                  target_name: targetName
                                }));
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
                              {brand?.name ? `[${brand.name}] ` : ''}{store?.name || store?.store_name || store?.id || '（店舗不明）'}
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
                    <div style={{ marginTop: '4px' }}><strong>店舗:</strong> {(() => {
                      const s = localStores.find((s) => String(s.id) === String(local.store_id));
                      const b = brands.find((b) => String(b.id) === String(selectedBrandId));
                      const bName = b?.name || b?.brand_name || '';
                      const sName = s?.name || s?.store_name || local.store_id;
                      return bName ? `[${bName}] ${sName}` : sName;
                    })()}</div>
                  )}
                </div>
              )}
              <div style={{ marginTop: '12px', gridColumn: 'span 2' }}>
                <Link
                  to="/admin/torihikisaki-touroku"
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
                <input type="time" value={minutesToHHMM(local.start_min)} onChange={(e) => safeTimeChange(e.target.value, minutesToHHMM(local.end_min))} step={60} />
              </label>
              <label className="field">
                <span>終了</span>
                <input type="time" value={minutesToHHMM(local.end_min)} onChange={(e) => safeTimeChange(minutesToHHMM(local.start_min), e.target.value)} step={60} />
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
              <label className="field">
                <span>実行状態</span>
                <select value={local.dispatch_status || normalizeDispatchStatusFromSchedule(local.status)} onChange={(e) => setField('dispatch_status', e.target.value)}>
                  {DISPATCH_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <div className={`badge preview ${dispatchMeta.colorClass}`}>実行: {dispatchMeta.label}</div>
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
              <button type="button" className="btnDanger" onClick={() => setShowDeleteConfirm(1)}>削除</button>
            )}
          </div>
          <div className="right">
            <button type="button" className="btn" onClick={onClose} disabled={isSaving}>閉じる</button>
            <button type="button" className="btnPrimary" onClick={handleSave} disabled={isSaving || !local.target_name?.trim()} title={!local.target_name?.trim() ? '現場名が必要です' : ''}>
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* 削除確認オーバーレイ（1段階目） */}
        {showDeleteConfirm === 1 && (
          <div className="confirmOverlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '16px', color: '#ff4d4f' }}>⚠️ 注意</div>
              <p style={{ marginBottom: '24px', lineHeight: '1.6' }}>この操作は取り消せません。<br />本当にこのスケジュールを削除しますか？</p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button type="button" className="btn" onClick={() => setShowDeleteConfirm(0)}>キャンセル</button>
                <button type="button" className="btnDanger" onClick={() => setShowDeleteConfirm(2)}>次へ（最終確認）</button>
              </div>
            </div>
          </div>
        )}

        {/* 削除確認オーバーレイ（2段階目） */}
        {showDeleteConfirm === 2 && (
          <div className="confirmOverlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(180,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2001, borderRadius: '12px', border: '2px solid #ff4d4f' }}>
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5em', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>🛑 最終確認</div>
              <p style={{ marginBottom: '24px', fontWeight: 'bold', color: '#fff' }}>「{local.target_name}」の予定を完全に削除します。<br />本当によろしいですか？</p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button type="button" className="btn" onClick={() => setShowDeleteConfirm(0)} style={{ background: '#fff', color: '#000' }}>やめる</button>
                <button type="button" className="btnDanger" style={{ padding: '12px 24px', fontSize: '1.1em', animation: 'pulse 1.5s infinite' }} onClick={() => onDelete(local.id)}>はい、削除します</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
