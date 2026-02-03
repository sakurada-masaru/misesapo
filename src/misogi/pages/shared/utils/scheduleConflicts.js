/**
 * スケジュール重複チェック（保存前検証用）
 * appointments + blocks を対象に時間重複を検出し、Conflict[] を返す。
 * 保存後に検知するのではなく、保存前に必ず呼び出して 409 相当で拒否すること。
 */

/**
 * @typedef {string} ISO
 */

/**
 * @typedef {Object} Appointment
 * @property {string} id
 * @property {string} schedule_id
 * @property {string} assignee_id
 * @property {ISO} start_at
 * @property {ISO} end_at
 * @property {string} [title]
 * @property {'job'|'block'} [kind]
 */

/**
 * @typedef {Object} Block
 * @property {string} id
 * @property {string|null} user_id - null = company_close
 * @property {ISO} start_at
 * @property {ISO} end_at
 * @property {'personal_close'|'company_close'} type
 * @property {string} [reason_code]
 */

/**
 * @typedef {Object} Conflict
 * @property {string} user_id
 * @property {string} [user_name]
 * @property {'appointment'|'block'} with_type
 * @property {string} with_id
 * @property {ISO} start_at
 * @property {ISO} end_at
 * @property {string} message
 */

/**
 * strict overlap: aStart < bEnd && aEnd > bStart
 * @param {number} aStart
 * @param {number} aEnd
 * @param {number} bStart
 * @param {number} bEnd
 * @returns {boolean}
 */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * @param {ISO} iso
 * @returns {number}
 */
