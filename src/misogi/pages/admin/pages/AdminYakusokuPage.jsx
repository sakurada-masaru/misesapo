import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import './admin-yotei-timeline.css'; // Reuse styling
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';
import { getServiceCategoryLabel } from './serviceCategoryCatalog';
// Hamburger / admin-top are provided by GlobalNav.

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const IS_LOCAL = import.meta.env?.DEV || isLocalUiHost();
const API_BASE = IS_LOCAL
  ? '/api'
  : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
const YAKUSOKU_FALLBACK_BASE = IS_LOCAL
  ? '/api2'
  : normalizeGatewayBase(import.meta.env?.VITE_YAKUSOKU_API_BASE, API_BASE);
const MASTER_API_BASE = IS_LOCAL
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const MONTHLY_BUCKET = { key: 'monthly', label: '毎月 (1〜12月)' };
const BIMONTHLY_LABEL = '隔月（1〜12月指定）';
const QUARTERLY_LABEL = '四半期（1〜12月指定）';
const HALF_YEAR_LABEL = '半年（1〜12月指定）';
const YEARLY_BUCKET = { key: 'yearly', label: '年 (年1回)' };
const DAILY_BUCKET = { key: 'daily', label: '毎日' };
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const makeMonthBuckets = (prefix) => MONTH_NUMBERS.map((m) => ({
  key: `${prefix}_m${String(m).padStart(2, '0')}`,
  label: `${m}`,
}));
const QUARTERLY_BUCKETS = makeMonthBuckets('quarterly');
const HALF_YEAR_BUCKETS = makeMonthBuckets('half_year');
const BIMONTHLY_BUCKETS = makeMonthBuckets('bimonthly');
const WEEKDAY_OPTIONS = [
  { key: 'mon', label: '月' },
  { key: 'tue', label: '火' },
  { key: 'wed', label: '水' },
  { key: 'thu', label: '木' },
  { key: 'fri', label: '金' },
  { key: 'sat', label: '土' },
  { key: 'sun', label: '日' },
];
const WEEKLY_BUCKETS = WEEKDAY_OPTIONS.map((d) => ({ key: `weekly_${d.key}`, label: `${d.label}` }));
const BIWEEKLY_BUCKETS = WEEKDAY_OPTIONS.map((d) => ({ key: `biweekly_${d.key}`, label: `${d.label}` }));
const PLAN_BUCKETS = [
  MONTHLY_BUCKET,
  ...BIMONTHLY_BUCKETS,
  ...QUARTERLY_BUCKETS,
  ...HALF_YEAR_BUCKETS,
  YEARLY_BUCKET,
  DAILY_BUCKET,
  ...WEEKLY_BUCKETS,
  ...BIWEEKLY_BUCKETS,
];
const ICS_CLEANING_PATTERN = /(清掃|ゴミ|グリスト|ダクト|エアコン|ワックス|害虫|厨房|haccp|ラグ交換|換気扇|トイレ|床|メンテ|衛生)/i;

const DEFAULT_ONSITE_FLAGS = {
  has_spare_key: false,
  has_keybox: false,
  has_post_management: false,
  has_customer_attendance: false,
  key_loss_replacement_risk: false,
  require_gas_valve_check: false,
  trash_pickup_required: false,
  trash_photo_required: false,
};

const ONSITE_FLAG_GROUPS = [
  {
    title: '鍵カテゴリ',
    items: [
      { key: 'has_spare_key', label: '鍵預かり' },
      { key: 'has_keybox', label: 'キーボックスあり' },
      { key: 'has_post_management', label: 'ポスト管理' },
      { key: 'key_loss_replacement_risk', label: '鍵紛失＝鍵交換（注意）' },
    ],
  },
  {
    title: '運用カテゴリ',
    items: [
      { key: 'has_customer_attendance', label: '立会いあり' },
      { key: 'require_gas_valve_check', label: 'ガス栓確認 必須' },
      { key: 'trash_pickup_required', label: 'ゴミ回収あり' },
      { key: 'trash_photo_required', label: 'ゴミ回収時に写真 必須' },
    ],
  },
];

function createEmptyTaskMatrix() {
  return Object.fromEntries(PLAN_BUCKETS.map((b) => [b.key, []]));
}

function createEmptyBucketEnabled() {
  return Object.fromEntries(PLAN_BUCKETS.map((b) => [b.key, false]));
}

function authHeaders() {
  const legacyAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.token || '';
    } catch {
      return '';
    }
  })();
  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('cognito_access_token') ||
    localStorage.getItem('token') ||
    legacyAuth ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getBucketFamilyKeys(bucketKey) {
  const key = String(bucketKey || '');
  if (key === YEARLY_BUCKET.key) return [YEARLY_BUCKET.key];
  if (key === DAILY_BUCKET.key) return [DAILY_BUCKET.key];
  if (key.startsWith('quarterly_')) return QUARTERLY_BUCKETS.map((b) => b.key);
  if (key.startsWith('half_year_')) return HALF_YEAR_BUCKETS.map((b) => b.key);
  if (key.startsWith('bimonthly_')) return BIMONTHLY_BUCKETS.map((b) => b.key);
  if (key.startsWith('weekly_')) return WEEKLY_BUCKETS.map((b) => b.key);
  if (key.startsWith('biweekly_')) return BIWEEKLY_BUCKETS.map((b) => b.key);
  return [MONTHLY_BUCKET.key];
}

async function fetchYakusokuWithFallback(path, options = {}) {
  const primaryBase = API_BASE.replace(/\/$/, '');
  const primaryRes = await fetch(`${primaryBase}${path}`, options);
  if (primaryRes.ok) return primaryRes;
  if (![401, 403, 404].includes(primaryRes.status)) return primaryRes;
  const fallbackBase = YAKUSOKU_FALLBACK_BASE.replace(/\/$/, '');
  if (fallbackBase === primaryBase) return primaryRes;
  return fetch(`${fallbackBase}${path}`, options);
}

