import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// Hamburger / back / admin-top are provided by GlobalNav.
import './admin-torihikisaki-touroku.css';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

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

async function apiJson(path, { method = 'GET', body } = {}) {
  const base = MASTER_API_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} HTTP ${res.status} ${text}`.trim());
  }
  // master API は JSON を返す前提
  return res.json();
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function norm(v) {
  return String(v || '').trim();
}

function safeFilePart(v) {
  const s = norm(v)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return s || 'misesapo_keiyaku';
}

function normalizeKeyPart(v) {
  return norm(v).toLowerCase().replace(/\s+/g, ' ');
}

function stableHash(input) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(input || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h >>> 0) * 0x01000193;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function buildOnboardingIdempotencyKey(tName, yName, tenpoName) {
  const effectiveYagou = norm(yName) || norm(tName);
  const keySource = [
    normalizeKeyPart(tName),
    normalizeKeyPart(effectiveYagou),
    normalizeKeyPart(tenpoName),
  ].join('|');
  return `onboarding-${stableHash(keySource)}`;
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getCurrentAccountName() {
  try {
    const user = JSON.parse(localStorage.getItem('cognito_user') || '{}') || {};
    const fromUser = String(
      user?.name || user?.displayName || user?.username || user?.email || ''
    ).trim();
    if (fromUser) return fromUser;
  } catch {
    // noop
  }

  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    '';
  if (!token || token.split('.').length !== 3) return '';

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(
      payload?.name ||
      payload?.preferred_username ||
      payload?.email ||
      payload?.['cognito:username'] ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export default function AdminTorihikisakiTourokuPage({ mode = 'register' }) {
  const isMasterMode = String(mode || '') === 'master';
  const nav = useNavigate();
  const contractPrintRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [mobileTab, setMobileTab] = useState('new');
  const [contractPdfBusy, setContractPdfBusy] = useState(false);
  const [contractSoukoBusy, setContractSoukoBusy] = useState(false);

  // 既存選択用
  const [torihikisakiList, setTorihikisakiList] = useState([]);
  const [selectedTorihikisakiId, setSelectedTorihikisakiId] = useState('');
  const [yagouList, setYagouList] = useState([]);
  const [selectedYagouId, setSelectedYagouId] = useState('');
  const [existingQuery, setExistingQuery] = useState('');
  const [existingIndex, setExistingIndex] = useState([]);
  const [existingIndexLoading, setExistingIndexLoading] = useState(false);

  // 問診票作成入力（旧: 一括作成）
  const [bulkTorihikisakiName, setBulkTorihikisakiName] = useState('');
  const [bulkYagouName, setBulkYagouName] = useState('');
  const [bulkTenpoName, setBulkTenpoName] = useState('');
  const [bulkPhone, setBulkPhone] = useState('');
  const [bulkEmail, setBulkEmail] = useState('');
  const [bulkTantouName, setBulkTantouName] = useState('');
  const [bulkAddress, setBulkAddress] = useState('');
  const [bulkUrl, setBulkUrl] = useState('');
  const [bulkJouhouTourokuShaName, setBulkJouhouTourokuShaName] = useState(() => getCurrentAccountName());
  const [bulkOpenKarteAfterCreate, setBulkOpenKarteAfterCreate] = useState(true);

  // 既存に追加入力
  const [addYagouName, setAddYagouName] = useState('');
  const [addTenpoName, setAddTenpoName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addTantouName, setAddTantouName] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addJouhouTourokuShaName, setAddJouhouTourokuShaName] = useState(() => getCurrentAccountName());
  const [contractTenpoCandidates, setContractTenpoCandidates] = useState([]);
  const [contractTenpoId, setContractTenpoId] = useState('');
  const [contract, setContract] = useState(() => ({
    application_date: todayYmd(),
    service_start_date: todayYmd(),
    company_name: '',
    company_stamp: '㊞',
    company_address: '',
    contact_person: '',
    phone: '',
    email: '',
    store_name: '',
    store_address: '',
    pricing: '料金表または見積書に定めるとおりとします。',
    cancel_rule: '別途定めるとおりとします。',
    payment_method: '請求書を送付いたします。指定の口座に当月締め翌月末までに支払いください。',
    valid_term: '原則利用開始日から1年間（但し、有効期間満了の30日前までにいずれの当事者からも本契約を終了させる旨の通知がなされなかった場合、本契約は同一の条件でさらに1年間延長されるものとし、以降も同様とします。）',
    withdrawal_notice: '30日前',
    special_notes: '店舗での設備に関するアラートやより良い店舗運営のために設備情報をミセサポプラットフォーム上に登録させていただきます。外部に公開するものではございませんので、ご安心ください。',
    provider_name: 'hairVR株式会社 ミセサポ事業部 代表取締役 正田和輝',
    provider_address: '東京都中央区日本橋茅場町1-8-1',
    provider_phone: '070-3332-3939',
  }));

  useEffect(() => {
    if (bulkJouhouTourokuShaName) return;
    const accountName = getCurrentAccountName();
    if (accountName) setBulkJouhouTourokuShaName(accountName);
  }, [bulkJouhouTourokuShaName]);

  useEffect(() => {
    if (addJouhouTourokuShaName) return;
    const accountName = getCurrentAccountName();
    if (accountName) setAddJouhouTourokuShaName(accountName);
  }, [addJouhouTourokuShaName]);

  const reloadTorihikisaki = useCallback(async () => {
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      // master API は scan+filter なので、返却件数は絞る（必要なら検索で運用）
      const data = await apiJson(`/master/torihikisaki?limit=500&jotai=yuko`);
      const items = getItems(data).sort((a, b) => norm(a?.name).localeCompare(norm(b?.name), 'ja'));
      setTorihikisakiList(items);
      setSelectedTorihikisakiId((cur) => {
        const current = String(cur || '').trim();
        if (!current) return '';
        const exists = items.some((it) => String(it?.torihikisaki_id || '').trim() === current);
        return exists ? current : '';
      });
    } catch (e) {
      setErr(e?.message || '取引先の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadYagou = useCallback(async (torihikisakiId) => {
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: '5000',
        jotai: 'yuko',
      });
      if (torihikisakiId) qs.set('torihikisaki_id', torihikisakiId);
      const data = await apiJson(`/master/yagou?${qs.toString()}`);
      const items = getItems(data).sort((a, b) => norm(a?.name).localeCompare(norm(b?.name), 'ja'));
      setYagouList(items);
      setSelectedYagouId((cur) => {
        const current = String(cur || '').trim();
        if (!current) return '';
        const exists = items.some((it) => String(it?.yagou_id || '').trim() === current);
        return exists ? current : '';
      });
    } catch (e) {
      setErr(e?.message || '屋号の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadExistingIndex = useCallback(async () => {
    setExistingIndexLoading(true);
    try {
      const [toriData, yagouData, tenpoData] = await Promise.all([
        apiJson('/master/torihikisaki?limit=5000&jotai=yuko'),
        apiJson('/master/yagou?limit=8000&jotai=yuko'),
        apiJson('/master/tenpo?limit=20000&jotai=yuko'),
      ]);
      const toriItems = getItems(toriData);
      const yagouItems = getItems(yagouData);
      const tenpoItems = getItems(tenpoData);

      const toriNameById = new Map();
      toriItems.forEach((t) => {
        const id = norm(t?.torihikisaki_id);
        if (id) toriNameById.set(id, norm(t?.name));
      });
      const yagouById = new Map();
      yagouItems.forEach((y) => {
        const id = norm(y?.yagou_id);
        if (!id) return;
        yagouById.set(id, {
          yagou_id: id,
          yagou_name: norm(y?.name),
          torihikisaki_id: norm(y?.torihikisaki_id),
          torihikisaki_name: norm(toriNameById.get(norm(y?.torihikisaki_id))),
        });
      });

      const next = [];
      // 取引先単位
      toriItems.forEach((t) => {
        const torihikisaki_id = norm(t?.torihikisaki_id);
        const torihikisaki_name = norm(t?.name);
        if (!torihikisaki_id) return;
        next.push({
          key: `tori:${torihikisaki_id}`,
          type: 'torihikisaki',
          torihikisaki_id,
          torihikisaki_name,
          yagou_id: '',
          yagou_name: '',
          tenpo_id: '',
          tenpo_name: '',
          search_blob: normalizeKeyPart([
            torihikisaki_name,
            torihikisaki_id,
          ].filter(Boolean).join(' ')),
        });
      });

      // 屋号単位（取引先未紐付けも対象）
      yagouItems.forEach((y) => {
        const yagou_id = norm(y?.yagou_id);
        const torihikisaki_id = norm(y?.torihikisaki_id);
        if (!yagou_id) return;
        const torihikisaki_name = norm(toriNameById.get(torihikisaki_id));
        const yagou_name = norm(y?.name);
        next.push({
          key: `yagou:${yagou_id}`,
          type: 'yagou',
          torihikisaki_id,
          torihikisaki_name,
          yagou_id,
          yagou_name,
          tenpo_id: '',
          tenpo_name: '',
          search_blob: normalizeKeyPart([
            torihikisaki_name,
            torihikisaki_id,
            yagou_name,
            yagou_id,
          ].filter(Boolean).join(' ')),
        });
      });

      // 店舗単位（取引先/屋号の片方未設定も対象）
      tenpoItems.forEach((tp) => {
        const tenpo_id = norm(tp?.tenpo_id);
        const torihikisaki_id = norm(tp?.torihikisaki_id);
        const yagou_id = norm(tp?.yagou_id);
        if (!tenpo_id) return;
        const torihikisaki_name = norm(toriNameById.get(torihikisaki_id));
        const y = yagouById.get(yagou_id) || {};
        const yagou_name = norm(y?.yagou_name) || norm(tp?.yagou_name);
        const tenpo_name = norm(tp?.name);
        next.push({
          key: `tenpo:${tenpo_id}`,
          type: 'tenpo',
          torihikisaki_id,
          torihikisaki_name,
          yagou_id,
          yagou_name,
          tenpo_id,
          tenpo_name,
          search_blob: normalizeKeyPart([
            torihikisaki_name,
            torihikisaki_id,
            yagou_name,
            yagou_id,
            tenpo_name,
            tenpo_id,
          ].filter(Boolean).join(' ')),
        });
      });

      setExistingIndex(next);
    } catch (e) {
      console.error('[torihikisaki-touroku] failed to build existing index:', e);
      setExistingIndex([]);
    } finally {
      setExistingIndexLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadTorihikisaki();
  }, [reloadTorihikisaki]);

  useEffect(() => {
    reloadExistingIndex();
  }, [reloadExistingIndex]);

  useEffect(() => {
    reloadYagou(selectedTorihikisakiId);
  }, [selectedTorihikisakiId, reloadYagou]);

  const torihikisakiById = useMemo(() => {
    const m = new Map();
    torihikisakiList.forEach((it) => {
      const id = it?.torihikisaki_id;
      if (!id) return;
      m.set(id, it);
    });
    return m;
  }, [torihikisakiList]);

  const selectedTorihikisaki = useMemo(() => {
    return selectedTorihikisakiId ? torihikisakiById.get(selectedTorihikisakiId) : null;
  }, [selectedTorihikisakiId, torihikisakiById]);

  const yagouById = useMemo(() => {
    const m = new Map();
    yagouList.forEach((it) => {
      const id = it?.yagou_id;
      if (!id) return;
      m.set(id, it);
    });
    return m;
  }, [yagouList]);

  const existingCandidates = useMemo(() => {
    const q = normalizeKeyPart(existingQuery);
    if (!q) return [];
    return existingIndex
      .filter((it) => it?.search_blob?.includes(q))
      .slice(0, 40);
  }, [existingIndex, existingQuery]);

  const contractTenpoById = useMemo(() => {
    const m = new Map();
    contractTenpoCandidates.forEach((tp) => {
      if (!tp?.tenpo_id) return;
      m.set(tp.tenpo_id, tp);
    });
    return m;
  }, [contractTenpoCandidates]);

  const contractText = useMemo(() => {
    const c = contract;
    return [
      '利用者登録 申込書（契約書）',
      'ミセサポ 利用規約に同意し、以下の通り、本サービスの利用を申し込みます。',
      '',
      `申込日: ${norm(c.application_date)} / 利用開始日: ${norm(c.service_start_date)}`,
      '',
      `個人／法人名: ${norm(c.company_name)} ${norm(c.company_stamp)}`,
      `住所／本店住所: ${norm(c.company_address)}`,
      `担当者: ${norm(c.contact_person)}`,
      `電話番号: ${norm(c.phone)}`,
      `メールアドレス: ${norm(c.email)}`,
      '',
      'サービスを利用したい店舗の名称及び住所',
      `店舗名: ${norm(c.store_name)}`,
      `店舗住所: ${norm(c.store_address)}`,
      '',
      `料金: ${norm(c.pricing)}`,
      `個別業務のキャンセル: ${norm(c.cancel_rule)}`,
      `支払方法: ${norm(c.payment_method)}`,
      `有効期間: ${norm(c.valid_term)}`,
      `退会予告期間: ${norm(c.withdrawal_notice)}`,
      `特約事項: ${norm(c.special_notes)}`,
      '',
      `サービス提供者: ${norm(c.provider_name)}`,
      `サービス提供者住所: ${norm(c.provider_address)}`,
      `サービス提供者電話: ${norm(c.provider_phone)}`,
      '',
    ].join('\n');
  }, [contract]);

  const updateContractField = useCallback((key, value) => {
    setContract((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadContractFromNew = useCallback(() => {
    setContract((prev) => ({
      ...prev,
      company_name: norm(bulkTorihikisakiName) || prev.company_name,
      company_address: norm(bulkAddress) || prev.company_address,
      contact_person: norm(bulkTantouName) || prev.contact_person,
      phone: norm(bulkPhone) || prev.phone,
      email: norm(bulkEmail) || prev.email,
      store_name: [norm(bulkYagouName), norm(bulkTenpoName)].filter(Boolean).join(' ') || prev.store_name,
      store_address: norm(bulkAddress) || prev.store_address,
    }));
    setOkMsg('契約書に「新規追加」入力値を反映しました');
    setErr('');
  }, [
    bulkTorihikisakiName,
    bulkAddress,
    bulkTantouName,
    bulkPhone,
    bulkEmail,
    bulkYagouName,
    bulkTenpoName,
  ]);

  const loadContractFromExisting = useCallback(async () => {
    const torihikisakiId = selectedTorihikisakiId;
    if (!torihikisakiId) {
      window.alert('取引先を選択してください');
      return;
    }
    setLoading(true);
    setErr('');
    setOkMsg('');
    try {
      const tori = torihikisakiById.get(torihikisakiId) || {};
      const selectedYagou = selectedYagouId ? (yagouById.get(selectedYagouId) || {}) : {};
      let firstTenpo = null;
      if (selectedYagouId) {
        const qs = new URLSearchParams({
          limit: '1',
          jotai: 'yuko',
          torihikisaki_id: torihikisakiId,
          yagou_id: selectedYagouId,
        });
        const tenpoData = await apiJson(`/master/tenpo?${qs.toString()}`);
        firstTenpo = getItems(tenpoData)?.[0] || null;
      }
      setContract((prev) => ({
        ...prev,
        company_name: norm(tori?.name) || prev.company_name,
        company_address: norm(tori?.address) || prev.company_address,
        contact_person: norm(tori?.tantou_name) || prev.contact_person,
        phone: norm(tori?.phone) || prev.phone,
        email: norm(tori?.email) || prev.email,
        store_name: [norm(selectedYagou?.name), norm(firstTenpo?.name)].filter(Boolean).join(' ') || prev.store_name,
        store_address: norm(firstTenpo?.address) || prev.store_address,
      }));
      setOkMsg('契約書に「既存に追加」選択値を反映しました');
    } catch (e) {
      setErr(e?.message || '既存情報の契約書反映に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [selectedTorihikisakiId, selectedYagouId, torihikisakiById, yagouById]);

  const buildContractPdfBlob = useCallback(async () => {
    const node = contractPrintRef.current;
    if (!node) throw new Error('契約書プレビューが見つかりません');

    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const blob = pdf.output('blob');
    const filenameBase = safeFilePart(norm(contract.company_name) || norm(contract.store_name));
    const datePart = safeFilePart(norm(contract.application_date) || todayYmd());
    const filename = `${filenameBase}_${datePart}_利用者登録申込書.pdf`;
    return { blob, filename };
  }, [contract.application_date, contract.company_name, contract.store_name]);

  const outputContractPdf = useCallback(async () => {
    setErr('');
    setOkMsg('');
    setContractPdfBusy(true);
    try {
      const { blob, filename } = await buildContractPdfBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        // popup block fallback
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setOkMsg('契約書PDFを出力しました');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setErr(e?.message || '契約書PDFの出力に失敗しました');
    } finally {
      setContractPdfBusy(false);
    }
  }, [buildContractPdfBlob]);

  const reloadContractTenpoCandidates = useCallback(async () => {
    if (!selectedTorihikisakiId) {
      setContractTenpoCandidates([]);
      setContractTenpoId('');
      return;
    }
    try {
      const qs = new URLSearchParams({
        limit: '20000',
        jotai: 'yuko',
        torihikisaki_id: selectedTorihikisakiId,
      });
      if (selectedYagouId) qs.set('yagou_id', selectedYagouId);
      const data = await apiJson(`/master/tenpo?${qs.toString()}`);
      const items = getItems(data).sort((a, b) => norm(a?.name).localeCompare(norm(b?.name), 'ja'));
      setContractTenpoCandidates(items);
      setContractTenpoId((cur) => {
        if (cur && items.some((it) => String(it?.tenpo_id) === String(cur))) return cur;
        return items?.[0]?.tenpo_id || '';
      });
    } catch (e) {
      console.error('[contract] tenpo candidates load failed', e);
      setContractTenpoCandidates([]);
      setContractTenpoId('');
    }
  }, [selectedTorihikisakiId, selectedYagouId]);

  useEffect(() => {
    reloadContractTenpoCandidates();
  }, [reloadContractTenpoCandidates]);

  const ensureSoukoForTenpo = useCallback(async (tenpoId) => {
    if (!tenpoId) throw new Error('保存先店舗が未選択です');
    const checkQs = new URLSearchParams({ limit: '20', jotai: 'yuko', tenpo_id: tenpoId });
    const check = await apiJson(`/master/souko?${checkQs.toString()}`);
    const existing = getItems(check)?.[0] || null;
    if (existing?.souko_id) return existing;

    const tenpo = contractTenpoById.get(tenpoId);
    const created = await apiJson('/master/souko', {
      method: 'POST',
      body: {
        tenpo_id: tenpoId,
        name: `${norm(tenpo?.name) || tenpoId} 顧客ストレージ`,
        jotai: 'yuko',
      },
    });
    if (!created?.souko_id) throw new Error('soukoの作成に失敗しました');
    return created;
  }, [contractTenpoById]);

  const upsertKeiyakuForTenpo = useCallback(async ({ tenpoId, contractDocKey, contractFileName }) => {
    if (!tenpoId) throw new Error('契約保存先店舗が未選択です');
    const tenpo = contractTenpoById.get(tenpoId) || {};
    const torihikisakiId = norm(tenpo?.torihikisaki_id) || norm(selectedTorihikisakiId);
    const yagouId = norm(tenpo?.yagou_id) || norm(selectedYagouId);
    const contractNameBase = norm(contract.store_name) || norm(contract.company_name) || norm(tenpo?.name) || tenpoId;
    const payloadBase = {
      name: `${contractNameBase} 利用契約`,
      torihikisaki_id: torihikisakiId,
      torihikisaki_name: norm(tenpo?.torihikisaki_name) || '',
      yagou_id: yagouId,
      yagou_name: norm(tenpo?.yagou_name) || '',
      tenpo_id: tenpoId,
      tenpo_name: norm(tenpo?.name) || '',
      application_date: norm(contract.application_date),
      start_date: norm(contract.service_start_date),
      status: 'active',
      source: 'contract_builder',
      company_name: norm(contract.company_name),
      contact_person: norm(contract.contact_person),
      phone: norm(contract.phone),
      email: norm(contract.email),
      pricing: norm(contract.pricing),
      payment_method: norm(contract.payment_method),
      valid_term: norm(contract.valid_term),
      cancel_rule: norm(contract.cancel_rule),
      withdrawal_notice: norm(contract.withdrawal_notice),
      special_notes: norm(contract.special_notes),
      contract_doc_key: norm(contractDocKey),
      contract_doc_file_name: norm(contractFileName),
      jotai: 'yuko',
    };

    const qs = new URLSearchParams({
      limit: '200',
      jotai: 'yuko',
      tenpo_id: tenpoId,
    });
    const existing = await apiJson(`/master/keiyaku?${qs.toString()}`);
    const rows = getItems(existing);
    const target = rows
      .sort((a, b) => norm(b?.updated_at).localeCompare(norm(a?.updated_at)))
      .find((it) => norm(it?.source) === 'contract_builder')
      || rows[0]
      || null;

    if (target?.keiyaku_id) {
      const updated = await apiJson(`/master/keiyaku/${encodeURIComponent(target.keiyaku_id)}`, {
        method: 'PUT',
        body: {
          ...target,
          ...payloadBase,
          keiyaku_id: target.keiyaku_id,
        },
      });
      return updated?.keiyaku_id || target.keiyaku_id;
    }

    const created = await apiJson('/master/keiyaku', {
      method: 'POST',
      body: payloadBase,
    });
    return created?.keiyaku_id || '';
  }, [
    contractTenpoById,
    selectedTorihikisakiId,
    selectedYagouId,
    contract,
  ]);

  const saveContractPdfLocal = useCallback(async () => {
    setErr('');
    setOkMsg('');
    setContractPdfBusy(true);
    try {
      const { blob, filename } = await buildContractPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOkMsg(`契約書PDFを保存しました: ${filename}`);
    } catch (e) {
      setErr(e?.message || '契約書PDFの保存に失敗しました');
    } finally {
      setContractPdfBusy(false);
    }
  }, [buildContractPdfBlob]);

  const saveContractPdfToSouko = useCallback(async () => {
    if (!contractTenpoId) {
      window.alert('保存先店舗を選択してください');
      return;
    }
    setErr('');
    setOkMsg('');
    setContractSoukoBusy(true);
    try {
      const { blob, filename } = await buildContractPdfBlob();
      const souko = await ensureSoukoForTenpo(contractTenpoId);

      const presign = await apiJson('/master/souko', {
        method: 'POST',
        body: {
          mode: 'presign_upload',
          tenpo_id: contractTenpoId,
          file_name: filename,
          content_type: 'application/pdf',
        },
      });
      if (!presign?.put_url || !presign?.key) throw new Error('soukoアップロードURL取得に失敗しました');

      const putRes = await fetch(presign.put_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: blob,
        redirect: 'follow',
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => '');
        throw new Error(`S3 upload failed (${putRes.status}) ${text}`.trim());
      }

      const nextFiles = [
        ...(Array.isArray(souko?.files) ? souko.files : []),
        {
          key: presign.key,
          file_name: filename,
          content_type: 'application/pdf',
          size: blob.size || 0,
          uploaded_at: nowIso(),
          kubun: 'teishutsu',
          doc_category: 'contract',
          preview_url: String(presign?.get_url || ''),
        },
      ];
      await apiJson(`/master/souko/${encodeURIComponent(souko.souko_id)}`, {
        method: 'PUT',
        body: {
          ...souko,
          files: nextFiles,
        },
      });

      const keiyakuId = await upsertKeiyakuForTenpo({
        tenpoId: contractTenpoId,
        contractDocKey: presign.key,
        contractFileName: filename,
      });

      const tenpoName = norm(contractTenpoById.get(contractTenpoId)?.name) || contractTenpoId;
      setOkMsg(`契約書PDFをsoukoに保存しました: ${tenpoName}${keiyakuId ? ` / 契約 ${keiyakuId}` : ''}`);
    } catch (e) {
      setErr(e?.message || '契約書PDFのsouko保存に失敗しました');
    } finally {
      setContractSoukoBusy(false);
    }
  }, [contractTenpoId, buildContractPdfBlob, ensureSoukoForTenpo, contractTenpoById, upsertKeiyakuForTenpo]);

  const onPickExistingCandidate = useCallback((hit) => {
    if (!hit) return;
    const toriId = norm(hit?.torihikisaki_id);
    const yagouId = norm(hit?.yagou_id);
    if (toriId) setSelectedTorihikisakiId(toriId);
    setSelectedYagouId(yagouId || '');
  }, []);

  const findExistingTenpoByNames = useCallback(async ({ torihikisakiName, yagouName, tenpoName }) => {
    const tNameNorm = normalizeKeyPart(torihikisakiName);
    const yNameNorm = normalizeKeyPart(yagouName);
    const tenpoNameNorm = normalizeKeyPart(tenpoName);
    if (!tNameNorm || !yNameNorm || !tenpoNameNorm) return null;

    const toriData = await apiJson('/master/torihikisaki?limit=5000&jotai=yuko');
    const toriItems = getItems(toriData);
    const matchedTori = toriItems.find((it) => normalizeKeyPart(it?.name) === tNameNorm);
    if (!matchedTori?.torihikisaki_id) return null;

    const yagouQs = new URLSearchParams({
      limit: '5000',
      jotai: 'yuko',
      torihikisaki_id: matchedTori.torihikisaki_id,
    });
    const yagouData = await apiJson(`/master/yagou?${yagouQs.toString()}`);
    const yagouItems = getItems(yagouData);
    const matchedYagou = yagouItems.find((it) => normalizeKeyPart(it?.name) === yNameNorm);
    if (!matchedYagou?.yagou_id) return null;

    const tenpoQs = new URLSearchParams({
      limit: '20000',
      jotai: 'yuko',
      torihikisaki_id: matchedTori.torihikisaki_id,
      yagou_id: matchedYagou.yagou_id,
    });
    const tenpoData = await apiJson(`/master/tenpo?${tenpoQs.toString()}`);
    const tenpoItems = getItems(tenpoData);
    const matchedTenpo = tenpoItems.find((it) => normalizeKeyPart(it?.name) === tenpoNameNorm);
    if (!matchedTenpo?.tenpo_id) return null;

    return {
      torihikisaki: matchedTori,
      yagou: matchedYagou,
      tenpo: matchedTenpo,
    };
  }, []);

  const createSoukoIfMissing = useCallback(async (tenpoId, tenpoName) => {
    if (!tenpoId) return;
    const checkQs = new URLSearchParams({ limit: '1', jotai: 'yuko', tenpo_id: tenpoId });
    const check = await apiJson(`/master/souko?${checkQs.toString()}`);
    const items = getItems(check);
    if (items.length > 0) return;
    await apiJson('/master/souko', {
      method: 'POST',
      body: {
        tenpo_id: tenpoId,
        name: `${tenpoName || tenpoId} 顧客ストレージ`,
        jotai: 'yuko',
      },
    });
  }, []);

  const onBulkCreate = useCallback(async () => {
    const tName = norm(bulkTorihikisakiName);
    const yNameInput = norm(bulkYagouName);
    const yName = yNameInput || tName;
    const tenpoNameInput = norm(bulkTenpoName);
    const tenpoName = tenpoNameInput || yName;
    if (!tName) {
      window.alert('取引先名は必須です');
      return;
    }
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const existing = await findExistingTenpoByNames({
        torihikisakiName: tName,
        yagouName: yName,
        tenpoName,
      });
      if (existing?.tenpo?.tenpo_id) {
        const go = window.confirm(
          `同名の既存店舗が見つかりました。\n` +
          `${existing.torihikisaki?.name} / ${existing.yagou?.name} / ${existing.tenpo?.name}\n\n` +
          '既存問診票を開きますか？'
        );
        if (go) nav(`/admin/tenpo/${encodeURIComponent(existing.tenpo.tenpo_id)}?mode=monshin`);
        return;
      }

      const idempotencyKey = buildOnboardingIdempotencyKey(tName, yName, tenpoName);
      const result = await apiJson('/master/tenpo', {
        method: 'POST',
        body: {
          mode: 'onboarding',
          touroku_date: todayYmd(),
          torihikisaki_name: tName,
          yagou_name: yName,
          tenpo_name: tenpoName,
          phone: norm(bulkPhone),
          email: norm(bulkEmail),
          tantou_name: norm(bulkTantouName),
          address: norm(bulkAddress),
          url: norm(bulkUrl),
          jouhou_touroku_sha_name: norm(bulkJouhouTourokuShaName),
          // 互換維持: backendは create_karte を使用。UI上は「問診票」を正本名称として扱う。
          create_karte: true,
          idempotency_key: idempotencyKey,
        },
      });
      const torihikisakiId = result?.torihikisaki_id || '';
      const yagouId = result?.yagou_id || '';
      const tenpoId = result?.tenpo_id || '';
      const karteId = result?.karte_id || '';

      setOkMsg(`作成しました: ${tName} / ${yName} / ${tenpoName}`);
      setBulkTorihikisakiName('');
      setBulkYagouName('');
      setBulkTenpoName('');
      setBulkPhone('');
      setBulkEmail('');
      setBulkTantouName('');
      setBulkAddress('');
      setBulkUrl('');
      setBulkJouhouTourokuShaName(getCurrentAccountName());
      setBulkOpenKarteAfterCreate(true);

      // 既存一覧を更新し、選択を新規に寄せる
      await reloadTorihikisaki();
      await reloadExistingIndex();
      await reloadContractTenpoCandidates();
      if (torihikisakiId) setSelectedTorihikisakiId(torihikisakiId);
      if (yagouId) setSelectedYagouId(yagouId);
      if (tenpoId) setContractTenpoId(tenpoId);
      if (tenpoId) {
        if (karteId) {
          setOkMsg(`作成しました: ${tName} / ${yName} / ${tenpoName}（問診票ID: ${karteId}）`);
        }
        if (bulkOpenKarteAfterCreate) {
          nav(`/admin/tenpo/${encodeURIComponent(tenpoId)}?mode=monshin`);
        }
      }
    } catch (e) {
      setErr(e?.message || '作成に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [
    bulkTorihikisakiName,
    bulkYagouName,
    bulkTenpoName,
    bulkPhone,
    bulkEmail,
    bulkTantouName,
    bulkAddress,
    bulkUrl,
    bulkJouhouTourokuShaName,
    bulkOpenKarteAfterCreate,
    findExistingTenpoByNames,
    reloadTorihikisaki,
    reloadExistingIndex,
    reloadContractTenpoCandidates,
    nav,
  ]);

  const onAddYagou = useCallback(async () => {
    const torihikisakiId = selectedTorihikisakiId;
    const name = norm(addYagouName);
    if (!name) {
      window.alert('屋号名は必須です');
      return;
    }
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const y = await apiJson('/master/yagou', {
        method: 'POST',
        body: {
          name,
          ...(torihikisakiId ? { torihikisaki_id: torihikisakiId } : {}),
          touroku_date: todayYmd(),
          jotai: 'yuko',
        },
      });
      const yagouId = y?.yagou_id || y?.id;
      setAddYagouName('');
      await reloadYagou(torihikisakiId);
      await reloadExistingIndex();
      if (yagouId) setSelectedYagouId(yagouId);
      setOkMsg(`屋号を追加しました: ${name}`);
    } catch (e) {
      setErr(e?.message || '屋号の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [selectedTorihikisakiId, addYagouName, reloadYagou, reloadExistingIndex]);

  const onAddTenpo = useCallback(async () => {
    const torihikisakiId = selectedTorihikisakiId;
    const yagouId = selectedYagouId;
    const name = norm(addTenpoName);
    const phone = norm(addPhone);
    const email = norm(addEmail);
    const tantouName = norm(addTantouName);
    const address = norm(addAddress);
    const url = norm(addUrl);
    const jouhouTourokuShaName = norm(addJouhouTourokuShaName);
    if (!name) {
      window.alert('店舗名は必須です');
      return;
    }
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      if (torihikisakiId || yagouId) {
        const dupQs = new URLSearchParams({
          limit: '20000',
          jotai: 'yuko',
        });
        if (torihikisakiId) dupQs.set('torihikisaki_id', torihikisakiId);
        if (yagouId) dupQs.set('yagou_id', yagouId);
        const dupData = await apiJson(`/master/tenpo?${dupQs.toString()}`);
        const dupItems = getItems(dupData);
        const hit = dupItems.find((it) => normalizeKeyPart(it?.name) === normalizeKeyPart(name));
        if (hit?.tenpo_id) {
          const go = window.confirm(
            `同名の既存店舗が見つかりました: ${hit.name}\n既存問診票を開きますか？`
          );
          if (go) nav(`/admin/tenpo/${encodeURIComponent(hit.tenpo_id)}?mode=monshin`);
          return;
        }
      }

      const tenpo = await apiJson('/master/tenpo', {
        method: 'POST',
        body: {
          name,
          ...(torihikisakiId ? { torihikisaki_id: torihikisakiId } : {}),
          ...(yagouId ? { yagou_id: yagouId } : {}),
          touroku_date: todayYmd(),
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          ...(tantouName ? { tantou_name: tantouName } : {}),
          ...(address ? { address } : {}),
          ...(url ? { url } : {}),
          ...(jouhouTourokuShaName ? { jouhou_touroku_sha_name: jouhouTourokuShaName } : {}),
          jotai: 'yuko',
        },
      });
      const tenpoId = tenpo?.tenpo_id || tenpo?.id;
      await createSoukoIfMissing(tenpoId, name);
      await reloadExistingIndex();
      setAddTenpoName('');
      setAddPhone('');
      setAddEmail('');
      setAddTantouName('');
      setAddAddress('');
      setAddUrl('');
      setAddJouhouTourokuShaName(getCurrentAccountName());
      setOkMsg(`店舗を追加しました: ${name}`);
      if (tenpoId) nav(`/admin/tenpo/${encodeURIComponent(tenpoId)}?mode=monshin`);
    } catch (e) {
      setErr(e?.message || '店舗の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [
    selectedTorihikisakiId,
    selectedYagouId,
    addTenpoName,
    addPhone,
    addEmail,
    addTantouName,
    addAddress,
    addUrl,
    addJouhouTourokuShaName,
    createSoukoIfMissing,
    nav,
    reloadExistingIndex,
  ]);

  return (
    <div className="admin-touroku-page">
      <div className="admin-touroku-content">
        <header className="admin-touroku-header">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <div className="admin-touroku-headline">
            <h1>{isMasterMode ? '顧客マスタ' : '顧客登録（新）'}</h1>
            <div className="sub">
              {isMasterMode
                ? '取引先 / 屋号 / 店舗 を一括管理・修正'
                : 'torihikisaki → yagou → tenpo → souko（自動作成）'}
            </div>
          </div>
          <div className="admin-touroku-actions">
            <button onClick={reloadTorihikisaki} disabled={loading}>更新</button>
            <Link className="ghost" to="/admin/torihikisaki-meibo">名簿へ</Link>
          </div>
        </header>

        {err ? <div className="admin-touroku-err">{err}</div> : null}
        {okMsg ? <div className="admin-touroku-ok">{okMsg}</div> : null}

        <div className="admin-touroku-mobile-tabs" role="tablist" aria-label="顧客登録モード切替">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'new'}
            className={mobileTab === 'new' ? 'active' : ''}
            onClick={() => setMobileTab('new')}
          >
            新規追加
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'existing'}
            className={mobileTab === 'existing' ? 'active' : ''}
            onClick={() => setMobileTab('existing')}
          >
            既存に追加
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'contract'}
            className={mobileTab === 'contract' ? 'active' : ''}
            onClick={() => setMobileTab('contract')}
          >
            契約書作成
          </button>
        </div>

        <div className="admin-touroku-grid">
          <section className={`card mobile-tab-panel ${mobileTab === 'new' ? 'is-active' : ''}`}>
            <div className="card-h">
              <div className="t">問診票を作成</div>
              <div className="d">取引先・屋号・店舗を一発で作ります</div>
            </div>
            <div className="form">
              <label>
                <span>取引先名</span>
                <input value={bulkTorihikisakiName} onChange={(e) => setBulkTorihikisakiName(e.target.value)} placeholder="例: 株式会社○○" />
              </label>
                <label>
                  <span>屋号名</span>
                <input value={bulkYagouName} onChange={(e) => setBulkYagouName(e.target.value)} placeholder="未入力なら取引先名を継承" />
                </label>
                <label>
                  <span>店舗名</span>
                <input value={bulkTenpoName} onChange={(e) => setBulkTenpoName(e.target.value)} placeholder="未入力なら屋号名を継承" />
                </label>
              <label>
                <span>電話番号</span>
                <input value={bulkPhone} onChange={(e) => setBulkPhone(e.target.value)} placeholder="例: 03-xxxx-xxxx" />
              </label>
              <label>
                <span>メールアドレス</span>
                <input value={bulkEmail} onChange={(e) => setBulkEmail(e.target.value)} placeholder="例: info@example.com" />
              </label>
              <label>
                <span>担当者</span>
                <input value={bulkTantouName} onChange={(e) => setBulkTantouName(e.target.value)} placeholder="例: 山田太郎" />
              </label>
              <label>
                <span>住所</span>
                <input value={bulkAddress} onChange={(e) => setBulkAddress(e.target.value)} placeholder="例: 東京都..." />
              </label>
              <label>
                <span>URL</span>
                <input value={bulkUrl} onChange={(e) => setBulkUrl(e.target.value)} placeholder="https://..." />
              </label>
              <label>
                <span>情報登録者名</span>
                <input value={bulkJouhouTourokuShaName} onChange={(e) => setBulkJouhouTourokuShaName(e.target.value)} placeholder="例: 管理オペ担当" />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={bulkOpenKarteAfterCreate}
                  onChange={(e) => setBulkOpenKarteAfterCreate(e.target.checked)}
                />
                <span>登録後に問診票を入力する</span>
              </label>
              <div className="row">
                <button className="primary" onClick={onBulkCreate} disabled={loading}>問診票を作成</button>
              </div>
            </div>
          </section>

          <section className={`card mobile-tab-panel ${mobileTab === 'existing' ? 'is-active' : ''}`}>
            <div className="card-h">
              <div className="t">既存に追加</div>
              <div className="d">既存の取引先に屋号・店舗を追加します</div>
            </div>

            <div className="form">
              <label>
                <span>統合検索（既存情報）</span>
                <input
                  value={existingQuery}
                  onChange={(e) => setExistingQuery(e.target.value)}
                  placeholder="取引先 / 屋号 / 店舗 / ID で検索"
                />
              </label>
              {existingIndexLoading ? (
                <div className="hint">既存データを読み込み中...</div>
              ) : null}
              {existingCandidates.length > 0 ? (
                <div className="existing-search-list">
                  {existingCandidates.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      className="existing-search-item"
                      onClick={() => onPickExistingCandidate(it)}
                    >
                      <div className="line1">
                        {it.torihikisaki_name || '取引先未設定'}
                        {it.yagou_name ? ` / ${it.yagou_name}` : ''}
                        {it.tenpo_name ? ` / ${it.tenpo_name}` : ''}
                      </div>
                      <div className="line2">
                        {it.torihikisaki_id || '-'}
                        {it.yagou_id ? ` ・ ${it.yagou_id}` : ''}
                        {it.tenpo_id ? ` ・ ${it.tenpo_id}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              ) : normalizeKeyPart(existingQuery) ? (
                <div className="hint">一致する候補がありません</div>
              ) : null}

              <label>
                <span>取引先</span>
                <select value={selectedTorihikisakiId} onChange={(e) => setSelectedTorihikisakiId(e.target.value)}>
                  <option value="">未選択</option>
                  {torihikisakiList.map((t) => (
                    <option key={t.torihikisaki_id} value={t.torihikisaki_id}>
                      {t.name} ({t.torihikisaki_id})
                    </option>
                  ))}
                </select>
              </label>

              <div className="hint">
                選択中: <code>{selectedTorihikisaki?.name || '---'}</code>
              </div>

              <label>
                <span>屋号（既存）</span>
                <select value={selectedYagouId} onChange={(e) => setSelectedYagouId(e.target.value)}>
                  <option value="">未選択</option>
                  {yagouList.map((y) => (
                    <option key={y.yagou_id} value={y.yagou_id}>
                      {y.name} ({y.yagou_id})
                    </option>
                  ))}
                </select>
              </label>

              <div className="split">
                <label>
                  <span>屋号（新規追加）</span>
                  <input value={addYagouName} onChange={(e) => setAddYagouName(e.target.value)} placeholder="例: ○○ダイニング" />
                </label>
                <div className="row">
                  <button onClick={onAddYagou} disabled={loading}>屋号を追加</button>
                </div>
              </div>

              <div className="split">
                <label>
                  <span>店舗（新規追加）</span>
                  <input value={addTenpoName} onChange={(e) => setAddTenpoName(e.target.value)} placeholder="例: 池袋店" />
                </label>
                <div className="row">
                  <button className="primary" onClick={onAddTenpo} disabled={loading}>店舗を追加</button>
                </div>
              </div>

              <label>
                <span>電話番号（基本情報）</span>
                <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="例: 03-xxxx-xxxx" />
              </label>
              <label>
                <span>メールアドレス（基本情報）</span>
                <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="例: info@example.com" />
              </label>
              <label>
                <span>担当者（基本情報）</span>
                <input value={addTantouName} onChange={(e) => setAddTantouName(e.target.value)} placeholder="例: 山田太郎" />
              </label>
              <label>
                <span>住所（基本情報）</span>
                <input value={addAddress} onChange={(e) => setAddAddress(e.target.value)} placeholder="例: 東京都..." />
              </label>
              <label>
                <span>URL（基本情報）</span>
                <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="https://..." />
              </label>
              <label>
                <span>情報登録者名</span>
                <input value={addJouhouTourokuShaName} onChange={(e) => setAddJouhouTourokuShaName(e.target.value)} placeholder="例: 管理オペ担当" />
              </label>

              <div className="hint">
                店舗作成後は <code>souko</code>（顧客ストレージ）を自動作成し、問診票（店舗詳細）へ遷移します。
              </div>
            </div>
          </section>

          <section className={`card card-contract mobile-tab-panel ${mobileTab === 'contract' ? 'is-active' : ''}`}>
            <div className="card-h">
              <div className="t">契約書作成（利用者登録 申込書）</div>
              <div className="d">登録入力から差し込みして、そのまま契約書PDFを出力できます</div>
            </div>
            <div className="form">
              <div className="row contract-actions contract-actions-top">
                <button type="button" onClick={loadContractFromNew} disabled={loading}>新規</button>
                <button type="button" onClick={loadContractFromExisting} disabled={loading}>既存</button>
              </div>

              <div className="contract-grid">
                <label>
                  <span>申込日</span>
                  <input
                    value={contract.application_date}
                    onChange={(e) => updateContractField('application_date', e.target.value)}
                    type="date"
                  />
                </label>
                <label>
                  <span>利用開始日</span>
                  <input
                    value={contract.service_start_date}
                    onChange={(e) => updateContractField('service_start_date', e.target.value)}
                    type="date"
                  />
                </label>
                <label>
                  <span>個人／法人名</span>
                  <input value={contract.company_name} onChange={(e) => updateContractField('company_name', e.target.value)} />
                </label>
                <label>
                  <span>担当者</span>
                  <input value={contract.contact_person} onChange={(e) => updateContractField('contact_person', e.target.value)} />
                </label>
                <label className="contract-span-2">
                  <span>住所／本店住所</span>
                  <input value={contract.company_address} onChange={(e) => updateContractField('company_address', e.target.value)} />
                </label>
                <label>
                  <span>電話番号</span>
                  <input value={contract.phone} onChange={(e) => updateContractField('phone', e.target.value)} />
                </label>
                <label>
                  <span>メールアドレス</span>
                  <input value={contract.email} onChange={(e) => updateContractField('email', e.target.value)} />
                </label>
                <label>
                  <span>店舗名</span>
                  <input value={contract.store_name} onChange={(e) => updateContractField('store_name', e.target.value)} />
                </label>
                <label>
                  <span>店舗住所</span>
                  <input value={contract.store_address} onChange={(e) => updateContractField('store_address', e.target.value)} />
                </label>
              </div>

              <label>
                <span>料金</span>
                <textarea value={contract.pricing} onChange={(e) => updateContractField('pricing', e.target.value)} rows={2} />
              </label>
              <label>
                <span>個別業務のキャンセル</span>
                <textarea value={contract.cancel_rule} onChange={(e) => updateContractField('cancel_rule', e.target.value)} rows={2} />
              </label>
              <label>
                <span>支払方法</span>
                <textarea value={contract.payment_method} onChange={(e) => updateContractField('payment_method', e.target.value)} rows={3} />
              </label>
              <label>
                <span>有効期間</span>
                <textarea value={contract.valid_term} onChange={(e) => updateContractField('valid_term', e.target.value)} rows={3} />
              </label>
              <label>
                <span>退会予告期間</span>
                <input value={contract.withdrawal_notice} onChange={(e) => updateContractField('withdrawal_notice', e.target.value)} />
              </label>
              <label>
                <span>特約事項</span>
                <textarea value={contract.special_notes} onChange={(e) => updateContractField('special_notes', e.target.value)} rows={4} />
              </label>
              <label>
                <span>サービス提供者</span>
                <input value={contract.provider_name} onChange={(e) => updateContractField('provider_name', e.target.value)} />
              </label>
              <label>
                <span>サービス提供者住所</span>
                <input value={contract.provider_address} onChange={(e) => updateContractField('provider_address', e.target.value)} />
              </label>
              <label>
                <span>サービス提供者電話</span>
                <input value={contract.provider_phone} onChange={(e) => updateContractField('provider_phone', e.target.value)} />
              </label>

              <label>
                <span>契約書プレビュー</span>
                <textarea value={contractText} readOnly rows={18} className="contract-preview" />
              </label>

              <div className="row contract-actions contract-actions-bottom">
                <button type="button" onClick={outputContractPdf} disabled={contractPdfBusy}>
                  {contractPdfBusy ? 'PDF出力中...' : '出力'}
                </button>
                <button type="button" onClick={saveContractPdfLocal} disabled={contractPdfBusy}>
                  {contractPdfBusy ? '保存中...' : '保存'}
                </button>
                <button type="button" className="primary" onClick={saveContractPdfToSouko} disabled={contractSoukoBusy || !contractTenpoId}>
                  {contractSoukoBusy ? '管理保存中...' : '管理'}
                </button>
              </div>

              <label>
                <span>管理（souko保存先店舗）</span>
                <select value={contractTenpoId} onChange={(e) => setContractTenpoId(e.target.value)}>
                  <option value="">未選択</option>
                  {contractTenpoCandidates.map((tp) => (
                    <option key={tp.tenpo_id} value={tp.tenpo_id}>
                      {[norm(tp?.yagou_name), norm(tp?.name)].filter(Boolean).join(' / ') || tp.tenpo_id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="hint">
                「管理」でPDFをsouko保存すると、提出物（doc_category: contract）として店舗ストレージに保存されます。
              </div>

              <div className="contract-print-host" aria-hidden>
                <div className="contract-print-sheet" ref={contractPrintRef}>
                  <h1>利用者登録 申込書（契約書）</h1>
                  <p>ミセサポ 利用規約に同意し、以下の通り、本サービスの利用を申し込みます。</p>

                  <section>
                    <h2>申込日及び利用開始日</h2>
                    <p>申込日: {norm(contract.application_date)} ／ 利用開始日: {norm(contract.service_start_date)}</p>
                  </section>

                  <section>
                    <h2>申込者情報</h2>
                    <p>個人／法人名: {norm(contract.company_name)} {norm(contract.company_stamp)}</p>
                    <p>住所／本店住所: {norm(contract.company_address)}</p>
                    <p>担当者: {norm(contract.contact_person)}</p>
                    <p>電話番号: {norm(contract.phone)}</p>
                    <p>メールアドレス: {norm(contract.email)}</p>
                  </section>

                  <section>
                    <h2>サービスを利用したい店舗の名称及び住所</h2>
                    <p>店舗名: {norm(contract.store_name)}</p>
                    <p>店舗住所: {norm(contract.store_address)}</p>
                  </section>

                  <section>
                    <h2>契約条件</h2>
                    <p>料金: {norm(contract.pricing)}</p>
                    <p>個別業務のキャンセル: {norm(contract.cancel_rule)}</p>
                    <p>支払方法: {norm(contract.payment_method)}</p>
                    <p>有効期間: {norm(contract.valid_term)}</p>
                    <p>退会予告期間: {norm(contract.withdrawal_notice)}</p>
                    <p>特約事項: {norm(contract.special_notes)}</p>
                  </section>

                  <section>
                    <h2>サービス提供者</h2>
                    <p>{norm(contract.provider_name)}</p>
                    <p>住所: {norm(contract.provider_address)}</p>
                    <p>電話: {norm(contract.provider_phone)}</p>
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