export function toMs(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Invalid datetime: ${iso}`);
  return t;
}

/**
 * 保存前検証: candidate が既存予定・ブロックと重複していないか検査する。
 * @param {Object} opts
 * @param {Appointment[]} opts.candidateAppointments - これから保存したい予定（1件でも複数でも可）
 * @param {Appointment[]} opts.existingAppointments - 既存の予定一覧（同期間。更新時は自IDを除外して渡す）
 * @param {Block[]} opts.blocks - 同期間のブロック一覧
 * @param {Record<string, string>} [opts.userIdToName] - UIメッセージ用
 * @returns {Conflict[]}
 */
export function detectConflicts({
  candidateAppointments,
  existingAppointments,
  blocks,
  userIdToName = {},
}) {
  const conflicts = /** @type {Conflict[]} */ ([]);

  const byUser = /** @type {Record<string, Appointment[]>} */ ({});
  for (const appt of existingAppointments) {
    if (!byUser[appt.assignee_id]) byUser[appt.assignee_id] = [];
    byUser[appt.assignee_id].push(appt);
  }

  const blocksByUser = /** @type {Record<string, Block[]>} */ ({});
  const companyBlocks = /** @type {Block[]} */ ([]);
  for (const b of blocks) {
    if (b.user_id == null) companyBlocks.push(b);
    else {
      if (!blocksByUser[b.user_id]) blocksByUser[b.user_id] = [];
      blocksByUser[b.user_id].push(b);
    }
  }

  for (const cand of candidateAppointments) {
    const userId = cand.assignee_id;
    const candStart = toMs(cand.start_at);
    const candEnd = toMs(cand.end_at);

    const existing = byUser[userId] ?? [];
    for (const e of existing) {
      if (e.id === cand.id) continue;
      const eStart = toMs(e.start_at);
      const eEnd = toMs(e.end_at);
      if (overlaps(candStart, candEnd, eStart, eEnd)) {
        const name = userIdToName[userId];
        conflicts.push({
          user_id: userId,
          user_name: name,
          with_type: 'appointment',
          with_id: e.id,
          start_at: e.start_at,
          end_at: e.end_at,
          message: `${name ?? userId} が ${fmtTimeRange(cand.start_at, cand.end_at)} で別予定と重複しています`,
        });
        break;
      }
    }

    const personalBlocks = blocksByUser[userId] ?? [];
    for (const b of personalBlocks) {
      const bStart = toMs(b.start_at);
      const bEnd = toMs(b.end_at);
      if (overlaps(candStart, candEnd, bStart, bEnd)) {
        const name = userIdToName[userId];
        conflicts.push({
          user_id: userId,
          user_name: name,
          with_type: 'block',
          with_id: b.id,
          start_at: b.start_at,
          end_at: b.end_at,
          message: `${name ?? userId} のクローズ（${fmtTimeRange(b.start_at, b.end_at)}）と重複しています`,
        });
        break;
      }
    }

    for (const b of companyBlocks) {
      const bStart = toMs(b.start_at);
      const bEnd = toMs(b.end_at);
      if (overlaps(candStart, candEnd, bStart, bEnd)) {
        const name = userIdToName[userId];
        conflicts.push({
          user_id: userId,
          user_name: name,
          with_type: 'block',
          with_id: b.id,
          start_at: b.start_at,
          end_at: b.end_at,
          message: `${name ?? userId} は全体クローズ（${fmtTimeRange(b.start_at, b.end_at)}）のため割当できません`,
        });
        break;
      }
    }
  }

  return uniqueBy(conflicts, (c) => `${c.user_id}:${c.with_type}:${c.with_id}`);
}

/**
 * ブロック作成前検証: 新規ブロックが既存予定・既存ブロックと重複していないか検査する。
 * ブロック作成時も「既存 schedule と重複」していれば拒否（409）する。
 * @param {Object} opts
 * @param {Block} opts.block - これから作成するブロック（id は仮でよい）
 * @param {Appointment[]} opts.existingAppointments - 既存の予定一覧（時間重複判定に使う）
 * @param {Block[]} opts.existingBlocks - 既存のブロック一覧（自ブロックは含めない）
 * @param {Record<string, string>} [opts.userIdToName] - UIメッセージ用
 * @returns {Conflict[]}
 */
export function detectBlockConflicts({
  block,
  existingAppointments,
  existingBlocks,
  userIdToName = {},
}) {
  const conflicts = /** @type {Conflict[]} */ ([]);
  const blockStart = toMs(block.start_at);
  const blockEnd = toMs(block.end_at);

  if (block.user_id != null) {
    // 個人ブロック: そのユーザーの予定・ブロックと重複チェック
    for (const e of existingAppointments) {
      if (e.assignee_id !== block.user_id) continue;
      const eStart = toMs(e.start_at);
      const eEnd = toMs(e.end_at);
      if (overlaps(blockStart, blockEnd, eStart, eEnd)) {
        const name = userIdToName[block.user_id];
        conflicts.push({
          user_id: block.user_id,
          user_name: name,
          with_type: 'appointment',
          with_id: e.id,
          start_at: e.start_at,
          end_at: e.end_at,
          message: `${name ?? block.user_id} の既存予定（${fmtTimeRange(e.start_at, e.end_at)}）と重複しています`,
        });
        break;
      }
    }
    for (const b of existingBlocks) {
      if (b.id === block.id) continue;
      const uid = b.user_id;
      if (uid != null && uid !== block.user_id) continue;
      if (uid === null) {
        const bStart = toMs(b.start_at);
        const bEnd = toMs(b.end_at);
        if (overlaps(blockStart, blockEnd, bStart, bEnd)) {
          const name = userIdToName[block.user_id];
          conflicts.push({
            user_id: block.user_id,
            user_name: name,
            with_type: 'block',
            with_id: b.id,
            start_at: b.start_at,
            end_at: b.end_at,
            message: `全体クローズ（${fmtTimeRange(b.start_at, b.end_at)}）と重複しています`,
          });
          break;
        }
      } else {
        const bStart = toMs(b.start_at);
        const bEnd = toMs(b.end_at);
        if (overlaps(blockStart, blockEnd, bStart, bEnd)) {
          const name = userIdToName[block.user_id];
          conflicts.push({
            user_id: block.user_id,
            user_name: name,
            with_type: 'block',
            with_id: b.id,
            start_at: b.start_at,
            end_at: b.end_at,
            message: `${name ?? block.user_id} の既存クローズ（${fmtTimeRange(b.start_at, b.end_at)}）と重複しています`,
          });
          break;
        }
      }
    }
  } else {
    // 全体クローズ: 全予定・全ブロックと重複チェック（代表1件で十分）
    for (const e of existingAppointments) {
      const eStart = toMs(e.start_at);
      const eEnd = toMs(e.end_at);
      if (overlaps(blockStart, blockEnd, eStart, eEnd)) {
        const name = userIdToName[e.assignee_id];
        conflicts.push({
          user_id: e.assignee_id,
          user_name: name,
          with_type: 'appointment',
          with_id: e.id,
          start_at: e.start_at,
          end_at: e.end_at,
          message: `${name ?? e.assignee_id} の予定（${fmtTimeRange(e.start_at, e.end_at)}）と重複しているため全体クローズを登録できません`,
        });
        break;
      }
    }
    for (const b of existingBlocks) {
      if (b.id === block.id) continue;
      const bStart = toMs(b.start_at);
      const bEnd = toMs(b.end_at);
      if (overlaps(blockStart, blockEnd, bStart, bEnd)) {
        conflicts.push({
          user_id: '__ALL__',
          with_type: 'block',
          with_id: b.id,
          start_at: b.start_at,
          end_at: b.end_at,
          message: `既存の${b.user_id == null ? '全体' : '個人'}クローズ（${fmtTimeRange(b.start_at, b.end_at)}）と重複しています`,
        });
        break;
      }
    }
  }

  return conflicts;
}

/**
 * @template T
 * @param {T[]} arr
 * @param {(v: T) => string} keyFn
 * @returns {T[]}
 */
function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = keyFn(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/**
 * @param {string} startIso
 * @param {string} endIso
 * @returns {string}
 */
function fmtTimeRange(startIso, endIso) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`;
}