function unfoldIcsLines(input) {
  const rawLines = String(input || '').split(/\r?\n/);
  const lines = [];
  for (const ln of rawLines) {
    if ((ln.startsWith(' ') || ln.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += ln.slice(1);
    } else {
      lines.push(ln);
    }
  }
  return lines;
}

function decodeIcsText(v) {
  return String(v || '')
    .replace(/\\n/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function normText(v) {
  return String(v || '').trim();
}

function parseLeadingNumber(text) {
  const m = String(text || '').match(/(\d+)/);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : Number.NaN;
}

function compareIdYoungFirst(aId, bId) {
  const an = parseLeadingNumber(aId);
  const bn = parseLeadingNumber(bId);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
    return an - bn;
  }
  return String(aId || '').localeCompare(String(bId || ''), 'ja', { numeric: true, sensitivity: 'base' });
}

function parseIcsDateOnly(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseIcsEvents(icsText) {
  const lines = unfoldIcsLines(icsText);
  const events = [];
  let current = null;
  for (const line of lines) {
    const ln = String(line || '').trimEnd();
    if (ln === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (ln === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = ln.indexOf(':');
    if (idx <= 0) continue;
    const left = ln.slice(0, idx);
    const value = ln.slice(idx + 1);
    const name = left.split(';')[0].toUpperCase();
    if (!(name in current)) current[name] = value;
  }

  return events.map((ev) => ({
    uid: String(ev.UID || '').trim(),
    recurrenceId: String(ev['RECURRENCE-ID'] || '').trim(),
    summary: decodeIcsText(ev.SUMMARY || ''),
    description: decodeIcsText(ev.DESCRIPTION || ''),
    location: decodeIcsText(ev.LOCATION || ''),
    dtstart: String(ev.DTSTART || '').trim(),
    dtend: String(ev.DTEND || '').trim(),
    rrule: String(ev.RRULE || '').trim(),
  }));
}

function parseRRuleObject(rrule) {
  const out = {};
  const src = String(rrule || '').trim();
  if (!src) return out;
  src.split(';').forEach((seg) => {
    const [k, v] = seg.split('=');
    const key = String(k || '').trim().toUpperCase();
    if (!key) return;
    out[key] = String(v || '').trim();
  });
  return out;
}

function normalizeIcsWeekday(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c === 'MO') return 'mon';
  if (c === 'TU') return 'tue';
  if (c === 'WE') return 'wed';
  if (c === 'TH') return 'thu';
  if (c === 'FR') return 'fri';
  if (c === 'SA') return 'sat';
  if (c === 'SU') return 'sun';
  return '';
}

function buildTaskMatrixFromIcs(serviceId, rruleObj) {
  const sid = String(serviceId || '').trim();
  const matrix = createEmptyTaskMatrix();
  if (!sid) return matrix;
  const freq = String(rruleObj?.FREQ || '').toUpperCase();
  const intervalRaw = Number(rruleObj?.INTERVAL || 1);
  const interval = Number.isFinite(intervalRaw) && intervalRaw > 0 ? Math.floor(intervalRaw) : 1;
  const byday = String(rruleObj?.BYDAY || '')
    .split(',')
    .map((x) => normalizeIcsWeekday(x))
    .filter(Boolean);

  if (freq === 'DAILY') {
    matrix[DAILY_BUCKET.key] = [sid];
    return matrix;
  }
  if (freq === 'WEEKLY') {
    const target = interval >= 2 ? 'biweekly_' : 'weekly_';
    const days = byday.length ? byday : ['mon'];
    days.forEach((d) => {
      matrix[`${target}${d}`] = [sid];
    });
    return matrix;
  }
  if (freq === 'YEARLY') {
    matrix[YEARLY_BUCKET.key] = [sid];
    return matrix;
  }
  matrix[MONTHLY_BUCKET.key] = [sid];
  return matrix;
}

function estimateMonthlyQuotaFromIcs(rruleObj) {
  const freq = String(rruleObj?.FREQ || '').toUpperCase();
  const intervalRaw = Number(rruleObj?.INTERVAL || 1);
  const interval = Number.isFinite(intervalRaw) && intervalRaw > 0 ? Math.floor(intervalRaw) : 1;
  if (freq === 'DAILY') return 30;
  if (freq === 'WEEKLY') return Math.max(1, Math.floor(4 / interval));
  return 1;
}

function normalizeMatchText(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[()（）【】\[\]「」『』"'`]/g, ' ')
    .replace(/[\/\\|・,，、.:：;；\-＿_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeMatchText(raw) {
  return normalizeMatchText(raw)
    .split(' ')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 2);
}

function computeServiceMatchScore(service, textNorm) {
  const name = normalizeMatchText(service?.name || '');
  const category = normalizeMatchText(service?.category || service?.category_concept || '');
  if (!name) return 0;
  let score = 0;
  if (textNorm.includes(name)) score += Math.min(120, name.length * 4);
  const tokens = tokenizeMatchText(service?.name || '').filter((t) => t.length >= 3);
  tokens.forEach((tk) => {
    if (textNorm.includes(tk)) score += Math.min(30, tk.length * 2);
  });

  const keywordByCategory = [
    { category: 'aircon', keywords: ['エアコン', '空調'] },
    { category: 'kitchen', keywords: ['厨房', 'グリスト', 'ダクト', '換気扇', 'フード', 'haccp'] },
    { category: 'floor', keywords: ['床', 'ワックス'] },
    { category: 'window', keywords: ['窓', 'ガラス', '壁面'] },
    { category: 'pest', keywords: ['害虫', 'ゴキブリ', 'ネズミ', '虫'] },
    { category: 'maintenance', keywords: ['メンテ', '点検', '保守'] },
    { category: 'cleaning', keywords: ['清掃', '定期', 'スポット'] },
  ];
  keywordByCategory.forEach((row) => {
    if (!category.includes(row.category)) return;
    row.keywords.forEach((kw) => {
      if (textNorm.includes(normalizeMatchText(kw))) score += 12;
    });
  });
  return score;
}

function pickBestServiceByText(services, text, fallbackService = null) {
  const list = Array.isArray(services) ? services : [];
  if (!list.length) return fallbackService || null;
  const norm = normalizeMatchText(text);
  let best = null;
  let bestScore = 0;
  list.forEach((svc) => {
    const score = computeServiceMatchScore(svc, norm);
    if (score > bestScore) {
      bestScore = score;
      best = svc;
    }
  });
  return bestScore > 0 ? best : (fallbackService || null);
}

function buildTenpoNeedles(tp) {
  const arr = [];
  const push = (v) => {
    const s = String(v || '').trim();
    if (s) arr.push(s);
  };
  push(tp?.name);
  push(tp?.yagou_name);
  push(tp?.torihikisaki_name);
  push(`${String(tp?.yagou_name || '').trim()} ${String(tp?.name || '').trim()}`.trim());
  tokenizeMatchText(tp?.name || '').forEach(push);
  tokenizeMatchText(tp?.yagou_name || '').forEach(push);
  return Array.from(new Set(arr.map((x) => normalizeMatchText(x)).filter(Boolean)));
}

function pickBestTenpoByText(tenpos, text) {
  const list = Array.isArray(tenpos) ? tenpos : [];
  const norm = normalizeMatchText(text);
  let best = null;
  let bestScore = 0;
  list.forEach((tp) => {
    const needles = buildTenpoNeedles(tp);
    let score = 0;
    needles.forEach((nd) => {
      if (!nd) return;
      if (norm.includes(nd)) score = Math.max(score, Math.min(180, nd.length * 5));
    });
    if (score > bestScore) {
      bestScore = score;
      best = tp;
    }
  });
  return { tenpo: best, score: bestScore };
}

function pickLocationHead(raw) {
  const src = String(raw || '').trim();
  if (!src) return '';
  const cutByComma = src.split(/[,\n]/)[0] || '';
  const cutByAddress = cutByComma.split(/日本、|〒/)[0] || cutByComma;
  return String(cutByAddress || '').trim();
}

function guessStoreLabelFromEvent(summaryRaw, locationRaw) {
  const locationHead = pickLocationHead(locationRaw);
  if (locationHead) return locationHead;
  const summary = String(summaryRaw || '').trim();
  if (!summary) return '';
  const hint = extractSummaryHints(summary);
  return String(hint?.tenpoHint || summary).trim();
}

function bigramDiceSimilarity(aRaw, bRaw) {
  const a = normalizeMatchText(aRaw).replace(/\s+/g, '');
  const b = normalizeMatchText(bRaw).replace(/\s+/g, '');
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const toBigrams = (s) => {
    const arr = [];
    for (let i = 0; i < s.length - 1; i += 1) arr.push(s.slice(i, i + 2));
    return arr;
  };
  const aGrams = toBigrams(a);
  const bGrams = toBigrams(b);
  if (!aGrams.length || !bGrams.length) return 0;
  const freq = new Map();
  aGrams.forEach((g) => freq.set(g, (freq.get(g) || 0) + 1));
  let hit = 0;
  bGrams.forEach((g) => {
    const c = freq.get(g) || 0;
    if (c > 0) {
      hit += 1;
      freq.set(g, c - 1);
    }
  });
  return (2 * hit) / (aGrams.length + bGrams.length);
}

function pickBestTenpoByEvent(tenpos, { summary, location, description, tenpoHint }) {
  const list = Array.isArray(tenpos) ? tenpos : [];
  if (!list.length) return { tenpo: null, score: 0 };
  const summaryNorm = normalizeMatchText(summary);
  const locationNorm = normalizeMatchText(location);
  const descriptionNorm = normalizeMatchText(description);
  const hintNorm = normalizeMatchText(tenpoHint);
  const locationHead = pickLocationHead(location);
  const summaryHead = String(summary || '').split(/[\u3000]{2,}|\s{2,}|\/|／|\||｜/)[0] || '';
  const mergedNorm = [summaryNorm, locationNorm, descriptionNorm].filter(Boolean).join(' ');

  let best = null;
  let bestScore = 0;
  let secondScore = 0;
  list.forEach((tp) => {
    const nameNorm = normalizeMatchText(tp?.name || '');
    const yagouNorm = normalizeMatchText(tp?.yagou_name || '');
    const toriNorm = normalizeMatchText(tp?.torihikisaki_name || '');
    const joinedNorm = normalizeMatchText(`${tp?.yagou_name || ''} ${tp?.name || ''}`);
    let score = 0;

    if (nameNorm) {
      if (locationNorm.includes(nameNorm)) score += 520 + Math.min(220, nameNorm.length * 5);
      if (summaryNorm.includes(nameNorm)) score += 360 + Math.min(180, nameNorm.length * 4);
      if (descriptionNorm.includes(nameNorm)) score += 180 + Math.min(120, nameNorm.length * 3);
    }
    if (yagouNorm) {
      if (locationNorm.includes(yagouNorm)) score += 280 + Math.min(150, yagouNorm.length * 4);
      if (summaryNorm.includes(yagouNorm)) score += 260 + Math.min(140, yagouNorm.length * 4);
      if (descriptionNorm.includes(yagouNorm)) score += 120 + Math.min(100, yagouNorm.length * 3);
    }
    if (joinedNorm && (summaryNorm.includes(joinedNorm) || locationNorm.includes(joinedNorm))) {
      score += 420;
    }
    if (hintNorm) {
      if (nameNorm && (hintNorm.includes(nameNorm) || nameNorm.includes(hintNorm))) score += 320;
      if (yagouNorm && (hintNorm.includes(yagouNorm) || yagouNorm.includes(hintNorm))) score += 260;
      if (joinedNorm && (hintNorm.includes(joinedNorm) || joinedNorm.includes(hintNorm))) score += 400;
    }
    if (nameNorm && yagouNorm) {
      const bothMatched = (
        (summaryNorm.includes(nameNorm) || locationNorm.includes(nameNorm)) &&
        (summaryNorm.includes(yagouNorm) || locationNorm.includes(yagouNorm))
      );
      if (bothMatched) score += 260;
    }
    if (toriNorm && (summaryNorm.includes(toriNorm) || locationNorm.includes(toriNorm))) {
      score += 90;
    }

    const fallback = pickBestTenpoByText([tp], mergedNorm)?.score || 0;
    score += Math.floor(fallback * 0.6);

    // 表記ゆれ吸収: LOCATION先頭やSUMMARY先頭との近似一致を補助点にする
    const approxTarget = `${tp?.yagou_name || ''} ${tp?.name || ''}`.trim();
    const simLoc = bigramDiceSimilarity(locationHead, approxTarget);
    const simSum = bigramDiceSimilarity(summaryHead, approxTarget);
    const sim = Math.max(simLoc, simSum);
    if (sim >= 0.5) score += Math.floor(sim * 240);

    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      best = tp;
    } else if (score > secondScore) {
      secondScore = score;
    }
  });
  // 近似一致が競っている場合は誤マッチ回避のため未一致扱い
  if (bestScore > 0 && secondScore > 0 && (bestScore - secondScore) < 18) {
    return { tenpo: null, score: 0 };
  }
  return { tenpo: best, score: bestScore };
}

function extractSummaryHints(summaryRaw) {
  const summary = String(summaryRaw || '').trim();
  const parts = summary
    .split(/[\/／|｜]/)
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const partsBySpace = summary
    .split(/[\u3000]{1,}|[\s]{2,}/)
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const useParts = parts.length >= 2 ? parts : (partsBySpace.length >= 2 ? partsBySpace : parts);
  if (useParts.length >= 3) {
    return {
      tenpoHint: `${useParts[0]} ${useParts[1]}`.trim(),
      planHint: useParts.slice(2).join(' '),
    };
  }
  if (useParts.length === 2) {
    return {
      tenpoHint: useParts[0],
      planHint: useParts[1],
    };
  }
  return {
    tenpoHint: summary,
    planHint: summary,
  };
}

function stripHtmlTags(raw) {
  return String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractServiceContentFromEvent(summaryRaw, descriptionRaw, fallbackServiceName = '', locationRaw = '') {
  const summary = String(summaryRaw || '').trim();
  const description = stripHtmlTags(descriptionRaw || '');
  const location = String(locationRaw || '').trim();
  const src = [summary, description, location].filter(Boolean).join('\n');
  if (!src) {
    const fallback = String(fallbackServiceName || '').trim();
    return { text: fallback, tags: fallback ? [fallback] : [] };
  }
  const cleaningHints = /(清掃|洗浄|駆除|点検|交換|修理|回収|高圧|グリスト|エアコン|床|フィルター|換気扇|レンジフード|ラグ|マット|害虫|ネズミ|ダクト|ワックス)/i;
  const normalized = src
    .replace(/\r/g, '\n')
    .replace(/[【\[]/g, '\n【')
    .replace(/[】\]]/g, '】\n')
    .replace(/[\t　]{2,}/g, '\n')
    .replace(/\s{2,}/g, '\n');
  const roughTokens = normalized
    .split(/[\n、,，;；\/／|｜・]+/)
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .map((x) => x.replace(/\s+/g, ' ').trim());
  const tokens = roughTokens
    .filter((tk) => cleaningHints.test(tk))
    .map((tk) => tk.replace(/^(毎月|毎週|隔月|半月|四半期|半年|年次|都度|スポット)\s*/g, '').trim())
    .filter(Boolean);
  const dedup = Array.from(new Set(tokens)).slice(0, 10);
  if (!dedup.length) {
    const fallback = String(fallbackServiceName || summary || '').trim();
    return { text: fallback, tags: fallback ? [fallback] : [] };
  }
  return {
    text: dedup.join(' / ').slice(0, 300),
    tags: dedup,
  };
}

function splitServiceContentTags(raw) {
  return Array.from(
    new Set(
      String(raw || '')
        .split(/[\/／|｜,，、;\n]+/)
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 20)
    )
  );
}

function extractPriceCandidatesFromEvent(summaryRaw, descriptionRaw, locationRaw = '') {
  const text = [summaryRaw, descriptionRaw, locationRaw]
    .map((v) => stripHtmlTags(v || ''))
    .filter(Boolean)
    .join('\n');
  if (!text) return [];
  const values = [];
  const patterns = [
    /[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)/g,
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*円/g,
  ];
  patterns.forEach((p) => {
    let m = p.exec(text);
    while (m) {
      const n = Number(String(m[1] || '').replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 1000 && n <= 1000000) values.push(Math.trunc(n));
      m = p.exec(text);
    }
  });
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function buildSiteMergeKey(src) {
  const tenpoId = String(src?.tenpo_id || '').trim();
  if (tenpoId) return `id:${tenpoId}`;
  const yagou = normalizeMatchText(src?.yagou_name || '');
  const tenpo = normalizeMatchText(src?.tenpo_name || '');
  const key = `${yagou}|${tenpo}`;
  return key === '|' ? '' : `name:${key}`;
}

function buildIcsDedupKey(row) {
  const uid = String(row?.uid || '').trim();
  if (uid) return `uid:${uid}`;
  const summary = normalizeMatchText(row?.summary || '');
  const location = normalizeMatchText(row?.location || '');
  const type = String(row?.type || '').trim();
  const rule = normalizeMatchText(JSON.stringify(row?.rruleObj || {}));
  return `fallback:${summary}|${location}|${type}|${rule}`;
}

function pickBetterIcsRow(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aRec = String(a?.recurrenceId || '').trim();
  const bRec = String(b?.recurrenceId || '').trim();
  if (!aRec && bRec) return a;
  if (aRec && !bRec) return b;

  const aCan = Boolean(a?.canCreate);
  const bCan = Boolean(b?.canCreate);
  if (aCan && !bCan) return a;
  if (!aCan && bCan) return b;

  const aScore = Number(a?.matchedScore || 0);
  const bScore = Number(b?.matchedScore || 0);
  if (aScore !== bScore) return aScore > bScore ? a : b;

  const aStart = String(a?.startDate || '');
  const bStart = String(b?.startDate || '');
  if (aStart && bStart && aStart !== bStart) return aStart < bStart ? a : b;

  const aLen = String(a?.summary || '').length;
  const bLen = String(b?.summary || '').length;
  if (aLen !== bLen) return aLen > bLen ? a : b;
  return a;
}

function dedupeIcsPreviewRows(rows) {
  const src = Array.isArray(rows) ? rows : [];
  const byKey = new Map();
  src.forEach((row) => {
    const key = buildIcsDedupKey(row);
    const prev = byKey.get(key);
    byKey.set(key, pickBetterIcsRow(prev, row));
  });
  return Array.from(byKey.values());
}

export default function AdminYakusokuPage() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [tenpos, setTenpos] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listQuery, setListQuery] = useState('');
  const [modalData, setModalData] = useState(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [icsModalOpen, setIcsModalOpen] = useState(false);
  const [icsText, setIcsText] = useState('');
  const [icsFileName, setIcsFileName] = useState('');
  const [icsOnlyCleaning, setIcsOnlyCleaning] = useState(true);
  const [icsPreview, setIcsPreview] = useState([]);
  const [icsParseError, setIcsParseError] = useState('');
  const [icsImporting, setIcsImporting] = useState(false);
  const [icsImportSummary, setIcsImportSummary] = useState(null);
  const [icsContentSyncing, setIcsContentSyncing] = useState(false);
  const [icsContentSyncSummary, setIcsContentSyncSummary] = useState(null);
  const [icsPriceSyncing, setIcsPriceSyncing] = useState(false);
  const [icsPriceSyncSummary, setIcsPriceSyncSummary] = useState(null);
  const [siteNameBackfilling, setSiteNameBackfilling] = useState(false);
  const [siteNameBackfillSummary, setSiteNameBackfillSummary] = useState(null);

  const getServiceCategoryMeta = useCallback((svc) => {
    const raw = String(svc?.category || svc?.category_concept || '').trim();
    const normalized = raw || 'uncategorized';
    return {
      key: normalized,
      label: getServiceCategoryLabel(raw),
    };
  }, []);

  const normalizeServiceConcept = useCallback((svc) => {
    return getServiceCategoryMeta(svc).label;
  }, [getServiceCategoryMeta]);

  const normalizeTaskMatrix = useCallback((taskMatrix) => {
    const base = createEmptyTaskMatrix();
    if (!taskMatrix || typeof taskMatrix !== 'object') return base;
    for (const b of PLAN_BUCKETS) {
      const arr = taskMatrix[b.key];
      base[b.key] = Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
    }
    const mergeInto = (targetKey, values) => {
      const merged = new Set([...(base[targetKey] || []), ...values]);
      base[targetKey] = [...merged];
    };
    const legacyValues = (legacyKey) => (
      Array.isArray(taskMatrix[legacyKey])
        ? taskMatrix[legacyKey].map((x) => String(x)).filter(Boolean)
        : []
    );
    const applyLegacy = (legacyKey, targetKeys) => {
      const vals = legacyValues(legacyKey);
      if (!vals.length) return;
      targetKeys.forEach((k) => mergeInto(k, vals));
    };

    // Backward compatibility: legacy buckets are expanded into direct month/weekday buckets.
    applyLegacy('odd_month', ['monthly']);
    applyLegacy('even_month', ['monthly']);
    applyLegacy('yearly', [YEARLY_BUCKET.key]);
    applyLegacy('daily', [DAILY_BUCKET.key]);
    applyLegacy('month_01', ['quarterly_m01']);
    applyLegacy('month_02', ['quarterly_m02']);
    applyLegacy('month_03', ['quarterly_m03']);
    applyLegacy('month_04', ['quarterly_m04']);
    applyLegacy('month_05', ['quarterly_m05']);
    applyLegacy('month_06', ['quarterly_m06']);
    applyLegacy('month_07', ['quarterly_m07']);
    applyLegacy('month_08', ['quarterly_m08']);
    applyLegacy('month_09', ['quarterly_m09']);
    applyLegacy('month_10', ['quarterly_m10']);
    applyLegacy('month_11', ['quarterly_m11']);
    applyLegacy('month_12', ['quarterly_m12']);

    applyLegacy('quarterly_a', ['quarterly_m01', 'quarterly_m04', 'quarterly_m07', 'quarterly_m10']);
    applyLegacy('quarterly_b', ['quarterly_m02', 'quarterly_m05', 'quarterly_m08', 'quarterly_m11']);
    applyLegacy('quarterly_c', ['quarterly_m03', 'quarterly_m06', 'quarterly_m09', 'quarterly_m12']);
    applyLegacy('quarterly_d', ['quarterly_m04', 'quarterly_m08', 'quarterly_m12']);

    applyLegacy('half_year_a', ['half_year_m01', 'half_year_m07']);
    applyLegacy('half_year_b', ['half_year_m02', 'half_year_m08']);
    applyLegacy('half_year_c', ['half_year_m03', 'half_year_m09']);
    applyLegacy('half_year_d', ['half_year_m04', 'half_year_m10']);
    applyLegacy('half_year_e', ['half_year_m05', 'half_year_m11']);
    applyLegacy('half_year_f', ['half_year_m06', 'half_year_m12']);

    applyLegacy('bimonthly_a', ['bimonthly_m01', 'bimonthly_m03', 'bimonthly_m05', 'bimonthly_m07', 'bimonthly_m09', 'bimonthly_m11']);
    applyLegacy('bimonthly_b', ['bimonthly_m02', 'bimonthly_m04', 'bimonthly_m06', 'bimonthly_m08', 'bimonthly_m10', 'bimonthly_m12']);

    WEEKDAY_OPTIONS.forEach((d) => {
      applyLegacy(`weekly_a_${d.key}`, [`weekly_${d.key}`]);
      applyLegacy(`biweekly_a_${d.key}`, [`biweekly_${d.key}`]);
      applyLegacy(`biweekly_b_${d.key}`, [`biweekly_${d.key}`]);
    });
    return base;
  }, []);

  const normalizeOnsiteFlags = useCallback((flags) => {
    const src = flags && typeof flags === 'object' ? flags : {};
    const out = { ...DEFAULT_ONSITE_FLAGS };
    for (const k of Object.keys(out)) out[k] = Boolean(src[k]);
    return out;
  }, []);

  const normalizeServiceSelection = useCallback((src) => {
    const ids = Array.isArray(src?.service_ids)
      ? src.service_ids.map((x) => String(x)).filter(Boolean)
      : [];
    const names = Array.isArray(src?.service_names)
      ? src.service_names.map((x) => String(x)).filter(Boolean)
      : [];

    if (!ids.length && src?.service_id) ids.push(String(src.service_id));
    if (!names.length && src?.service_name) names.push(String(src.service_name));
    return { service_ids: ids, service_names: names };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchYakusokuWithFallback('/yakusoku', { headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
      window.alert('yakusokuの取得に失敗しました（権限または接続先を確認）');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/master/service?limit=2000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
        if (!res.ok) throw new Error(`Service HTTP ${res.status}`);
        const data = await res.json();
        setServices(Array.isArray(data) ? data : (data?.items || []));
      } catch (e) {
        console.error('Failed to fetch services:', e);
        setServices([]);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/master/keiyaku?limit=5000&jotai=yuko`, {
          headers: authHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Keiyaku HTTP ${res.status}`);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data?.items || []);
        const normalized = rows
          .map((it) => ({
            ...it,
            keiyaku_id: String(it?.keiyaku_id || it?.id || '').trim(),
            name: String(it?.name || '').trim(),
            tenpo_id: String(it?.tenpo_id || '').trim(),
            start_date: String(it?.start_date || '').trim(),
            application_date: String(it?.application_date || '').trim(),
            status: String(it?.status || '').trim(),
            updated_at: String(it?.updated_at || '').trim(),
            jotai: String(it?.jotai || 'yuko').trim(),
          }))
          .filter((it) => it.keiyaku_id);
        setContracts(normalized);
      } catch (e) {
        console.warn('Failed to fetch keiyaku:', e);
        setContracts([]);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    if (servicePickerOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    }
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [servicePickerOpen]);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const [toriRes, yagouRes, tenpoRes] = await Promise.all([
          fetch(`${base}/master/torihikisaki?limit=5000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
          fetch(`${base}/master/yagou?limit=8000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
          fetch(`${base}/master/tenpo?limit=20000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
        ]);
        if (!toriRes.ok) throw new Error(`Torihikisaki HTTP ${toriRes.status}`);
        if (!yagouRes.ok) throw new Error(`Yagou HTTP ${yagouRes.status}`);
        if (!tenpoRes.ok) throw new Error(`Tenpo HTTP ${tenpoRes.status}`);

        const toriData = await toriRes.json();
        const yagouData = await yagouRes.json();
        const tenpoData = await tenpoRes.json();
        const toriItems = Array.isArray(toriData) ? toriData : (toriData?.items || []);
        const yagouItems = Array.isArray(yagouData) ? yagouData : (yagouData?.items || []);
        const tenpoItems = Array.isArray(tenpoData) ? tenpoData : (tenpoData?.items || []);

        const toriNameById = new Map(toriItems.map((it) => [it?.torihikisaki_id || it?.id, it?.name || '']));
        const yagouNameById = new Map(yagouItems.map((it) => [it?.yagou_id || it?.id, it?.name || '']));

        const normalized = tenpoItems
          .map((it) => {
            const tenpo_id = it?.tenpo_id || it?.id || '';
            const name = it?.name || '';
            const torihikisaki_id = it?.torihikisaki_id || '';
            const yagou_id = it?.yagou_id || '';
            const torihikisaki_name = toriNameById.get(torihikisaki_id) || '';
            const yagou_name = yagouNameById.get(yagou_id) || '';
            const search_blob = [
              name,
              tenpo_id,
              yagou_name,
              yagou_id,
              torihikisaki_name,
              torihikisaki_id,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return { tenpo_id, name, torihikisaki_id, yagou_id, torihikisaki_name, yagou_name, search_blob };
          })
          .filter((it) => it.tenpo_id && it.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setTenpos(normalized);
      } catch (e) {
        console.error('Failed to fetch tenpos:', e);
        setTenpos([]);
      }
    };
    run();
  }, []);

  const openNew = () => {
    setServicePickerOpen(false);
    setModalData({
      isNew: true,
      type: 'teiki',
      tenpo_name: '',
      tenpo_query: '',
      service_id: '',
      service_name: '',
      service_ids: [],
      service_names: [],
      service_category: 'all',
      service_query: '',
      monthly_quota: 1,
      price: 0,
      start_date: dayjs().format('YYYY-MM-DD'),
      keiyaku_id: '',
      keiyaku_name: '',
      keiyaku_start_date: '',
      status: 'active',
      memo: '',
      onsite_flags: { ...DEFAULT_ONSITE_FLAGS },
      recurrence_rule: { type: 'flexible', task_matrix: createEmptyTaskMatrix() },
      _tagDrafts: {},
      _tagSearch: {},
      _tagAdvanced: {},
      _bucketEnabled: createEmptyBucketEnabled(),
      _monthLock: false,
    });
  };

  const openEdit = (item) => {
    const rr = item?.recurrence_rule && typeof item.recurrence_rule === 'object'
      ? item.recurrence_rule
      : { type: 'flexible' };
    const multiSvc = normalizeServiceSelection(item);
    const normalizedTaskMatrix = normalizeTaskMatrix(rr.task_matrix);
    setServicePickerOpen(false);
    const tenpoDisplay = [String(item?.yagou_name || '').trim(), String(item?.tenpo_name || '').trim()]
      .filter(Boolean)
      .join(' / ');
    setModalData({
      ...item,
      ...multiSvc,
      isNew: false,
      tenpo_query: tenpoDisplay || String(item?.tenpo_name || ''),
      service_category: 'all',
      service_query: item?.service_name || item?.service_id || '',
      keiyaku_id: String(item?.keiyaku_id || '').trim(),
      keiyaku_name: String(item?.keiyaku_name || '').trim(),
      keiyaku_start_date: String(item?.keiyaku_start_date || item?.contract_start_date || '').trim(),
      onsite_flags: normalizeOnsiteFlags(item?.onsite_flags),
      recurrence_rule: {
        ...rr,
        task_matrix: normalizedTaskMatrix,
      },
      _tagDrafts: {},
      _tagSearch: {},
      _tagAdvanced: {},
      _bucketEnabled: {
        ...createEmptyBucketEnabled(),
        ...Object.fromEntries(PLAN_BUCKETS.map((b) => [b.key, (normalizedTaskMatrix[b.key] || []).length > 0])),
      },
      _monthLock: false,
    });
  };

  const toggleServiceSelection = useCallback((svc, checked) => {
    const sid = String(svc?.service_id || '');
    if (!sid) return;
    const sname = String(svc?.name || sid);
    setModalData((prev) => {
      if (!prev) return prev;
      const ids = Array.isArray(prev.service_ids) ? [...prev.service_ids].map(String) : [];
      const names = Array.isArray(prev.service_names) ? [...prev.service_names].map(String) : [];
      const hit = ids.indexOf(sid);
      if (checked) {
        if (hit < 0) {
          ids.push(sid);
          names.push(sname);
        }
      } else if (hit >= 0) {
        ids.splice(hit, 1);
        names.splice(hit, 1);
      }
      const nextTaskMatrix = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      if (!checked) {
        for (const k of Object.keys(nextTaskMatrix)) {
          nextTaskMatrix[k] = (nextTaskMatrix[k] || []).filter((x) => String(x) !== sid);
        }
      }
      return {
        ...prev,
        service_ids: ids,
        service_names: names,
        service_id: ids[0] || '',
        service_name: names[0] || '',
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: nextTaskMatrix,
        },
        price:
          prev.isNew && checked && Number(svc?.default_price || 0) > 0 && ids.length === 1
            ? Number(svc.default_price)
            : prev.price,
      };
    });
  }, []);

  const tenpoCandidates = useMemo(() => {
    const q = String(modalData?.tenpo_query || '').trim().toLowerCase();
    if (!q) return tenpos.slice(0, 12);
    return tenpos
      .filter((it) => (it.search_blob || '').includes(q))
      .slice(0, 20);
  }, [modalData?.tenpo_query, tenpos]);

  const tenpoMetaById = useMemo(() => {
    const m = new Map();
    (tenpos || []).forEach((tp) => {
      const id = String(tp?.tenpo_id || '').trim();
      if (!id) return;
      m.set(id, tp);
    });
    return m;
  }, [tenpos]);

  const tenpoMetaByName = useMemo(() => {
    const m = new Map();
    (tenpos || []).forEach((tp) => {
      const name = String(tp?.name || '').trim();
      if (!name || m.has(name)) return;
      m.set(name, tp);
    });
    return m;
  }, [tenpos]);

  const formatTenpoDisplay = useCallback((tenpoId, tenpoName, yagouName) => {
    const name = String(tenpoName || '').trim();
    if (!name) return '---';
    const metaById = tenpoMetaById.get(String(tenpoId || '').trim());
    const metaByName = tenpoMetaByName.get(name);
    const yagou = String(yagouName || metaById?.yagou_name || metaByName?.yagou_name || '').trim();
    return yagou ? `${yagou} / ${name}` : name;
  }, [tenpoMetaById, tenpoMetaByName]);

  const contractById = useMemo(() => {
    const m = new Map();
    (contracts || []).forEach((c) => {
      const id = String(c?.keiyaku_id || '').trim();
      if (!id) return;
      m.set(id, c);
    });
    return m;
  }, [contracts]);

  const getContractStartDate = useCallback((c) => (
    String(c?.start_date || c?.application_date || c?.keiyaku_start_date || '').trim()
  ), []);

  const applyContractToModal = useCallback((prev, nextKeiyakuId, opts = {}) => {
    const id = String(nextKeiyakuId || '').trim();
    const linked = id ? contractById.get(id) : null;
    const linkedTenpoId = String(linked?.tenpo_id || '').trim();
    const linkedTenpo = linkedTenpoId ? tenpoMetaById.get(linkedTenpoId) : null;
    const contractStart = getContractStartDate(linked);

    const next = {
      ...prev,
      keiyaku_id: id,
      keiyaku_name: String(linked?.name || '').trim(),
      keiyaku_start_date: contractStart,
    };

    if (!id) {
      next.keiyaku_name = '';
      next.keiyaku_start_date = '';
    }

    if (linkedTenpo) {
      next.tenpo_id = linkedTenpo.tenpo_id || '';
      next.tenpo_name = linkedTenpo.name || '';
      next.tenpo_query = formatTenpoDisplay(linkedTenpo.tenpo_id, linkedTenpo.name, linkedTenpo.yagou_name);
      next.torihikisaki_id = linkedTenpo.torihikisaki_id || '';
      next.yagou_id = linkedTenpo.yagou_id || '';
      next.torihikisaki_name = linkedTenpo.torihikisaki_name || '';
      next.yagou_name = linkedTenpo.yagou_name || '';
    }

    if (opts.syncYakusokuStartDate && contractStart && !String(next.start_date || '').trim()) {
      next.start_date = contractStart;
    }

    return next;
  }, [contractById, tenpoMetaById, formatTenpoDisplay, getContractStartDate]);

  const pickPrimaryContractIdForTenpo = useCallback((tenpoId, currentId = '') => {
    const tid = String(tenpoId || '').trim();
    if (!tid) return '';
    const rows = (contracts || [])
      .filter((c) => String(c?.tenpo_id || '').trim() === tid)
      .filter((c) => String(c?.jotai || 'yuko').trim() !== 'torikeshi')
      .sort((a, b) => {
        const ad = String(a?.start_date || a?.application_date || '').trim();
        const bd = String(b?.start_date || b?.application_date || '').trim();
        if (ad !== bd) return bd.localeCompare(ad);
        return String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''));
      });
    const curr = String(currentId || '').trim();
    if (curr && rows.some((r) => String(r?.keiyaku_id || '').trim() === curr)) return curr;
    return String(rows?.[0]?.keiyaku_id || '').trim();
  }, [contracts]);

  const contractCandidates = useMemo(() => {
    const tid = String(modalData?.tenpo_id || '').trim();
    const rows = (contracts || [])
      .filter((c) => String(c?.jotai || 'yuko').trim() !== 'torikeshi')
      .filter((c) => !tid || String(c?.tenpo_id || '').trim() === tid)
      .sort((a, b) => {
        const ad = String(a?.start_date || a?.application_date || '').trim();
        const bd = String(b?.start_date || b?.application_date || '').trim();
        if (ad !== bd) return bd.localeCompare(ad);
        return String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''));
      });
    return rows.slice(0, 500);
  }, [contracts, modalData?.tenpo_id]);

  const selectedContract = useMemo(() => {
    const id = String(modalData?.keiyaku_id || '').trim();
    if (!id) return null;
    return contractById.get(id) || null;
  }, [modalData?.keiyaku_id, contractById]);

  const contractSelectOptions = useMemo(() => {
    const rows = [...contractCandidates];
    const currId = String(modalData?.keiyaku_id || '').trim();
    if (currId && !rows.some((r) => String(r?.keiyaku_id || '').trim() === currId)) {
      rows.unshift({
        keiyaku_id: currId,
        name: String(modalData?.keiyaku_name || currId).trim(),
        tenpo_id: String(modalData?.tenpo_id || '').trim(),
        start_date: String(modalData?.keiyaku_start_date || '').trim(),
        _stale: true,
      });
    }
    return rows;
  }, [contractCandidates, modalData?.keiyaku_id, modalData?.keiyaku_name, modalData?.tenpo_id, modalData?.keiyaku_start_date]);

  const selectedTenpoSummary = useMemo(() => {
    const id = String(modalData?.tenpo_id || '').trim();
    const inputName = String(modalData?.tenpo_name || '').trim();
    const direct = id ? tenpoMetaById.get(id) : null;
    const byName = inputName ? tenpoMetaByName.get(inputName) : null;
    const tenpoName = String(direct?.name || byName?.name || inputName || '').trim();
    if (!tenpoName) {
      return {
        label: '未選択',
        tori: '',
        ids: '',
      };
    }
    const yagouName = String(direct?.yagou_name || byName?.yagou_name || modalData?.yagou_name || '').trim();
    const toriName = String(direct?.torihikisaki_name || byName?.torihikisaki_name || modalData?.torihikisaki_name || '').trim();
    return {
      label: formatTenpoDisplay(id, tenpoName, yagouName),
      tori: toriName,
      ids: [id || String(direct?.tenpo_id || byName?.tenpo_id || '').trim(), String(direct?.yagou_id || byName?.yagou_id || modalData?.yagou_id || '').trim(), String(direct?.torihikisaki_id || byName?.torihikisaki_id || modalData?.torihikisaki_id || '').trim()].filter(Boolean).join(' ・ '),
    };
  }, [
    modalData?.tenpo_id,
    modalData?.tenpo_name,
    modalData?.yagou_name,
    modalData?.yagou_id,
    modalData?.torihikisaki_name,
    modalData?.torihikisaki_id,
    tenpoMetaById,
    tenpoMetaByName,
    formatTenpoDisplay,
  ]);

  const tenpoSearchValue = useMemo(() => {
    const q = String(modalData?.tenpo_query || '').trim();
    if (q) return q;
    return selectedTenpoSummary.label === '未選択' ? '' : selectedTenpoSummary.label;
  }, [modalData?.tenpo_query, selectedTenpoSummary.label]);
  const hasTenpoQuery = String(modalData?.tenpo_query || '').trim().length > 0;
  const hasSelectedTenpo = String(modalData?.tenpo_id || '').trim().length > 0;

  const filteredItems = useMemo(() => {
    const q = String(listQuery || '').trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    const matched = (items || []).filter((it) => {
      const metaById = tenpoMetaById.get(String(it?.tenpo_id || '').trim());
      const metaByName = tenpoMetaByName.get(String(it?.tenpo_name || '').trim());
      const toriName = String(it?.torihikisaki_name || metaById?.torihikisaki_name || metaByName?.torihikisaki_name || '').trim();
      const yagouName = String(it?.yagou_name || metaById?.yagou_name || metaByName?.yagou_name || '').trim();
      const siteLabel = formatTenpoDisplay(it?.tenpo_id, it?.tenpo_name, yagouName);
      const serviceIds = Array.isArray(it?.service_ids) ? it.service_ids : [];
      const serviceNames = Array.isArray(it?.service_names) ? it.service_names : [];
      const searchBlob = [
        it?.yakusoku_id,
        it?.keiyaku_id,
        it?.keiyaku_name,
        it?.keiyaku_start_date,
        it?.tenpo_id,
        it?.tenpo_name,
        siteLabel,
        toriName,
        yagouName,
        metaById?.torihikisaki_id,
        metaById?.yagou_id,
        it?.service_id,
        it?.service_name,
        ...serviceIds,
        ...serviceNames,
        it?.type,
        it?.status,
        it?.memo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return !tokens.length || tokens.every((tk) => searchBlob.includes(tk));
    });
    return [...matched].sort((a, b) => {
      const aTenpoId = normText(a?.tenpo_id);
      const bTenpoId = normText(b?.tenpo_id);
      const aMetaById = tenpoMetaById.get(aTenpoId);
      const bMetaById = tenpoMetaById.get(bTenpoId);
      const aMetaByName = tenpoMetaByName.get(normText(a?.tenpo_name));
      const bMetaByName = tenpoMetaByName.get(normText(b?.tenpo_name));

      const aToriId = normText(a?.torihikisaki_id || aMetaById?.torihikisaki_id || aMetaByName?.torihikisaki_id);
      const bToriId = normText(b?.torihikisaki_id || bMetaById?.torihikisaki_id || bMetaByName?.torihikisaki_id);
      const aYagouId = normText(a?.yagou_id || aMetaById?.yagou_id || aMetaByName?.yagou_id);
      const bYagouId = normText(b?.yagou_id || bMetaById?.yagou_id || bMetaByName?.yagou_id);
      const aKokyakuId = normText(a?.kokyaku_id || (aToriId ? aToriId.replace(/^TORI#/i, 'KOKYAKU#') : ''));
      const bKokyakuId = normText(b?.kokyaku_id || (bToriId ? bToriId.replace(/^TORI#/i, 'KOKYAKU#') : ''));

      const idOrder = [
        [aKokyakuId, bKokyakuId],
        [aToriId, bToriId],
        [aYagouId, bYagouId],
        [aTenpoId, bTenpoId],
      ];
      for (const [av, bv] of idOrder) {
        const cmp = compareIdYoungFirst(av, bv);
        if (cmp !== 0) return cmp;
      }

      const aToriName = normText(a?.torihikisaki_name || aMetaById?.torihikisaki_name || aMetaByName?.torihikisaki_name);
      const bToriName = normText(b?.torihikisaki_name || bMetaById?.torihikisaki_name || bMetaByName?.torihikisaki_name);
      const aYagouName = normText(a?.yagou_name || aMetaById?.yagou_name || aMetaByName?.yagou_name);
      const bYagouName = normText(b?.yagou_name || bMetaById?.yagou_name || bMetaByName?.yagou_name);
      const aTenpoName = normText(a?.tenpo_name || aMetaById?.name || aMetaByName?.name);
      const bTenpoName = normText(b?.tenpo_name || bMetaById?.name || bMetaByName?.name);
      const nameOrder = [aToriName, aYagouName, aTenpoName, normText(a?.yakusoku_id)];
      const otherNameOrder = [bToriName, bYagouName, bTenpoName, normText(b?.yakusoku_id)];
      for (let i = 0; i < nameOrder.length; i += 1) {
        const cmp = String(nameOrder[i] || '').localeCompare(String(otherNameOrder[i] || ''), 'ja', {
          numeric: true,
          sensitivity: 'base',
        });
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [listQuery, items, tenpoMetaById, tenpoMetaByName, formatTenpoDisplay]);

  const serviceCandidates = useMemo(() => {
    const q = String(modalData?.service_query || '').trim().toLowerCase();
    if (!q) return services;
    return services
      .filter((s) => {
        const blob = [
          s?.name,
          s?.service_id,
          s?.category,
          s?.category_concept,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
  }, [modalData?.service_query, services]);

  const serviceGroups = useMemo(() => {
    const bucket = new Map();
    for (const svc of serviceCandidates) {
      const meta = getServiceCategoryMeta(svc);
      if (!bucket.has(meta.key)) {
        bucket.set(meta.key, { key: meta.key, label: meta.label, items: [] });
      }
      bucket.get(meta.key).items.push(svc);
    }
    const order = ['kitchen_haccp', 'aircon', 'floor', 'pest_hygiene', 'maintenance', 'window_wall', 'cleaning', 'pest', 'other', 'uncategorized'];
    return Array.from(bucket.values()).sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.label.localeCompare(b.label, 'ja');
    });
  }, [serviceCandidates, getServiceCategoryMeta]);

  const activeServiceCategory = String(modalData?.service_category || 'all');
  const visibleServiceGroups = useMemo(() => {
    if (activeServiceCategory === 'all') return serviceGroups;
    return serviceGroups.filter((g) => g.key === activeServiceCategory);
  }, [activeServiceCategory, serviceGroups]);

  const setBucketDraft = useCallback((bucketKey, value) => {
    setModalData((prev) => ({
      ...prev,
      _tagDrafts: {
        ...(prev?._tagDrafts || {}),
        [bucketKey]: value,
      },
    }));
  }, []);

  const setBucketSearch = useCallback((bucketKey, value) => {
    setModalData((prev) => ({
      ...prev,
      _tagSearch: {
        ...(prev?._tagSearch || {}),
        [bucketKey]: value,
      },
    }));
  }, []);

  const setBucketAdvanced = useCallback((bucketKey, open) => {
    setModalData((prev) => ({
      ...prev,
      _tagAdvanced: {
        ...(prev?._tagAdvanced || {}),
        [bucketKey]: Boolean(open),
      },
    }));
  }, []);

  const serviceCandidatesForTag = useCallback((qRaw) => {
    const q = String(qRaw || '').trim().toLowerCase();
    const list = Array.isArray(services) ? services : [];
    if (!q) return list.slice(0, 80);
    return list
      .filter((s) => {
        const blob = [
          s?.name,
          s?.service_id,
          s?.category,
          s?.category_concept,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 80);
  }, [services]);

  const selectedServicesForModal = useMemo(() => {
    const ids = Array.isArray(modalData?.service_ids) ? modalData.service_ids.map((x) => String(x)).filter(Boolean) : [];
    const names = Array.isArray(modalData?.service_names) ? modalData.service_names.map((x) => String(x)).filter(Boolean) : [];
    const byId = new Map((services || []).map((s) => [String(s?.service_id || ''), s]));
    return ids.map((sid, idx) => ({
      service_id: sid,
      name: names[idx] || String(byId.get(sid)?.name || sid),
    }));
  }, [modalData?.service_ids, modalData?.service_names, services]);

  const serviceDisplayNameById = useMemo(() => {
    const m = new Map();
    (services || []).forEach((s) => {
      const sid = String(s?.service_id || '').trim();
      if (!sid) return;
      m.set(sid, String(s?.name || sid));
    });
    const ids = Array.isArray(modalData?.service_ids) ? modalData.service_ids : [];
    const names = Array.isArray(modalData?.service_names) ? modalData.service_names : [];
    ids.forEach((sid, idx) => {
      const key = String(sid || '').trim();
      if (!key) return;
      const nm = String(names[idx] || '').trim();
      if (nm) m.set(key, nm);
    });
    return m;
  }, [services, modalData?.service_ids, modalData?.service_names]);

  const serviceMasterNameById = useMemo(() => {
    const m = new Map();
    (services || []).forEach((s) => {
      const sid = String(s?.service_id || '').trim();
      if (!sid) return;
      m.set(sid, String(s?.name || sid).trim());
    });
    return m;
  }, [services]);

  const serviceMasterIdSet = useMemo(() => new Set(Array.from(serviceMasterNameById.keys())), [serviceMasterNameById]);

  const toServiceTagLabel = useCallback((rawTag) => {
    const key = String(rawTag || '').trim();
    if (!key) return '';
    return serviceDisplayNameById.get(key) || key;
  }, [serviceDisplayNameById]);

  const defaultTeikiService = useMemo(() => {
    const list = Array.isArray(services) ? services : [];
    return (
      list.find((s) => /定期清掃/.test(String(s?.name || ''))) ||
      list.find((s) => /清掃/.test(String(s?.name || ''))) ||
      list[0] ||
      null
    );
  }, [services]);

  const defaultTanpatsuService = useMemo(() => {
    const list = Array.isArray(services) ? services : [];
    return (
      list.find((s) => /スポット清掃|単発|追加清掃/.test(String(s?.name || ''))) ||
      list.find((s) => /清掃/.test(String(s?.name || ''))) ||
      list[0] ||
      null
    );
  }, [services]);

  const existingIcsSourceKeys = useMemo(() => {
    const set = new Set();
    (items || []).forEach((it) => {
      const memo = String(it?.memo || '');
      const m = memo.match(/ics_source=([^;\s]+)/i);
      if (m?.[1]) set.add(String(m[1]).trim());
    });
    return set;
  }, [items]);

  const existingIcsUidKeys = useMemo(() => {
    const set = new Set();
    (items || []).forEach((it) => {
      const memo = String(it?.memo || '');
      const mk = memo.match(/ics_uid_keys=([^;\s]+)/i);
      if (mk?.[1]) {
        String(mk[1])
          .split(',')
          .map((x) => String(x || '').trim())
          .filter(Boolean)
          .forEach((uid) => set.add(uid));
      }
      const m = memo.match(/ics_source=([^;\s]+)/i);
      if (!m?.[1]) return;
      const source = String(m[1]).trim();
      const uid = source.split('|')[0];
      if (uid) set.add(uid);
    });
    return set;
  }, [items]);

  const resolveTenpoByInput = useCallback((inputRaw) => {
    const input = String(inputRaw || '').trim();
    if (!input) return null;
    const byId = tenpoMetaById.get(input);
    if (byId) return byId;
    const byName = tenpoMetaByName.get(input);
    if (byName) return byName;
    const norm = normalizeMatchText(input);
    let best = null;
    let bestScore = 0;
    (tenpos || []).forEach((tp) => {
      const display = formatTenpoDisplay(tp.tenpo_id, tp.name, tp.yagou_name);
      const names = [tp?.name, tp?.yagou_name, tp?.torihikisaki_name, display, tp?.tenpo_id];
      let score = 0;
      names.forEach((n) => {
        const nn = normalizeMatchText(n);
        if (!nn) return;
        if (nn === norm) score = Math.max(score, 300);
        else if (nn.includes(norm) || norm.includes(nn)) score = Math.max(score, Math.min(220, nn.length * 3));
      });
      if (score > bestScore) {
        bestScore = score;
        best = tp;
      }
    });
    return bestScore > 0 ? best : null;
  }, [tenpoMetaById, tenpoMetaByName, tenpos, formatTenpoDisplay]);

  const parseIcsToPreview = useCallback(() => {
    setIcsParseError('');
    setIcsImportSummary(null);
    setIcsContentSyncSummary(null);
    setIcsPriceSyncSummary(null);
    const src = String(icsText || '').trim();
    if (!src) {
      setIcsPreview([]);
      setIcsParseError('ICS内容が空です');
      return;
    }
    const parsed = parseIcsEvents(src);
    if (!parsed.length) {
      setIcsPreview([]);
      setIcsParseError('VEVENT が見つかりません');
      return;
    }

    const previewRaw = parsed.map((ev, idx) => {
      const sourceKey = `${String(ev.uid || `NO_UID_${idx + 1}`).trim()}|${String(ev.recurrenceId || 'base').trim()}`;
      const summaryHints = extractSummaryHints(ev.summary);
      const summaryNorm = normalizeMatchText(ev.summary);
      const locationNorm = normalizeMatchText(ev.location);
      const descriptionNorm = normalizeMatchText(ev.description);
      const haystack = [ev.summary, ev.location, ev.description].filter(Boolean).join(' ');
      // SUMMARY優先: 屋号/店舗/プランが載る前提のため、重みを高くする
      const weightedText = [summaryNorm, summaryNorm, summaryHints.tenpoHint, locationNorm, descriptionNorm].filter(Boolean).join(' ');
      const haystackNorm = normalizeMatchText(weightedText);
      const isCleaning = ICS_CLEANING_PATTERN.test(haystack);
      const type = String(ev.rrule || '').trim() ? 'teiki' : 'tanpatsu';
      const fallbackService = type === 'teiki' ? defaultTeikiService : defaultTanpatsuService;
      const serviceText = [summaryHints.planHint, summaryNorm, descriptionNorm].filter(Boolean).join(' ');
      const matchedService = pickBestServiceByText(services, serviceText, fallbackService);
      const serviceId = String(matchedService?.service_id || '').trim();
      const serviceName = serviceMasterNameById.get(serviceId) || String(matchedService?.name || '').trim();
      const matchedResult = pickBestTenpoByEvent(tenpos, {
        summary: ev.summary,
        location: ev.location,
        description: ev.description,
        tenpoHint: summaryHints.tenpoHint,
      });
      const matchedTenpo = matchedResult.tenpo;
      const matchedScore = matchedResult.score;
      const unresolvedStoreLabel = matchedTenpo ? '' : guessStoreLabelFromEvent(ev.summary, ev.location);
      const extractedServiceContent = extractServiceContentFromEvent(ev.summary, ev.description, serviceName, ev.location);
      const extractedPriceCandidates = extractPriceCandidatesFromEvent(ev.summary, ev.description, ev.location);

      const rruleObj = parseRRuleObject(ev.rrule);
      const monthlyQuota = estimateMonthlyQuotaFromIcs(rruleObj);
      const taskMatrix = buildTaskMatrixFromIcs(serviceId, rruleObj);
      const startDate = parseIcsDateOnly(ev.dtstart);
      const duplicate = existingIcsSourceKeys.has(sourceKey) || (String(ev.uid || '').trim() ? existingIcsUidKeys.has(String(ev.uid || '').trim()) : false);
      const hasKnownService = Boolean(serviceId && serviceMasterIdSet.has(serviceId));
      const canCreate = Boolean(
        matchedTenpo &&
        hasKnownService &&
        startDate &&
        (!icsOnlyCleaning || isCleaning) &&
        !duplicate
      );
      const reason = duplicate
        ? '既存取込済み'
        : (!matchedTenpo
          ? `店舗未一致${unresolvedStoreLabel ? `（候補: ${unresolvedStoreLabel}）` : ''}`
          : (!serviceId
            ? 'サービス未設定'
            : (!hasKnownService
              ? 'サービス未一致(マスタ外)'
            : (!startDate
              ? '日付不正'
              : ((!icsOnlyCleaning || isCleaning) ? '' : '清掃対象外')))));

      return {
        sourceKey,
        uid: ev.uid,
        recurrenceId: ev.recurrenceId,
        summary: ev.summary || '(no summary)',
        location: ev.location || '',
        description: ev.description || '',
        unresolvedStoreLabel,
        summaryHints,
        haystack: haystackNorm,
        startDate,
        endDate: parseIcsDateOnly(ev.dtend),
        type,
        isCleaning,
        duplicate,
        include: (!icsOnlyCleaning || isCleaning) && !duplicate,
        canCreate,
        reason,
        monthlyQuota,
        serviceId,
        serviceName,
        serviceContent: extractedServiceContent.text,
        serviceContentTags: extractedServiceContent.tags,
        priceCandidates: extractedPriceCandidates,
        matchedScore,
        rruleObj,
        taskMatrix,
        tenpoInput: matchedTenpo ? formatTenpoDisplay(matchedTenpo.tenpo_id, matchedTenpo.name, matchedTenpo.yagou_name) : '',
        tenpo: matchedTenpo ? {
          tenpo_id: matchedTenpo.tenpo_id,
          tenpo_name: matchedTenpo.name,
          yagou_id: matchedTenpo.yagou_id || '',
          yagou_name: matchedTenpo.yagou_name || '',
          torihikisaki_id: matchedTenpo.torihikisaki_id || '',
          torihikisaki_name: matchedTenpo.torihikisaki_name || '',
        } : null,
      };
    });

    const deduped = dedupeIcsPreviewRows(previewRaw);
    const preview = icsOnlyCleaning ? deduped.filter((r) => r.isCleaning) : deduped;
    setIcsPreview(preview);
  }, [
    icsText,
    tenpos,
    services,
    defaultTeikiService,
    defaultTanpatsuService,
    serviceMasterNameById,
    serviceMasterIdSet,
    existingIcsSourceKeys,
    existingIcsUidKeys,
    icsOnlyCleaning,
    formatTenpoDisplay,
  ]);

  const updateIcsRow = useCallback((sourceKey, patch) => {
    setIcsPreview((prev) => (
      Array.isArray(prev)
        ? prev.map((row) => (row.sourceKey === sourceKey ? { ...row, ...patch } : row))
        : prev
    ));
  }, []);

  const excludeUnmatchedIcsRows = useCallback(() => {
    setIcsPreview((prev) => (
      Array.isArray(prev)
        ? prev.map((row) => (row?.tenpo?.tenpo_id ? row : { ...row, include: false }))
        : prev
    ));
  }, []);

  const applyTenpoInputToRow = useCallback((sourceKey, inputRaw) => {
    const picked = resolveTenpoByInput(inputRaw);
    if (!picked) {
      updateIcsRow(sourceKey, { tenpo: null, tenpoInput: String(inputRaw || '') });
      return;
    }
    updateIcsRow(sourceKey, {
      tenpoInput: formatTenpoDisplay(picked.tenpo_id, picked.name, picked.yagou_name),
      tenpo: {
        tenpo_id: picked.tenpo_id,
        tenpo_name: picked.name || '',
        yagou_id: picked.yagou_id || '',
        yagou_name: picked.yagou_name || '',
        torihikisaki_id: picked.torihikisaki_id || '',
        torihikisaki_name: picked.torihikisaki_name || '',
      },
    });
  }, [resolveTenpoByInput, updateIcsRow, formatTenpoDisplay]);

  const applyServiceToRow = useCallback((sourceKey, nextServiceId) => {
    const sid = String(nextServiceId || '').trim();
    const svc = (services || []).find((s) => String(s?.service_id || '').trim() === sid) || null;
    const canonicalName = serviceMasterNameById.get(sid) || String(svc?.name || '').trim();
    setIcsPreview((prev) => (
      Array.isArray(prev)
        ? prev.map((row) => {
          if (row.sourceKey !== sourceKey) return row;
          return {
            ...row,
            serviceId: sid,
            serviceName: canonicalName,
            serviceContent: String(row?.serviceContent || '').trim() || canonicalName,
            serviceContentTags: Array.isArray(row?.serviceContentTags) && row.serviceContentTags.length
              ? row.serviceContentTags
              : (canonicalName ? [canonicalName] : []),
            taskMatrix: buildTaskMatrixFromIcs(sid, row.rruleObj || {}),
          };
        })
        : prev
    ));
  }, [services, serviceMasterNameById]);

  const evaluateIcsRow = useCallback((row) => {
    const duplicate = existingIcsSourceKeys.has(String(row?.sourceKey || '').trim());
    const uid = String(row?.uid || '').trim();
    const duplicateByUid = uid ? existingIcsUidKeys.has(uid) : false;
    const isCleaning = Boolean(row?.isCleaning);
    const include = Boolean(row?.include);
    if (!include) return { duplicate, canCreate: false, reason: '除外' };
    if (duplicate || duplicateByUid) return { duplicate: true, canCreate: false, reason: '既存取込済み' };
    if (icsOnlyCleaning && !isCleaning) return { duplicate, canCreate: false, reason: '清掃対象外' };
    if (!row?.tenpo?.tenpo_id) {
      const unresolvedLabel = String(row?.unresolvedStoreLabel || '').trim();
      return {
        duplicate,
        canCreate: false,
        reason: unresolvedLabel
          ? `店舗未一致（候補: ${unresolvedLabel} / 解約・名称変更候補）`
          : '店舗未一致（解約・名称変更候補）',
      };
    }
    if (!String(row?.serviceId || '').trim()) return { duplicate, canCreate: false, reason: 'サービス未設定' };
    if (!serviceMasterIdSet.has(String(row?.serviceId || '').trim())) return { duplicate, canCreate: false, reason: 'サービス未一致(マスタ外)' };
    if (!String(row?.startDate || '').trim()) return { duplicate, canCreate: false, reason: '日付不正' };
    return { duplicate, canCreate: true, reason: '' };
  }, [existingIcsSourceKeys, existingIcsUidKeys, icsOnlyCleaning, serviceMasterIdSet]);

  const resolvedIcsRows = useMemo(() => (
    (Array.isArray(icsPreview) ? icsPreview : []).map((row) => {
      const ev = evaluateIcsRow(row);
      return { ...row, ...ev };
    })
  ), [icsPreview, evaluateIcsRow]);

  const importIcsPreviewToYakusoku = useCallback(async () => {
    const mergeableRows = (resolvedIcsRows || []).filter((r) => {
      if (!Boolean(r?.include)) return false;
      if (icsOnlyCleaning && !Boolean(r?.isCleaning)) return false;
      if (!String(r?.tenpo?.tenpo_id || '').trim()) return false;
      const sid = String(r?.serviceId || '').trim();
      return Boolean(sid && serviceMasterIdSet.has(sid));
    });
    if (!mergeableRows.length) {
      window.alert('統合対象がありません（対象ON/清掃判定/店舗/サービスを確認）');
      return;
    }

    const mergeTaskMatrix = (baseMatrix, nextMatrix) => {
      const out = normalizeTaskMatrix(baseMatrix);
      const src = normalizeTaskMatrix(nextMatrix);
      PLAN_BUCKETS.forEach((b) => {
        const k = b.key;
        const merged = new Set([...(out[k] || []), ...(src[k] || [])].map((x) => String(x || '').trim()).filter(Boolean));
        out[k] = Array.from(merged);
      });
      return out;
    };

    const grouped = new Map();
    for (const row of mergeableRows) {
      const tenpoId = String(row?.tenpo?.tenpo_id || '').trim();
      if (!tenpoId) continue;
      const siteKey = buildSiteMergeKey(row?.tenpo || {});
      if (!siteKey) continue;
      const sid = String(row?.serviceId || '').trim();
      const sname = serviceMasterNameById.get(sid) || String(row?.serviceName || '').trim();
      const uid = String(row?.uid || '').trim();
      const sourceKey = String(row?.sourceKey || '').trim();

      if (!grouped.has(siteKey)) {
        grouped.set(siteKey, {
          siteKey,
          tenpo: { ...(row.tenpo || {}) },
          type: row.type === 'teiki' ? 'teiki' : 'tanpatsu',
          monthlyQuota: Math.max(1, Number(row?.monthlyQuota || 1)),
          startDate: String(row?.startDate || '').trim(),
          taskMatrix: normalizeTaskMatrix(row?.taskMatrix || createEmptyTaskMatrix()),
          serviceIds: sid ? [sid] : [],
          serviceNames: sname ? [sname] : [],
          serviceContentTags: Array.isArray(row?.serviceContentTags)
            ? row.serviceContentTags.map((x) => String(x || '').trim()).filter(Boolean)
            : [],
          serviceContentTexts: [String(row?.serviceContent || '').trim()].filter(Boolean),
          sourceKeys: sourceKey ? [sourceKey] : [],
          uids: uid ? [uid] : [],
          summaries: [String(row?.summary || '').trim()].filter(Boolean),
          hasCreatable: Boolean(row?.canCreate),
        });
        continue;
      }

      const g = grouped.get(siteKey);
      if (!g) continue;
      if (row.type === 'teiki') g.type = 'teiki';
      g.monthlyQuota = Math.max(g.monthlyQuota, Math.max(1, Number(row?.monthlyQuota || 1)));
      if (String(row?.startDate || '').trim()) {
        const d = String(row.startDate).trim();
        g.startDate = g.startDate ? (d < g.startDate ? d : g.startDate) : d;
      }
      g.taskMatrix = mergeTaskMatrix(g.taskMatrix, row?.taskMatrix || createEmptyTaskMatrix());

      if (sid && !g.serviceIds.includes(sid)) g.serviceIds.push(sid);
      if (sname && !g.serviceNames.includes(sname)) g.serviceNames.push(sname);
      (Array.isArray(row?.serviceContentTags) ? row.serviceContentTags : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .forEach((tag) => {
          if (!g.serviceContentTags.includes(tag)) g.serviceContentTags.push(tag);
        });
      const sct = String(row?.serviceContent || '').trim();
      if (sct && !g.serviceContentTexts.includes(sct)) g.serviceContentTexts.push(sct);
      if (sourceKey && !g.sourceKeys.includes(sourceKey)) g.sourceKeys.push(sourceKey);
      if (uid && !g.uids.includes(uid)) g.uids.push(uid);
      const sm = String(row?.summary || '').trim();
      if (sm && !g.summaries.includes(sm)) g.summaries.push(sm);
      if (row?.canCreate) g.hasCreatable = true;
    }

    const pickBetterExisting = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      const aTeiki = String(a?.type || '').trim() === 'teiki';
      const bTeiki = String(b?.type || '').trim() === 'teiki';
      if (aTeiki && !bTeiki) return a;
      if (!aTeiki && bTeiki) return b;
      const au = String(a?.updated_at || '').trim();
      const bu = String(b?.updated_at || '').trim();
      if (au && bu) return bu > au ? b : a;
      return a;
    };
    const existingBySiteKey = new Map();
    (items || []).forEach((it) => {
      const key = buildSiteMergeKey(it);
      if (!key) return;
      const prev = existingBySiteKey.get(key);
      existingBySiteKey.set(key, pickBetterExisting(prev, it));
    });

    const rows = Array.from(grouped.values()).filter((r) => {
      const existing = existingBySiteKey.get(String(r?.siteKey || '').trim());
      return Boolean(existing || r?.hasCreatable);
    });
    if (!rows.length) {
      window.alert('店舗統合後に作成/更新できる対象がありません');
      return;
    }

    if (!window.confirm(`${rows.length}件のyakusokuを作成/更新します（同一店舗は統合）。実行しますか？`)) return;

    setIcsImporting(true);
    setIcsImportSummary(null);
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const row of rows) {
      const serviceIds = (Array.isArray(row.serviceIds) ? row.serviceIds : [])
        .map((x) => String(x || '').trim())
        .filter((sid) => sid && serviceMasterNameById.has(sid));
      if (!serviceIds.length) {
        failed += 1;
        errors.push(`${row?.tenpo?.tenpo_name || row?.tenpo?.tenpo_id || '店舗不明'}: サービス未一致(マスタ外)`);
        continue;
      }
      const serviceNames = serviceIds.map((sid) => serviceMasterNameById.get(sid) || sid);
      const primaryServiceId = serviceIds[0];
      const primaryServiceName = serviceNames[0] || primaryServiceId;
      const serviceContentTags = Array.from(new Set((Array.isArray(row.serviceContentTags) ? row.serviceContentTags : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean))).slice(0, 40);
      const serviceContent = serviceContentTags.length
        ? serviceContentTags.join(' / ')
        : (Array.isArray(row.serviceContentTexts) ? row.serviceContentTexts.map((x) => String(x || '').trim()).filter(Boolean).join(' / ') : '');
      const sourceKeys = (Array.isArray(row.sourceKeys) ? row.sourceKeys : []).filter(Boolean);
      const sourceUids = (Array.isArray(row.uids) ? row.uids : []).filter(Boolean);
      const summaryHead = (Array.isArray(row.summaries) ? row.summaries : []).filter(Boolean).slice(0, 3).join(' | ');
      const existing = existingBySiteKey.get(String(row?.siteKey || '').trim());
      const existingSvc = normalizeServiceSelection(existing || {});
      const existingSvcIds = (existingSvc?.service_ids || []).map((x) => String(x || '').trim()).filter(Boolean);
      const mergedServiceIds = Array.from(new Set([...existingSvcIds, ...serviceIds]))
        .filter((sid) => sid && serviceMasterNameById.has(sid));
      const mergedServiceNames = mergedServiceIds.map((sid) => serviceMasterNameById.get(sid) || sid);
      const existingContentTags = Array.isArray(existing?.service_contents)
        ? existing.service_contents.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      splitServiceContentTags(existing?.service_content || '').forEach((t) => {
        const tag = String(t || '').trim();
        if (tag) existingContentTags.push(tag);
      });
      const mergedContentTags = Array.from(new Set([...existingContentTags, ...serviceContentTags]))
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 80);
      const mergedContent = mergedContentTags.length
        ? mergedContentTags.join(' / ')
        : String(existing?.service_content || serviceContent || '').trim();
      const mergedType = (String(existing?.type || '').trim() === 'teiki' || row.type === 'teiki') ? 'teiki' : 'tanpatsu';
      const existingTask = normalizeTaskMatrix(existing?.recurrence_rule?.task_matrix || createEmptyTaskMatrix());
      const mergedTask = mergeTaskMatrix(existingTask, row.taskMatrix || createEmptyTaskMatrix());
      const existingStart = String(existing?.start_date || '').trim();
      const mergedStart = row.startDate
        ? (existingStart ? (row.startDate < existingStart ? row.startDate : existingStart) : row.startDate)
        : existingStart;
      const existingQuota = Math.max(1, Number(existing?.monthly_quota || 1));
      const mergedQuota = mergedType === 'teiki'
        ? Math.max(existingQuota, Math.max(1, Number(row.monthlyQuota || 1)))
        : 1;
      const existingMemo = String(existing?.memo || '').trim();
      const memoUidSet = new Set();
      const memoUidMatch = existingMemo.match(/ics_uid_keys=([^;\s]+)/i);
      if (memoUidMatch?.[1]) {
        String(memoUidMatch[1]).split(',').map((x) => String(x || '').trim()).filter(Boolean).forEach((uid) => memoUidSet.add(uid));
      }
      sourceUids.forEach((uid) => memoUidSet.add(uid));
      const memoSourceMatch = existingMemo.match(/ics_source=([^;\s]+)/i);
      const mergedSource = sourceKeys[0] || (memoSourceMatch?.[1] ? String(memoSourceMatch[1]).trim() : '');
      const mergedMemo = `ICS取込(統合): ${String(summaryHead || '').slice(0, 180)}; ics_source=${mergedSource}; ics_uid_keys=${Array.from(memoUidSet).join(',')}`;
      if (!existing && !row?.hasCreatable) {
        failed += 1;
        errors.push(`${row?.tenpo?.tenpo_name || row?.tenpo?.tenpo_id || '店舗不明'}: 新規作成条件不足（開始日/重複判定）`);
        continue;
      }
      const payload = {
        tenpo_id: row.tenpo.tenpo_id,
        tenpo_name: row.tenpo.tenpo_name,
        yagou_id: row.tenpo.yagou_id,
        yagou_name: row.tenpo.yagou_name,
        torihikisaki_id: row.tenpo.torihikisaki_id,
        torihikisaki_name: row.tenpo.torihikisaki_name,
        type: mergedType,
        service_ids: mergedServiceIds,
        service_names: mergedServiceNames,
        service_id: mergedServiceIds[0] || primaryServiceId,
        service_name: mergedServiceNames[0] || primaryServiceName,
        service_content: String(mergedContent || '').trim(),
        service_contents: mergedContentTags,
        monthly_quota: mergedQuota,
        price: Number(existing?.price || 0),
        start_date: mergedStart || '',
        status: String(existing?.status || 'active') || 'active',
        recurrence_rule: mergedType === 'teiki'
          ? { type: 'flexible', task_matrix: mergedTask }
          : { type: 'single' },
        memo: mergedMemo,
      };

      try {
        const isUpdate = Boolean(existing?.yakusoku_id);
        const path = isUpdate ? `/yakusoku/${existing.yakusoku_id}` : '/yakusoku';
        const method = isUpdate ? 'PUT' : 'POST';
        if (isUpdate) {
          payload.keiyaku_id = String(existing?.keiyaku_id || '').trim();
          payload.keiyaku_name = String(existing?.keiyaku_name || '').trim();
          payload.keiyaku_start_date = String(existing?.keiyaku_start_date || '').trim();
        }
        const res = await fetchYakusokuWithFallback(path, {
          method,
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          failed += 1;
          errors.push(`${row?.tenpo?.tenpo_name || row?.tenpo?.tenpo_id || '店舗不明'}: HTTP ${res.status} ${txt.slice(0, 160)}`);
          continue;
        }
        if (isUpdate) updated += 1;
        else created += 1;
      } catch (err) {
        failed += 1;
        errors.push(`${row?.tenpo?.tenpo_name || row?.tenpo?.tenpo_id || '店舗不明'}: ${err?.message || String(err)}`);
      }
    }

    setIcsImporting(false);
    setIcsImportSummary({
      created,
      updated,
      failed,
      errors: errors.slice(0, 10),
    });
    if (created > 0 || updated > 0) {
      await fetchItems();
      parseIcsToPreview();
    }
  }, [resolvedIcsRows, icsOnlyCleaning, serviceMasterIdSet, items, normalizeTaskMatrix, normalizeServiceSelection, serviceMasterNameById, fetchItems, parseIcsToPreview]);

  const icsServiceContentSyncGroups = useMemo(() => {
    const rows = Array.isArray(resolvedIcsRows) ? resolvedIcsRows : [];
    const grouped = new Map();
    rows.forEach((row) => {
      if (!Boolean(row?.include)) return;
      if (icsOnlyCleaning && !Boolean(row?.isCleaning)) return;
      if (!String(row?.tenpo?.tenpo_id || '').trim()) return;
      const siteKey = buildSiteMergeKey(row?.tenpo || {});
      if (!siteKey) return;
      const rowTags = Array.isArray(row?.serviceContentTags) && row.serviceContentTags.length
        ? row.serviceContentTags
        : splitServiceContentTags(row?.serviceContent || '');
      const rowTexts = [
        String(row?.serviceContent || '').trim(),
        String(row?.description || '').trim(),
      ].filter(Boolean);
      if (!rowTags.length && !rowTexts.length) return;
      if (!grouped.has(siteKey)) {
        grouped.set(siteKey, {
          siteKey,
          tenpo: { ...(row?.tenpo || {}) },
          tags: [],
          texts: [],
        });
      }
      const g = grouped.get(siteKey);
      if (!g) return;
      rowTags
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .forEach((tag) => {
          if (!g.tags.includes(tag)) g.tags.push(tag);
        });
      rowTexts.forEach((txt) => {
        if (txt && !g.texts.includes(txt)) g.texts.push(txt);
      });
    });
    return Array.from(grouped.values());
  }, [resolvedIcsRows, icsOnlyCleaning]);

  const icsServiceContentSyncTargetCount = useMemo(() => {
    if (!Array.isArray(icsServiceContentSyncGroups) || !icsServiceContentSyncGroups.length) return 0;
    const existingKeySet = new Set();
    (items || []).forEach((it) => {
      const key = buildSiteMergeKey(it);
      if (key) existingKeySet.add(key);
    });
    return icsServiceContentSyncGroups.filter((g) => existingKeySet.has(String(g?.siteKey || '').trim())).length;
  }, [icsServiceContentSyncGroups, items]);

  const syncIcsServiceContentToExistingYakusoku = useCallback(async () => {
    const groups = Array.isArray(icsServiceContentSyncGroups) ? icsServiceContentSyncGroups : [];
    if (!groups.length) {
      window.alert('同期対象がありません（対象ON/清掃判定/店舗一致/サービス内容を確認してください）');
      return;
    }

    const existingBySiteKey = new Map();
    (items || []).forEach((it) => {
      const key = buildSiteMergeKey(it);
      if (!key) return;
      const prev = existingBySiteKey.get(key);
      if (!prev) {
        existingBySiteKey.set(key, it);
        return;
      }
      const prevUpdated = String(prev?.updated_at || '').trim();
      const nextUpdated = String(it?.updated_at || '').trim();
      if (nextUpdated && (!prevUpdated || nextUpdated > prevUpdated)) existingBySiteKey.set(key, it);
    });

    const targets = groups
      .map((g) => ({ ...g, existing: existingBySiteKey.get(String(g?.siteKey || '').trim()) || null }))
      .filter((g) => Boolean(g?.existing?.yakusoku_id));

    if (!targets.length) {
      window.alert('既存yakusokuに一致する同期対象がありません（未一致は解約/名称変更候補の可能性）');
      return;
    }

    if (!window.confirm(`${targets.length}件の既存yakusokuへサービス内容を同期します。実行しますか？`)) return;

    setIcsContentSyncing(true);
    setIcsContentSyncSummary(null);
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const t of targets) {
      const existing = t.existing;
      const existingTags = Array.isArray(existing?.service_contents)
        ? existing.service_contents.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      splitServiceContentTags(existing?.service_content || '').forEach((tag) => {
        if (tag && !existingTags.includes(tag)) existingTags.push(tag);
      });

      const mergedTags = Array.from(new Set([
        ...existingTags,
        ...(Array.isArray(t.tags) ? t.tags.map((x) => String(x || '').trim()).filter(Boolean) : []),
      ])).slice(0, 50);

      const mergedContent = mergedTags.join(' / ').trim() || String(existing?.service_content || '').trim();
      const prevContent = String(existing?.service_content || '').trim();
      const prevTagsJson = JSON.stringify(existingTags);
      const nextTagsJson = JSON.stringify(mergedTags);
      if (prevContent === mergedContent && prevTagsJson === nextTagsJson) {
        skipped += 1;
        continue;
      }

      const payload = {
        ...existing,
        service_content: mergedContent,
        service_contents: mergedTags,
      };

      try {
        const res = await fetchYakusokuWithFallback(`/yakusoku/${existing.yakusoku_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          failed += 1;
          errors.push(`${t?.tenpo?.tenpo_name || t?.tenpo?.tenpo_id || existing.yakusoku_id}: HTTP ${res.status} ${txt.slice(0, 140)}`);
          continue;
        }
        updated += 1;
      } catch (err) {
        failed += 1;
        errors.push(`${t?.tenpo?.tenpo_name || t?.tenpo?.tenpo_id || existing.yakusoku_id}: ${err?.message || String(err)}`);
      }
    }

    setIcsContentSyncing(false);
    setIcsContentSyncSummary({
      targets: targets.length,
      updated,
      skipped,
      failed,
      errors: errors.slice(0, 10),
    });
    if (updated > 0) await fetchItems();
  }, [icsServiceContentSyncGroups, items, fetchItems]);

  const icsTeikiPriceSyncGroups = useMemo(() => {
    const rows = Array.isArray(resolvedIcsRows) ? resolvedIcsRows : [];
    const grouped = new Map();
    rows.forEach((row) => {
      if (!Boolean(row?.include)) return;
      if (icsOnlyCleaning && !Boolean(row?.isCleaning)) return;
      if (String(row?.type || '').trim() !== 'teiki') return;
      if (!String(row?.tenpo?.tenpo_id || '').trim()) return;
      const siteKey = buildSiteMergeKey(row?.tenpo || {});
      if (!siteKey) return;
      const candidates = (Array.isArray(row?.priceCandidates) ? row.priceCandidates : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0 && x % 1000 === 0);
      if (!candidates.length) return;
      if (!grouped.has(siteKey)) {
        grouped.set(siteKey, {
          siteKey,
          tenpo: { ...(row?.tenpo || {}) },
          counter: new Map(),
          totalObserved: 0,
        });
      }
      const g = grouped.get(siteKey);
      if (!g) return;
      candidates.forEach((price) => {
        g.counter.set(price, (g.counter.get(price) || 0) + 1);
        g.totalObserved += 1;
      });
    });

    const out = [];
    grouped.forEach((g) => {
      const counts = Array.from(g.counter.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0] - b[0];
      });
      if (!counts.length) return;
      const [topPrice, topCount] = counts[0];
      const secondCount = counts[1]?.[1] || 0;
      const uniqueCount = counts.length;
      const stable = uniqueCount === 1 || (topCount >= 2 && topCount > secondCount && topCount / Math.max(1, g.totalObserved) >= 0.5);
      out.push({
        siteKey: g.siteKey,
        tenpo: g.tenpo,
        stablePrice: stable ? topPrice : null,
        topPrice,
        topCount,
        totalObserved: g.totalObserved,
        uniqueCount,
      });
    });
    return out;
  }, [resolvedIcsRows, icsOnlyCleaning]);

  const icsTeikiPriceSyncTargetCount = useMemo(() => {
    if (!Array.isArray(icsTeikiPriceSyncGroups) || !icsTeikiPriceSyncGroups.length) return 0;
    const teikiBySiteKey = new Map();
    (items || []).forEach((it) => {
      const key = buildSiteMergeKey(it);
      if (!key) return;
      if (String(it?.type || '').trim() !== 'teiki') return;
      if (!teikiBySiteKey.has(key)) teikiBySiteKey.set(key, it);
    });
    return icsTeikiPriceSyncGroups.filter((g) => g?.stablePrice && teikiBySiteKey.has(String(g?.siteKey || '').trim())).length;
  }, [icsTeikiPriceSyncGroups, items]);

  const syncStableTeikiPriceFromIcs = useCallback(async () => {
    const groups = Array.isArray(icsTeikiPriceSyncGroups) ? icsTeikiPriceSyncGroups : [];
    if (!groups.length) {
      window.alert('定期清掃の金額候補がありません（対象ON/定期/満単位金額を確認してください）');
      return;
    }
    const teikiBySiteKey = new Map();
    (items || []).forEach((it) => {
      const key = buildSiteMergeKey(it);
      if (!key) return;
      if (String(it?.type || '').trim() !== 'teiki') return;
      const prev = teikiBySiteKey.get(key);
      if (!prev) {
        teikiBySiteKey.set(key, it);
        return;
      }
      const prevUpdated = String(prev?.updated_at || '').trim();
      const nextUpdated = String(it?.updated_at || '').trim();
      if (nextUpdated && (!prevUpdated || nextUpdated > prevUpdated)) teikiBySiteKey.set(key, it);
    });
    const targets = groups
      .filter((g) => Number.isFinite(g?.stablePrice) && g.stablePrice > 0)
      .map((g) => ({ ...g, existing: teikiBySiteKey.get(String(g?.siteKey || '').trim()) || null }))
      .filter((g) => Boolean(g?.existing?.yakusoku_id));
    if (!targets.length) {
      window.alert('既存の定期yakusokuに割り当て可能な安定金額がありません');
      return;
    }
    if (!window.confirm(`${targets.length}件の定期yakusokuへ、安定した満単位金額を割り当てます。実行しますか？`)) return;

    setIcsPriceSyncing(true);
    setIcsPriceSyncSummary(null);
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];
    for (const target of targets) {
      const existing = target.existing;
      const nextPrice = Number(target.stablePrice || 0);
      const prevPrice = Number(existing?.price || 0);
      if (nextPrice <= 0 || prevPrice === nextPrice) {
        skipped += 1;
        continue;
      }
      const payload = {
        ...existing,
        price: nextPrice,
      };
      try {
        const res = await fetchYakusokuWithFallback(`/yakusoku/${existing.yakusoku_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          failed += 1;
          errors.push(`${target?.tenpo?.tenpo_name || target?.tenpo?.tenpo_id || existing.yakusoku_id}: HTTP ${res.status} ${txt.slice(0, 140)}`);
          continue;
        }
        updated += 1;
      } catch (err) {
        failed += 1;
        errors.push(`${target?.tenpo?.tenpo_name || target?.tenpo?.tenpo_id || existing.yakusoku_id}: ${err?.message || String(err)}`);
      }
    }
    setIcsPriceSyncing(false);
    setIcsPriceSyncSummary({
      targets: targets.length,
      updated,
      skipped,
      failed,
      errors: errors.slice(0, 10),
    });
    if (updated > 0) await fetchItems();
  }, [icsTeikiPriceSyncGroups, items, fetchItems]);

  const icsStats = useMemo(() => {
    const rows = Array.isArray(resolvedIcsRows) ? resolvedIcsRows : [];
    return {
      total: rows.length,
      matched: rows.filter((r) => r.tenpo).length,
      unmatched: rows.filter((r) => !r.tenpo).length,
      cleaning: rows.filter((r) => r.isCleaning).length,
      included: rows.filter((r) => r.include).length,
      duplicates: rows.filter((r) => r.duplicate).length,
      creatable: rows.filter((r) => r.canCreate).length,
    };
  }, [resolvedIcsRows]);

  const icsMergeableRows = useMemo(() => (
    (Array.isArray(resolvedIcsRows) ? resolvedIcsRows : []).filter((r) => {
      if (!Boolean(r?.include)) return false;
      if (icsOnlyCleaning && !Boolean(r?.isCleaning)) return false;
      if (!String(r?.tenpo?.tenpo_id || '').trim()) return false;
      const sid = String(r?.serviceId || '').trim();
      return Boolean(sid && serviceMasterIdSet.has(sid));
    })
  ), [resolvedIcsRows, icsOnlyCleaning, serviceMasterIdSet]);

  const icsUpsertableSiteCount = useMemo(() => {
    const existingBySiteKey = new Set();
    (items || []).forEach((it) => {
      const key = buildSiteMergeKey(it);
      if (key) existingBySiteKey.add(key);
    });
    const grouped = new Map();
    icsMergeableRows.forEach((r) => {
      const key = buildSiteMergeKey(r?.tenpo || {});
      if (!key) return;
      const prev = grouped.get(key) || false;
      grouped.set(key, prev || Boolean(r?.canCreate));
    });
    let count = 0;
    grouped.forEach((hasCreatable, key) => {
      if (existingBySiteKey.has(key) || hasCreatable) count += 1;
    });
    return count;
  }, [icsMergeableRows, items]);

  const icsGroupedSiteCount = useMemo(() => {
    const rows = Array.isArray(icsMergeableRows) ? icsMergeableRows : [];
    const keys = new Set();
    rows.forEach((r) => {
      const key = buildSiteMergeKey(r?.tenpo || {});
      if (key) keys.add(key);
    });
    return keys.size;
  }, [icsMergeableRows]);

  const icsServiceOptions = useMemo(() => (
    (services || [])
      .map((s) => ({
        service_id: String(s?.service_id || '').trim(),
        name: String(s?.name || s?.service_id || '').trim(),
      }))
      .filter((s) => s.service_id)
  ), [services]);

  const icsTenpoOptions = useMemo(() => (
    (tenpos || []).map((tp) => ({
      tenpo_id: String(tp?.tenpo_id || '').trim(),
      label: formatTenpoDisplay(tp?.tenpo_id, tp?.name, tp?.yagou_name),
    }))
  ), [tenpos, formatTenpoDisplay]);

  const siteNameBackfillTargetCount = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter((it) => {
      const tenpoId = String(it?.tenpo_id || '').trim();
      if (!tenpoId) return false;
      const meta = tenpoMetaById.get(tenpoId);
      if (!meta) return false;
      const canonical = {
        tenpo_name: String(meta?.name || '').trim(),
        yagou_id: String(meta?.yagou_id || '').trim(),
        yagou_name: String(meta?.yagou_name || '').trim(),
        torihikisaki_id: String(meta?.torihikisaki_id || '').trim(),
        torihikisaki_name: String(meta?.torihikisaki_name || '').trim(),
      };
      return (
        String(it?.tenpo_name || '').trim() !== canonical.tenpo_name ||
        String(it?.yagou_id || '').trim() !== canonical.yagou_id ||
        String(it?.yagou_name || '').trim() !== canonical.yagou_name ||
        String(it?.torihikisaki_id || '').trim() !== canonical.torihikisaki_id ||
        String(it?.torihikisaki_name || '').trim() !== canonical.torihikisaki_name
      );
    }).length;
  }, [items, tenpoMetaById]);

  const addBucketTagValue = useCallback((bucketKey, tagValue) => {
    const value = String(tagValue || '').trim();
    if (!value) return;
    setModalData((prev) => {
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      Object.keys(tm).forEach((k) => {
        tm[k] = (tm[k] || []).filter((x) => String(x) !== value);
      });
      const nextSet = new Set(tm[bucketKey] || []);
      nextSet.add(value);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: [...nextSet],
          },
        },
        _bucketEnabled: {
          ...(prev?._bucketEnabled || createEmptyBucketEnabled()),
          [bucketKey]: true,
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const addBucketTag = useCallback((bucketKey) => {
    setModalData((prev) => {
      const draft = String(prev?._tagDrafts?.[bucketKey] || '').trim();
      if (!draft) return prev;
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      Object.keys(tm).forEach((k) => {
        tm[k] = (tm[k] || []).filter((x) => String(x) !== draft);
      });
      const nextSet = new Set(tm[bucketKey] || []);
      nextSet.add(draft);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: [...nextSet],
          },
        },
        _tagDrafts: {
          ...(prev?._tagDrafts || {}),
          [bucketKey]: '',
        },
        _bucketEnabled: {
          ...(prev?._bucketEnabled || createEmptyBucketEnabled()),
          [bucketKey]: true,
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const removeBucketTag = useCallback((bucketKey, tag) => {
    setModalData((prev) => {
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: (tm[bucketKey] || []).filter((x) => String(x) !== String(tag)),
          },
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const save = async () => {
    // Minimal operational validation (admin-only; avoids half-baked truth records).
    const tenpoId = String(modalData?.tenpo_id || '').trim();
    const type = String(modalData?.type || '').trim();
    const serviceIds = Array.isArray(modalData?.service_ids)
      ? modalData.service_ids.map((x) => String(x)).filter(Boolean)
      : [];
    const monthlyQuota = Number(modalData?.monthly_quota || 0);
    const price = Number(modalData?.price || 0);
    const keiyakuId = String(modalData?.keiyaku_id || '').trim();
    const tm = normalizeTaskMatrix(modalData?.recurrence_rule?.task_matrix);
    const tmTagCount = Object.values(tm).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

    if (!tenpoId) { window.alert('tenpo_id（現場）を選択してください'); return; }
    if (!['teiki', 'tanpatsu'].includes(type)) { window.alert('type（種別）は teiki / tanpatsu から選択してください'); return; }
    if (!serviceIds.length) { window.alert('service（サービス）を1件以上選択してください'); return; }
    if (type === 'teiki') {
      if (!Number.isFinite(monthlyQuota) || monthlyQuota < 1) { window.alert('monthly_quota（月間規定回数）は1以上で入力してください'); return; }
      if (!Number.isFinite(price) || price < 0) { window.alert('price（単価）は0以上で入力してください'); return; }
      if (tmTagCount <= 0) { window.alert('定期メニュー（task_matrix）を1件以上設定してください'); return; }
    }

    setSaving(true);
    try {
      const method = modalData.isNew ? 'POST' : 'PUT';
      const path = modalData.isNew ? '/yakusoku' : `/yakusoku/${modalData.yakusoku_id}`;
      const payload = { ...modalData };
      const serviceIds = Array.isArray(payload.service_ids)
        ? payload.service_ids.map((x) => String(x)).filter(Boolean)
        : (payload.service_id ? [String(payload.service_id)] : []);
      const serviceNames = Array.isArray(payload.service_names)
        ? payload.service_names.map((x) => String(x)).filter(Boolean)
        : (payload.service_name ? [String(payload.service_name)] : []);
      payload.service_ids = serviceIds;
      payload.service_names = serviceNames;
      // Backward compatibility: keep single-value fields for existing readers.
      payload.service_id = serviceIds[0] || '';
      payload.service_name = serviceNames[0] || '';
      payload.keiyaku_id = String(payload.keiyaku_id || '').trim();
      const linkedContract = payload.keiyaku_id ? contractById.get(payload.keiyaku_id) : null;
      if (linkedContract) {
        payload.keiyaku_name = String(linkedContract?.name || payload.keiyaku_name || '').trim();
        payload.keiyaku_start_date = String(linkedContract?.start_date || payload.keiyaku_start_date || '').trim();
        if (!String(payload.tenpo_id || '').trim()) payload.tenpo_id = String(linkedContract?.tenpo_id || '').trim();
      } else if (!payload.keiyaku_id) {
        payload.keiyaku_name = '';
        payload.keiyaku_start_date = '';
      }
      if (!String(payload.yagou_id || '').trim()) payload.yagou_name = '';
      delete payload.tenpo_query;
      delete payload.service_query;
      delete payload.service_category;
      delete payload._tagDrafts;
      delete payload._tagSearch;
      delete payload._tagAdvanced;
      delete payload._bucketEnabled;
      delete payload._monthLock;
      payload.onsite_flags = normalizeOnsiteFlags(payload.onsite_flags);
      const res = await fetchYakusokuWithFallback(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save');
      setModalData(null);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('この案件を削除（論理削除）しますか？')) return;
    try {
      const res = await fetchYakusokuWithFallback(`/yakusoku/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku DELETE HTTP ${res.status}`);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    }
  };

  const backfillYakusokuSiteNames = useCallback(async () => {
    const list = Array.isArray(items) ? items : [];
    const targets = list
      .map((it) => {
        const tenpoId = String(it?.tenpo_id || '').trim();
        if (!tenpoId) return null;
        const meta = tenpoMetaById.get(tenpoId);
        if (!meta) return null;
        const canonical = {
          tenpo_name: String(meta?.name || '').trim(),
          yagou_id: String(meta?.yagou_id || '').trim(),
          yagou_name: String(meta?.yagou_name || '').trim(),
          torihikisaki_id: String(meta?.torihikisaki_id || '').trim(),
          torihikisaki_name: String(meta?.torihikisaki_name || '').trim(),
        };
        const needs =
          String(it?.tenpo_name || '').trim() !== canonical.tenpo_name ||
          String(it?.yagou_id || '').trim() !== canonical.yagou_id ||
          String(it?.yagou_name || '').trim() !== canonical.yagou_name ||
          String(it?.torihikisaki_id || '').trim() !== canonical.torihikisaki_id ||
          String(it?.torihikisaki_name || '').trim() !== canonical.torihikisaki_name;
        if (!needs) return null;
        return { current: it, canonical };
      })
      .filter(Boolean);

    if (!targets.length) {
      window.alert('補完対象はありません（yakusoku の屋号/店舗名は最新です）');
      return;
    }
    if (!window.confirm(`${targets.length}件のyakusokuへ屋号/店舗名を補完します。実行しますか？`)) return;

    setSiteNameBackfilling(true);
    setSiteNameBackfillSummary(null);
    let updated = 0;
    let failed = 0;
    const errors = [];
    for (const target of targets) {
      const it = target.current;
      const payload = {
        ...it,
        ...target.canonical,
      };
      try {
        const res = await fetchYakusokuWithFallback(`/yakusoku/${it.yakusoku_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          failed += 1;
          errors.push(`${it?.yakusoku_id || '-'}: HTTP ${res.status} ${txt.slice(0, 140)}`);
          continue;
        }
        updated += 1;
      } catch (err) {
        failed += 1;
        errors.push(`${it?.yakusoku_id || '-'}: ${err?.message || String(err)}`);
      }
    }
    setSiteNameBackfilling(false);
    setSiteNameBackfillSummary({
      targets: targets.length,
      updated,
      failed,
      errors: errors.slice(0, 10),
    });
    if (updated > 0) await fetchItems();
  }, [items, tenpoMetaById, fetchItems]);

  const activeTaskMatrix = normalizeTaskMatrix(modalData?.recurrence_rule?.task_matrix);
  const isBucketEnabled = useCallback(
    (bucketKey) => Boolean(modalData?._bucketEnabled?.[bucketKey]) || (activeTaskMatrix[bucketKey] || []).length > 0,
    [modalData?._bucketEnabled, activeTaskMatrix]
  );
  const assignedServiceIdsAcrossBuckets = useMemo(() => {
    const ids = new Set();
    Object.values(activeTaskMatrix || {}).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((v) => {
        const sid = String(v || '').trim();
        if (sid) ids.add(sid);
      });
    });
    return ids;
  }, [activeTaskMatrix]);
  const pooledServicesForModal = useMemo(
    () => selectedServicesForModal.filter((svc) => !assignedServiceIdsAcrossBuckets.has(String(svc.service_id || ''))),
    [selectedServicesForModal, assignedServiceIdsAcrossBuckets]
  );
  const assignedServicesForModal = useMemo(
    () => selectedServicesForModal.filter((svc) => assignedServiceIdsAcrossBuckets.has(String(svc.service_id || ''))),
    [selectedServicesForModal, assignedServiceIdsAcrossBuckets]
  );

  const toggleBucketGroupOption = useCallback((bucketKey, checked) => {
    setModalData((prev) => {
      if (!prev) return prev;
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      if (!checked) {
        tm[bucketKey] = [];
      }
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: tm,
        },
        _bucketEnabled: {
          ...(prev?._bucketEnabled || createEmptyBucketEnabled()),
          [bucketKey]: Boolean(checked),
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const copyBucketTagsToEnabled = useCallback((sourceBucketKey) => {
    const sourceTags = Array.isArray(activeTaskMatrix?.[sourceBucketKey]) ? activeTaskMatrix[sourceBucketKey] : [];
    if (!sourceTags.length) {
      window.alert('先にこの月（曜日）へサービスを割り当ててください');
      return;
    }
    const familyKeys = getBucketFamilyKeys(sourceBucketKey);
    setModalData((prev) => {
      if (!prev) return prev;
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      const isEnabled = (k) => Boolean(prev?._bucketEnabled?.[k]) || (tm[k] || []).length > 0;
      familyKeys.forEach((k) => {
        if (k === sourceBucketKey) return;
        if (!isEnabled(k)) return;
        tm[k] = [...sourceTags];
      });
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: tm,
        },
      };
    });
  }, [activeTaskMatrix, normalizeTaskMatrix]);

  const renderBucketEditor = useCallback((bucket) => {
    const tags = activeTaskMatrix[bucket.key] || [];
    const quickAddServices = pooledServicesForModal;
    const familyKeys = getBucketFamilyKeys(bucket.key);
    const enabledSiblingCount = familyKeys
      .filter((k) => k !== bucket.key)
      .filter((k) => isBucketEnabled(k))
      .length;
    const canCopy = familyKeys.length > 1 && enabledSiblingCount > 0;
    return (
      <div key={bucket.key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{bucket.label}</div>
          {canCopy ? (
            <button
              type="button"
              onClick={() => copyBucketTagsToEnabled(bucket.key)}
              style={{
                border: '1px solid var(--line)',
                background: 'rgba(16,185,129,0.16)',
                color: 'var(--text)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="この割り当てを、同区分でチェック済みの他の月（曜日）へ一括反映"
            >
              同様の割り当て
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {tags.length ? tags.map((tag) => (
            <button
              key={`${bucket.key}-${tag}`}
              type="button"
              onClick={() => removeBucketTag(bucket.key, tag)}
              style={{
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--text)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
              title="クリックで削除"
            >
              {toServiceTagLabel(tag)} ×
            </button>
          )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>未設定</span>}
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>未割当プールから追加</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {quickAddServices.length ? quickAddServices.map((svc) => (
              <button
                key={`${bucket.key}-selected-${svc.service_id}`}
                type="button"
                onClick={() => addBucketTagValue(bucket.key, svc.service_id)}
                style={{
                  border: '1px solid var(--line)',
                  background: 'rgba(37,99,235,0.14)',
                  color: 'var(--text)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                title={`追加: ${svc.name} (${svc.service_id})`}
              >
                + {svc.name}
              </button>
            )) : (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {selectedServicesForModal.length ? '未割当プールにサービスがありません' : '先に上の「サービス」で選択してください'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    activeTaskMatrix,
    isBucketEnabled,
    removeBucketTag,
    toServiceTagLabel,
    selectedServicesForModal,
    pooledServicesForModal,
    addBucketTagValue,
    copyBucketTagsToEnabled,
  ]);

  return (
    <div className="admin-yotei-timeline-page">
      <div className="admin-yotei-timeline-content">
        <header className="yotei-head">
          <h1>実案件・定期管理 (yakusoku)</h1>
          <div className="yotei-head-actions">
            <div className="yotei-head-nav" aria-label="ページ移動">
              <Link to="/admin/yotei" className="yotei-head-link">YOTEI</Link>
              <Link to="/admin/ugoki" className="yotei-head-link">UGOKI</Link>
              <span className="yotei-head-link active" aria-current="page">YAKUSOKU</span>
            </div>
            <button className="primary" onClick={openNew}>新規案件登録</button>
            <button type="button" onClick={() => setIcsModalOpen(true)}>ICS取り込み</button>
            <button
              type="button"
              onClick={backfillYakusokuSiteNames}
              disabled={siteNameBackfilling || !siteNameBackfillTargetCount}
              title="tenpo_id を基準に、yakusoku の屋号/店舗名を一括補完"
            >
              {siteNameBackfilling ? '補完中...' : `屋号・店舗名補完 (${siteNameBackfillTargetCount})`}
            </button>
            <button onClick={fetchItems} disabled={loading}>{loading ? '...' : '更新'}</button>
          </div>
        </header>
        <div
          style={{
            padding: '0 20px 10px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="統合検索: 取引先 / 屋号 / 店舗 / サービス / ID / 状態 / メモ"
            style={{ minWidth: 280, flex: '1 1 420px' }}
          />
          <button type="button" onClick={() => setListQuery('')} disabled={!String(listQuery || '').trim()}>
            クリア
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {filteredItems.length} / {items.length} 件
          </span>
          {siteNameBackfillSummary ? (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              補完結果: 対象 {siteNameBackfillSummary.targets} / 更新 {siteNameBackfillSummary.updated} / 失敗 {siteNameBackfillSummary.failed}
            </span>
          ) : null}
        </div>
        {siteNameBackfillSummary?.errors?.length ? (
          <div style={{ padding: '0 20px 10px', fontSize: 12, color: '#f87171' }}>
            {siteNameBackfillSummary.errors.map((er, idx) => (
              <div key={`site-backfill-err-${idx}`}>{er}</div>
            ))}
          </div>
        ) : null}

        <div className="yakusoku-list" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>現場名</th>
                <th style={{ padding: '10px' }}>契約</th>
                <th style={{ padding: '10px' }}>サービス</th>
                <th style={{ padding: '10px' }}>種別</th>
                <th style={{ padding: '10px' }}>月枠</th>
                <th style={{ padding: '10px' }}>当月消化</th>
                <th style={{ padding: '10px' }}>単価</th>
                <th style={{ padding: '10px' }}>状態</th>
                <th style={{ padding: '10px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(it => {
                const monthKey = dayjs().format('YYYY-MM');
                const consumed = it.consumption_count ? (it.consumption_count[monthKey] || 0) : 0;
                const metaById = tenpoMetaById.get(String(it?.tenpo_id || '').trim());
                const metaByName = tenpoMetaByName.get(String(it?.tenpo_name || '').trim());
                const torihikisakiName = String(
                  it?.torihikisaki_name || metaById?.torihikisaki_name || metaByName?.torihikisaki_name || ''
                ).trim();
                const yagouName = String(
                  it?.yagou_name || metaById?.yagou_name || metaByName?.yagou_name || ''
                ).trim();
                const tenpoName = String(
                  it?.tenpo_name || metaById?.name || metaByName?.name || ''
                ).trim();
                const siteTags = [
                  { kind: 'torihikisaki', label: torihikisakiName },
                  { kind: 'yagou', label: yagouName },
                  { kind: 'tenpo', label: tenpoName },
                ].filter((t) => t.label);
                const seenSiteTagLabels = new Set();
                const uniqueSiteTags = siteTags.filter((tag) => {
                  const key = String(tag.label).toLowerCase();
                  if (!key || seenSiteTagLabels.has(key)) return false;
                  seenSiteTagLabels.add(key);
                  return true;
                });
                return (
                  <tr key={it.yakusoku_id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px', fontSize: '12px', color: 'var(--muted)' }}>{it.yakusoku_id}</td>
                    <td style={{ padding: '10px' }}>
                      {uniqueSiteTags.length ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {uniqueSiteTags.map((tag) => (
                            <span
                              key={`${it.yakusoku_id}-site-tag-${tag.kind}-${tag.label}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: 999,
                                padding: '2px 10px',
                                fontSize: 12,
                                lineHeight: 1.5,
                                border: '1px solid var(--line)',
                                background:
                                  tag.kind === 'torihikisaki'
                                    ? 'rgba(186,223,219,0.42)'
                                    : tag.kind === 'yagou'
                                      ? 'rgba(255,164,164,0.24)'
                                      : 'rgba(59,130,246,0.22)',
                                color: 'var(--text)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {it.keiyaku_name || it.keiyaku_id ? (
                        <div>
                          <div>{it.keiyaku_name || it.keiyaku_id}</div>
                          {it.keiyaku_start_date ? (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                              開始: {it.keiyaku_start_date}
                            </div>
                          ) : null}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {(() => {
                        const ids = Array.isArray(it.service_ids) ? it.service_ids : [];
                        const names = Array.isArray(it.service_names) ? it.service_names : [];
                        const primary = names[0] || it.service_name || ids[0] || it.service_id || '---';
                        const extra = Math.max(0, Math.max(ids.length, names.length) - 1);
                        return extra > 0 ? `${primary} (+${extra})` : primary;
                      })()}
                    </td>
                    <td style={{ padding: '10px' }}>{it.type === 'teiki' ? '定期' : '単発'}</td>
                    <td style={{ padding: '10px' }}>{it.monthly_quota || '-'}回</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: consumed >= (it.monthly_quota || 0) ? '#4caf50' : '#ff9800' }}>
                        {consumed}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>¥{(it.price || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px' }}>{it.status}</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => openEdit(it)}>編集</button>
                      <button className="danger" onClick={() => deleteItem(it.yakusoku_id)}>削除</button>
                    </td>
                  </tr>
                );
              })}
              {!filteredItems.length ? (
                <tr>
                  <td colSpan={10} style={{ padding: '16px 10px', color: 'var(--muted)' }}>
                    条件に一致する案件がありません
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {icsModalOpen && (
        <div className="yotei-modal-overlay" onClick={() => setIcsModalOpen(false)}>
          <div className="yotei-modal" onClick={(e) => e.stopPropagation()}>
            <div className="yotei-modal-header">
              <h2>ICS取り込み（yakusoku）</h2>
              <button
                onClick={() => setIcsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 24 }}
              >
                ×
              </button>
            </div>
            <div className="yotei-modal-content">
              <div className="yotei-form-group">
                <label>ICSファイル</label>
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const txt = await f.text();
                      setIcsText(txt);
                      setIcsFileName(f.name || '');
                      setIcsParseError('');
                      setIcsContentSyncSummary(null);
                      setIcsPriceSyncSummary(null);
                    } catch (err) {
                      setIcsParseError(err?.message || String(err));
                    }
                  }}
                />
                {icsFileName ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>読み込み済み: {icsFileName}</div>
                ) : null}
              </div>
              <div className="yotei-form-group">
                <label>ICS内容（貼り付け可）</label>
                <textarea
                  value={icsText}
                  onChange={(e) => {
                    setIcsText(e.target.value);
                    setIcsPriceSyncSummary(null);
                  }}
                  placeholder="BEGIN:VCALENDAR ..."
                  style={{ minHeight: 140, resize: 'vertical' }}
                />
              </div>
              <div className="yotei-form-group" style={{ marginBottom: 8 }}>
                <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={icsOnlyCleaning}
                    onChange={(e) => setIcsOnlyCleaning(e.target.checked)}
                  />
                  清掃系キーワードのみ取り込む（推奨）
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <button type="button" onClick={parseIcsToPreview}>プレビュー生成</button>
                <button
                  type="button"
                  onClick={() => setIcsPreview((prev) => (Array.isArray(prev) ? prev.map((r) => ({ ...r, include: true })) : prev))}
                  disabled={!resolvedIcsRows.length}
                >
                  全件ON
                </button>
                <button
                  type="button"
                  onClick={() => setIcsPreview((prev) => (Array.isArray(prev) ? prev.map((r) => ({ ...r, include: false })) : prev))}
                  disabled={!resolvedIcsRows.length}
                >
                  全件OFF
                </button>
                <button
                  type="button"
                  onClick={excludeUnmatchedIcsRows}
                  disabled={!icsStats.unmatched}
                  title="店舗未一致を対象外にします（解約/名称変更候補の切り分け用）"
                >
                  未一致を除外
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={importIcsPreviewToYakusoku}
                  disabled={icsImporting || !resolvedIcsRows.length}
                >
                  {icsImporting ? '取り込み中...' : `取り込み実行 (${icsUpsertableSiteCount})`}
                </button>
                <button
                  type="button"
                  onClick={syncIcsServiceContentToExistingYakusoku}
                  disabled={icsContentSyncing || !resolvedIcsRows.length}
                  title="既存yakusokuへ、カレンダー由来のサービス内容のみを追記同期"
                >
                  {icsContentSyncing ? '同期中...' : `既存へ内容同期 (${icsServiceContentSyncTargetCount})`}
                </button>
                <button
                  type="button"
                  onClick={syncStableTeikiPriceFromIcs}
                  disabled={icsPriceSyncing || !resolvedIcsRows.length}
                  title="定期清掃の安定した満単位金額のみを既存yakusokuへ割り当て"
                >
                  {icsPriceSyncing ? '金額割当中...' : `定期金額割当 (${icsTeikiPriceSyncTargetCount})`}
                </button>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  総数 {icsStats.total} / 対象ON {icsStats.included} / 店舗一致 {icsStats.matched} / 店舗未一致 {icsStats.unmatched} / 清掃判定 {icsStats.cleaning} / 重複 {icsStats.duplicates} / 統合対象行 {icsMergeableRows.length} / 統合後店舗 {icsGroupedSiteCount} / 実行対象店舗 {icsUpsertableSiteCount}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                ※プレビューはイベント単位表示です。取り込み実行時は同一屋号・店舗を1件のyakusokuに統合します。店舗未一致は「未一致を除外」で解約/名称変更候補として切り分けできます。
              </div>
              {icsParseError ? (
                <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{icsParseError}</div>
              ) : null}
              {icsImportSummary ? (
                <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--muted)' }}>
                  作成: {icsImportSummary.created}件 / 更新: {icsImportSummary.updated || 0}件 / 失敗: {icsImportSummary.failed}件
                  {icsImportSummary.errors?.length ? (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#f87171' }}>
                      {icsImportSummary.errors.map((er, i) => <li key={`ics-err-${i}`}>{er}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {icsContentSyncSummary ? (
                <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--muted)' }}>
                  サービス内容同期: 対象 {icsContentSyncSummary.targets}件 / 更新 {icsContentSyncSummary.updated}件 / 変更なし {icsContentSyncSummary.skipped}件 / 失敗 {icsContentSyncSummary.failed}件
                  {icsContentSyncSummary.errors?.length ? (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#f87171' }}>
                      {icsContentSyncSummary.errors.map((er, i) => <li key={`ics-sync-err-${i}`}>{er}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {icsPriceSyncSummary ? (
                <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--muted)' }}>
                  定期金額割当: 対象 {icsPriceSyncSummary.targets}件 / 更新 {icsPriceSyncSummary.updated}件 / 変更なし {icsPriceSyncSummary.skipped}件 / 失敗 {icsPriceSyncSummary.failed}件
                  {icsPriceSyncSummary.errors?.length ? (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#f87171' }}>
                      {icsPriceSyncSummary.errors.map((er, i) => <li key={`ics-price-err-${i}`}>{er}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {resolvedIcsRows.length ? (
                <>
                  <datalist id="ics-tenpo-options">
                    {icsTenpoOptions.map((tp) => (
                      <option key={tp.tenpo_id} value={tp.tenpo_id}>{`${tp.tenpo_id} ${tp.label}`}</option>
                    ))}
                  </datalist>
                  <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text)', fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                        <th style={{ padding: '8px 10px' }}>対象</th>
                        <th style={{ padding: '8px 10px' }}>状態</th>
                        <th style={{ padding: '8px 10px' }}>種別</th>
                        <th style={{ padding: '8px 10px' }}>開始日</th>
                        <th style={{ padding: '8px 10px' }}>店舗</th>
                        <th style={{ padding: '8px 10px' }}>サービス</th>
                        <th style={{ padding: '8px 10px' }}>サービス内容</th>
                        <th style={{ padding: '8px 10px' }}>月枠</th>
                        <th style={{ padding: '8px 10px' }}>金額候補</th>
                        <th style={{ padding: '8px 10px' }}>メモ抜粋</th>
                        <th style={{ padding: '8px 10px' }}>SUMMARY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedIcsRows.slice(0, 500).map((row) => (
                        <tr key={row.sourceKey} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(row.include)}
                              onChange={(e) => updateIcsRow(row.sourceKey, { include: e.target.checked })}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', color: row.canCreate ? '#16a34a' : '#f59e0b' }}>
                            {row.canCreate ? '取込可' : (row.reason || '-')}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <select
                              value={row.type}
                              onChange={(e) => updateIcsRow(row.sourceKey, { type: e.target.value })}
                            >
                              <option value="teiki">定期</option>
                              <option value="tanpatsu">単発</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input
                              type="date"
                              value={row.startDate || ''}
                              onChange={(e) => updateIcsRow(row.sourceKey, { startDate: e.target.value })}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', minWidth: 260 }}>
                            <input
                              list="ics-tenpo-options"
                              value={row.tenpoInput || row.tenpo?.tenpo_id || ''}
                              onChange={(e) => updateIcsRow(row.sourceKey, { tenpoInput: e.target.value })}
                              onBlur={(e) => applyTenpoInputToRow(row.sourceKey, e.target.value)}
                              placeholder="TENPO# or 屋号/店舗"
                              style={{ width: '100%' }}
                            />
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                              {row.tenpo
                                ? formatTenpoDisplay(row.tenpo.tenpo_id, row.tenpo.tenpo_name, row.tenpo.yagou_name)
                                : '未一致'}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px', minWidth: 220 }}>
                            <select
                              value={row.serviceId || ''}
                              onChange={(e) => applyServiceToRow(row.sourceKey, e.target.value)}
                              style={{ width: '100%' }}
                            >
                              <option value="">サービス未選択</option>
                              {icsServiceOptions.map((s) => (
                                <option key={s.service_id} value={s.service_id}>
                                  {s.name} ({s.service_id})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px', minWidth: 260 }}>
                            <input
                              type="text"
                              value={row.serviceContent || ''}
                              onChange={(e) => updateIcsRow(row.sourceKey, {
                                serviceContent: e.target.value,
                                serviceContentTags: splitServiceContentTags(e.target.value),
                              })}
                              placeholder="例: 害虫駆除 / グリスト / 床清掃"
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', minWidth: 86 }}>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={Number(row.monthlyQuota || 1)}
                              onChange={(e) => updateIcsRow(row.sourceKey, { monthlyQuota: Number(e.target.value || 1) })}
                              disabled={row.type !== 'teiki'}
                              style={{ width: 68 }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', minWidth: 120 }}>
                            {Array.isArray(row?.priceCandidates) && row.priceCandidates.length
                              ? row.priceCandidates
                                .filter((v) => Number.isFinite(Number(v)))
                                .map((v) => `¥${Number(v).toLocaleString()}`)
                                .join(' / ')
                              : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', maxWidth: 260 }}>
                            <div style={{ maxHeight: 64, overflow: 'auto', whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>
                              {String(row.description || '-').slice(0, 300) || '-'}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>{row.summary || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              ) : null}
            </div>
            <div className="yotei-modal-footer">
              <button onClick={() => setIcsModalOpen(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {modalData && (
        <div className="yotei-modal-overlay" onClick={() => setModalData(null)}>
          <div className="yotei-modal" onClick={e => e.stopPropagation()}>
            <div className="yotei-modal-header">
              <h2>{modalData.isNew ? '新規案件登録' : '案件編集'}</h2>
              <button onClick={() => setModalData(null)} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 24 }}>×</button>
            </div>
            <div className="yotei-modal-content">
              <div className="yotei-form-group">
                <label>種別</label>
                <select value={modalData.type} onChange={e => setModalData({ ...modalData, type: e.target.value })}>
                  <option value="teiki">定期 (teiki)</option>
                  <option value="tanpatsu">単発 (tanpatsu)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>現場名（統合検索）</label>
                <input
                  type="text"
                  value={tenpoSearchValue}
                  onChange={e => {
                    const nextQuery = e.target.value;
                    const normalized = String(nextQuery || '').trim();
                    const exact = tenpos.find((t) => {
                      const display = formatTenpoDisplay(t.tenpo_id, t.name, t.yagou_name);
                      return (
                        String(t.name || '').trim() === normalized ||
                        display === normalized ||
                        String(t.tenpo_id || '').trim() === normalized
                      );
                    });
                    const resolved = exact ? {
                      tenpo_id: exact.tenpo_id || '',
                      tenpo_name: exact.name || '',
                      torihikisaki_id: exact.torihikisaki_id || '',
                      yagou_id: exact.yagou_id || '',
                      torihikisaki_name: exact.torihikisaki_name || '',
                      yagou_name: exact.yagou_name || '',
                    } : null;
                    const pickedKeiyakuId = resolved
                      ? pickPrimaryContractIdForTenpo(resolved.tenpo_id, modalData?.keiyaku_id)
                      : modalData?.keiyaku_id;
                    const baseNext = {
                      ...modalData,
                      tenpo_query: nextQuery,
                      ...(resolved || {}),
                    };
                    setModalData(
                      resolved
                        ? applyContractToModal(baseNext, pickedKeiyakuId, { syncYakusokuStartDate: true })
                        : baseNext
                    );
                  }}
                  placeholder="取引先 / 屋号 / 店舗 / ID で検索"
                />
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  候補をタップすると「最終選択（保存対象）」に反映されます
                </div>
                <div style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {tenpoCandidates.map((tp) => (
                    <button
                      key={tp.tenpo_id}
                      type="button"
                      aria-pressed={String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim()}
                      onClick={() => {
                        const pickedKeiyakuId = pickPrimaryContractIdForTenpo(tp.tenpo_id, modalData?.keiyaku_id);
                        const baseNext = {
                          ...modalData,
                          tenpo_name: tp.name,
                          tenpo_query: formatTenpoDisplay(tp.tenpo_id, tp.name, tp.yagou_name),
                          tenpo_id: tp.tenpo_id,
                          torihikisaki_id: tp.torihikisaki_id || '',
                          yagou_id: tp.yagou_id || '',
                          torihikisaki_name: tp.torihikisaki_name || '',
                          yagou_name: tp.yagou_name || '',
                        };
                        setModalData(applyContractToModal(baseNext, pickedKeiyakuId, { syncYakusokuStartDate: true }));
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim()
                          ? '1px solid #60a5fa'
                          : '1px solid var(--line)',
                        background: String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim()
                          ? 'rgba(96,165,250,0.15)'
                          : 'var(--panel)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span>{formatTenpoDisplay(tp.tenpo_id, tp.name, tp.yagou_name)}</span>
                        {String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim() ? (
                          <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>選択中</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {(tp.torihikisaki_name || '取引先未設定')} / {(tp.yagou_name || '屋号未設定')}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        {tp.tenpo_id} ・ {tp.yagou_id || '-'} ・ {tp.torihikisaki_id || '-'}
                      </div>
                    </button>
                  ))}
                  {!tenpoCandidates.length && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {hasTenpoQuery
                        ? '一致する候補がありません（最終選択は下のカードを確認）'
                        : '検索語を入力すると候補が表示されます'}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>最終選択ID: {modalData.tenpo_id || '未選択'}</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setModalData({
                        ...modalData,
                        tenpo_query: '',
                        tenpo_id: '',
                        tenpo_name: '',
                        keiyaku_id: '',
                        keiyaku_name: '',
                        keiyaku_start_date: '',
                        torihikisaki_id: '',
                        yagou_id: '',
                        torihikisaki_name: '',
                        yagou_name: '',
                      })}
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '2px 8px',
                        fontSize: 12,
                        background: 'transparent',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      選択解除
                    </button>
                    <Link to="/admin/torihikisaki-touroku" style={{ color: '#8bd8ff', textDecoration: 'none' }}>
                      新規顧客登録へ →
                    </Link>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    background: 'rgba(15,23,42,0.35)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                    最終選択（保存対象）
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedTenpoSummary.label}</div>
                  {!hasSelectedTenpo ? (
                    <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 2 }}>
                      まだ選択されていません（候補をタップしてください）
                    </div>
                  ) : null}
                  {selectedTenpoSummary.tori ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      取引先: {selectedTenpoSummary.tori}
                    </div>
                  ) : null}
                  {selectedTenpoSummary.ids ? (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {selectedTenpoSummary.ids}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="yotei-form-group">
                <label>契約（keiyaku）</label>
                <select
                  value={modalData.keiyaku_id || ''}
                  onChange={(e) => {
                    const nextId = String(e.target.value || '').trim();
                    setModalData((prev) => applyContractToModal(prev, nextId, { syncYakusokuStartDate: true }));
                  }}
                >
                  <option value="">未選択</option>
                  {contractSelectOptions.map((c) => (
                    <option key={c.keiyaku_id} value={c.keiyaku_id}>
                      {[c.name || c.keiyaku_id, c.start_date || c.application_date || '', c._stale ? '履歴' : '']
                        .filter(Boolean)
                        .join(' / ')}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                  {selectedContract
                    ? `選択中: ${selectedContract.name || selectedContract.keiyaku_id}（開始: ${getContractStartDate(selectedContract) || '-' }）`
                    : '任意です（契約が未確定でも案件を先行登録できます）'}
                  {' '}<Link to="/admin/master/keiyaku" style={{ color: '#8bd8ff', textDecoration: 'none' }}>契約マスタを開く →</Link>
                </div>
              </div>
              <div className="yotei-form-group">
                <label>yakusoku開始日</label>
                <input type="date" value={modalData.start_date} onChange={e => setModalData({ ...modalData, start_date: e.target.value })} />
              </div>
              <div className="yotei-form-group">
                <label>金額 (単価)</label>
                <input type="number" value={modalData.price} onChange={e => setModalData({ ...modalData, price: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>サービス</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" onClick={() => setServicePickerOpen(true)}>
                    サービスを選択（オーバーレイ）
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    選択件数: {(modalData.service_ids || []).length} 件
                  </span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Array.isArray(modalData.service_names) ? modalData.service_names : []).map((nm, idx) => {
                    const sid = String((modalData.service_ids || [])[idx] || '');
                    const key = `${sid || nm}-${idx}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const ids = [...(modalData.service_ids || [])];
                          const names = [...(modalData.service_names || [])];
                          ids.splice(idx, 1);
                          names.splice(idx, 1);
                          setModalData({
                            ...modalData,
                            service_ids: ids,
                            service_names: names,
                            service_id: ids[0] || '',
                            service_name: names[0] || '',
                          });
                        }}
                        style={{
                          border: '1px solid var(--line)',
                          background: 'var(--panel)',
                          color: 'var(--text)',
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        title="クリックで削除"
                      >
                        {nm || sid} ×
                      </button>
                    );
                  })}
                  {!(modalData.service_ids || []).length ? (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>未選択</span>
                  ) : null}
                </div>
              </div>
              {modalData.type === 'teiki' && (
                <div className="yotei-form-group">
                  <label>定期メニュー（周期タグ）</label>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                      選択済みサービス {selectedServicesForModal.length}件
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, marginBottom: 8, background: 'rgba(16,185,129,0.08)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                        割当済み ({assignedServicesForModal.length})
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {assignedServicesForModal.length ? assignedServicesForModal.map((svc) => (
                          <span
                            key={`assigned-${svc.service_id}`}
                            style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px', fontSize: 12, background: 'var(--panel)' }}
                          >
                            {svc.name}
                          </span>
                        )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>なし</span>}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'rgba(59,130,246,0.08)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                        未割当プール ({pooledServicesForModal.length})
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {pooledServicesForModal.length ? pooledServicesForModal.map((svc) => (
                          <span
                            key={`pool-${svc.service_id}`}
                            style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px', fontSize: 12, background: 'var(--panel)' }}
                          >
                            {svc.name}
                          </span>
                        )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>なし</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {renderBucketEditor(MONTHLY_BUCKET)}

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{BIMONTHLY_LABEL}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {BIMONTHLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {BIMONTHLY_BUCKETS
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{QUARTERLY_LABEL}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {QUARTERLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {QUARTERLY_BUCKETS
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{HALF_YEAR_LABEL}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {HALF_YEAR_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {HALF_YEAR_BUCKETS
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>

                    {renderBucketEditor(YEARLY_BUCKET)}
                    {renderBucketEditor(DAILY_BUCKET)}

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>週次・隔週（曜日指定）</div>

                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>週次</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {WEEKLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 6px' }}>隔週</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {BIWEEKLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {[...WEEKLY_BUCKETS, ...BIWEEKLY_BUCKETS]
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="yotei-form-group">
                <label>月間規定回数 (monthly_quota)</label>
                <input type="number" value={modalData.monthly_quota} onChange={e => setModalData({ ...modalData, monthly_quota: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>状態</label>
                <select value={modalData.status} onChange={e => setModalData({ ...modalData, status: e.target.value })}>
                  <option value="active">有効 (active)</option>
                  <option value="inactive">無効 (inactive)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>メモ</label>
                <textarea
                  value={modalData.memo}
                  onChange={e => setModalData({ ...modalData, memo: e.target.value })}
                  rows={3}
                  maxLength={200}
                  placeholder="短く（例: 鍵/ガス栓/ゴミ回収などの運用注意のみ）"
                />
              </div>
              <div className="yotei-form-group">
                <label>現場チェック（構造化）</label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {ONSITE_FLAG_GROUPS.map((group) => (
                    <div key={group.title} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                        {group.title}
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {group.items.map((it) => (
                          <label key={it.key} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--text)' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(modalData?.onsite_flags?.[it.key])}
                              onChange={(e) => setModalData({
                                ...modalData,
                                onsite_flags: {
                                  ...normalizeOnsiteFlags(modalData?.onsite_flags),
                                  [it.key]: e.target.checked,
                                },
                              })}
                            />
                            <span>{it.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="yotei-modal-footer">
              <button onClick={() => setModalData(null)}>キャンセル</button>
              <button className="primary" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
      {modalData && servicePickerOpen && (
        <div className="yakusoku-service-overlay" onClick={() => setServicePickerOpen(false)}>
          <div className="yakusoku-service-panel" onClick={(e) => e.stopPropagation()}>
            <div className="yakusoku-service-head">
              <strong>サービス選択</strong>
              <button type="button" onClick={() => setServicePickerOpen(false)}>閉じる</button>
            </div>
            <input
              type="text"
              value={modalData.service_query || ''}
              onChange={(e) => setModalData({ ...modalData, service_query: e.target.value })}
              placeholder="サービス名 / ID / カテゴリで検索"
            />
            <div className="yakusoku-service-count">候補 {serviceCandidates.length} 件 / 選択 {(modalData.service_ids || []).length} 件</div>
            <div className="yakusoku-service-categories">
              <button
                type="button"
                className={`yakusoku-service-cat-chip ${activeServiceCategory === 'all' ? 'active' : ''}`}
                onClick={() => setModalData({ ...modalData, service_category: 'all' })}
              >
                全カテゴリ ({serviceCandidates.length})
              </button>
              {serviceGroups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`yakusoku-service-cat-chip ${activeServiceCategory === g.key ? 'active' : ''}`}
                  onClick={() => setModalData({ ...modalData, service_category: g.key })}
                >
                  {g.label} ({g.items.length})
                </button>
              ))}
            </div>
            <div className="yakusoku-service-list">
              {visibleServiceGroups.map((group) => (
                <section key={group.key} className="yakusoku-service-group">
                  <div className="yakusoku-service-group-head">
                    <strong>{group.label}</strong>
                    <span>{group.items.length}件</span>
                  </div>
                  <div className="yakusoku-service-group-grid">
                    {group.items.map((s) => {
                      const sid = String(s?.service_id || '');
                      const checked = Array.isArray(modalData?.service_ids) && modalData.service_ids.includes(sid);
                      return (
                        <label key={sid} className="yakusoku-service-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleServiceSelection(s, e.target.checked)}
                          />
                          <div>
                            <div style={{ fontWeight: 700 }}>{String(s?.name || sid)}</div>
                            <div style={{ fontSize: 12, opacity: 0.82 }}>
                              {normalizeServiceConcept(s)} / {String(s?.category || '未分類')}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.68 }}>
                              {sid || '-'} ・ 標準単価 ¥{Number(s?.default_price || 0).toLocaleString()}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
              {!visibleServiceGroups.length ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>候補がありません。サービスマスタを確認してください。</div>
              ) : null}
            </div>
            <div className="yakusoku-service-foot">
              <button type="button" onClick={() => setServicePickerOpen(false)}>選択を反映して閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
