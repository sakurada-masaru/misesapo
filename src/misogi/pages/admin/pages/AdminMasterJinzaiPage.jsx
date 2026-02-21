import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminMasterBase from './AdminMasterBase';
import { formatMasterDateTime } from './masterDateTime';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const JINZAI_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-jinzai'
    : (import.meta.env?.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

function currentUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('cognito_user') || 'null');
  } catch {
    return null;
  }
}

function authHeaders() {
  try {
    const legacy = JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.token || '';
    const token =
      localStorage.getItem('idToken') ||
      localStorage.getItem('cognito_id_token') ||
      localStorage.getItem('id_token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('cognito_access_token') ||
      localStorage.getItem('token') ||
      legacy ||
      '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function normalizeHanType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'internal' || s === '自社') return 'internal';
  if (s === 'gaibu' || s === '外部') return 'gaibu';
  // backward compatibility: legacy values are treated as external.
  if (s === 'kigyou' || s === 'company' || s === '企業') return 'gaibu';
  if (s === 'kojin' || s === 'personal' || s === '個人') return 'gaibu';
  return '';
}

function normalizePartnerType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === '個人') return 'kojin';
  if (s === '企業') return 'kigyou';
  if (s === 'kigyou' || s === 'company') return 'kigyou';
  if (s === 'kojin' || s === 'personal') return 'kojin';
  return '';
}

const HAN_TYPE_OPTIONS = [
  { value: 'internal', label: '自社' },
  { value: 'gaibu', label: '外部' },
];

const PARTNER_TYPE_OPTIONS = [
  { value: 'kojin', label: '個人' },
  { value: 'kigyou', label: '企業' },
];

const HAN_TYPE_LABEL = Object.fromEntries(HAN_TYPE_OPTIONS.map((x) => [x.value, x.label]));
const PARTNER_TYPE_LABEL = Object.fromEntries(PARTNER_TYPE_OPTIONS.map((x) => [x.value, x.label]));

function isHakenKoyou(v) {
  const s = normalizeKoyouKubun(v);
  return s === 'haken_shain';
}

const KOYOU_KUBUN_OPTIONS = [
  { value: 'yakuin', label: '役員' },
  { value: 'seishain', label: '正社員' },
  { value: 'keiyaku_shain', label: '契約社員' },
  { value: 'gyomu_itaku', label: '業務委託' },
  { value: 'arbeit_part', label: 'アルバイト/パート' },
  { value: 'haken_shain', label: '派遣社員' },
];
const KOYOU_KUBUN_LABEL = Object.fromEntries(KOYOU_KUBUN_OPTIONS.map((x) => [x.value, x.label]));

const SHOKUSHU_LABEL = {
  keiei: '取締役',
  seisou: '清掃',
  maintenance: 'メンテナンス',
  engineer: 'エンジニア',
  eigyo: '営業',
  sales: '営業',
  jimu: '事務',
  jinji: '人事',
  keiri: '経理',
  design: 'デザイン',
  operator: 'オペレーション',
  dev: '開発',
};

function shokushuLabel(v) {
  const key = String(v || '').trim().toLowerCase();
  return SHOKUSHU_LABEL[key] || String(v || '').trim();
}

function shokushuDisplay(v) {
  const parseArray = (value) => {
    const s = String(value || '').trim();
    if (!s) return [];
    if (s.startsWith('[') && s.endsWith(']')) {
      const normalized = s
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'");
      try {
        const p = JSON.parse(normalized);
        return Array.isArray(p) ? p : [s];
      } catch {
        const single = normalized.match(/^\[\s*"([^"]+)"\s*\]$/);
        if (single) return [single[1]];
        return [s];
      }
    }
    return [s];
  };

  const arr = Array.isArray(v)
    ? v
    : parseArray(v);
  if (!arr.length) return '-';
  const labels = arr.map((x) => shokushuLabel(x)).filter(Boolean);
  return labels.join(', ') || '-';
}

function normalizeKoyouKubun(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  const s = raw.toLowerCase();
  if (raw === '役員' || s === 'yakuin' || s === 'officer' || s === 'executive') return 'yakuin';
  if (s === 'seishain' || raw === '正社員') return 'seishain';
  if (s === 'keiyaku_shain' || s === 'contract_staff' || raw === '契約社員') return 'keiyaku_shain';
  if (s === 'gyomu_itaku' || raw === '業務委託') return 'gyomu_itaku';
  if (s === 'arbeit_part' || s === 'part_time' || raw.includes('アルバイト') || raw.includes('パート') || raw.includes('ﾊﾟｰﾄ')) return 'arbeit_part';
  if (s === 'haken_shain' || s === 'haken' || s === 'dispatch' || raw.includes('派遣')) return 'haken_shain';
  return '';
}

function PartnerChangePanel({ editing, setEditing }) {
  const [open, setOpen] = useState(false);
  const [partnerType, setPartnerType] = useState(() => normalizePartnerType(editing?.partner_type) || '');
  const [partnerId, setPartnerId] = useState(() => String(editing?.partner_id || '').trim());
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState('all_past'); // per user: corporate-align is theory

  const current = useMemo(() => {
    const pt = normalizePartnerType(editing?.partner_type) || '-';
    const pid = String(editing?.partner_id || '').trim() || '-';
    return { pt, pid };
  }, [editing?.partner_type, editing?.partner_id]);

  const apply = useCallback(() => {
    const nextType = normalizePartnerType(partnerType);
    const nextId = String(partnerId || '').trim();
    if (!nextType || !nextId) {
      window.alert('partner_type と partner_id は必須です');
      return;
    }
    const user = currentUserFromStorage();
    const entry = {
      changed_at: nowIso(),
      changed_by: user?.jinzai_id || user?.id || user?.email || '',
      changed_by_email: user?.email || '',
      from_partner_type: normalizePartnerType(editing?.partner_type) || '',
      from_partner_id: String(editing?.partner_id || '').trim(),
      to_partner_type: nextType,
      to_partner_id: nextId,
      scope,
      reason: String(reason || '').trim(),
    };

    setEditing((prev) => {
      const hist = Array.isArray(prev?.partner_history) ? prev.partner_history : [];
      const nextHist = [...hist, entry].slice(-30);
      const patch = {
        ...prev,
        partner_type: nextType,
        partner_id: nextId,
        partner_history: nextHist,
      };
      // Optional: keep legacy `kigyou_id` consistent when it is blank and switching to kigyou.
      if (nextType === 'kigyou' && !String(prev?.kigyou_id || '').trim()) {
        patch.kigyou_id = nextId;
      }
      return patch;
    });
    setOpen(false);
    setReason('');
  }, [editing?.partner_type, editing?.partner_id, partnerType, partnerId, reason, scope, setEditing]);

  return (
    <div style={{ padding: 12, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>契約主体（partner）</div>
          <div style={{ fontWeight: 600 }}>
            {current.pt} / {current.pid}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            個人→法人化のような変更はここで記録します（履歴は `partner_history` に追記）。
          </div>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          契約主体変更
        </button>
      </div>

      {open ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center' }}>
            <div style={{ color: 'var(--muted)' }}>変更後 partner_type</div>
            <select value={partnerType} onChange={(e) => setPartnerType(e.target.value)} style={{ width: '100%' }}>
              <option value="">選択</option>
              <option value="kojin">個人</option>
              <option value="kigyou">企業</option>
            </select>

            <div style={{ color: 'var(--muted)' }}>変更後 partner_id</div>
            <input value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="例: KIGYOU#.... または KOJIN#...." />

            <div style={{ color: 'var(--muted)' }}>適用範囲</div>
            <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ width: '100%' }}>
              <option value="all_past">過去分も含めて寄せる</option>
              <option value="from_now">今日以降のみ</option>
            </select>

            <div style={{ color: 'var(--muted)' }}>理由（任意）</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例: 法人化のため" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>キャンセル</button>
            <button type="button" className="btn primary" onClick={apply}>反映（保存を押すまで確定しません）</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminMasterJinzaiPage() {
  const [bushoMap, setBushoMap] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${JINZAI_API_BASE.replace(/\/$/, '')}/jinzai/busho?limit=2000&jotai=yuko`, {
          headers: authHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data?.items || []);
        const map = {};
        items.forEach((it) => {
          const id = String(it?.busho_id || '').trim();
          const name = String(it?.name || '').trim();
          if (id && name) map[id] = name;
        });
        if (alive) setBushoMap(map);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  const formatBusho = useCallback((value, row) => {
    const namesRaw = String(row?.busho_names || '').trim();
    if (namesRaw) return namesRaw;
    const arr = Array.isArray(value)
      ? value
      : (() => {
        const s = String(value || '').trim();
        if (!s) return [];
        if (s.startsWith('[') && s.endsWith(']')) {
          try {
            const p = JSON.parse(s);
            return Array.isArray(p) ? p : [s];
          } catch {
            return [s];
          }
        }
        return [s];
      })();
    if (!arr.length) return '-';
    const labels = arr.map((id) => bushoMap[String(id).trim()] || String(id).trim()).filter(Boolean);
    return labels.length ? labels.join(', ') : '-';
  }, [bushoMap]);

  const handleAfterSave = useCallback(async ({ isUpdate, id, editing, request }) => {
    if (isUpdate || !id) return;
    const res = await request(`/jinzai/${encodeURIComponent(id)}/kaban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${editing?.name || id} kaban`,
        jotai: 'yuko',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`kaban自動作成失敗 (${res.status}) ${text}`);
    }
  }, []);

  return (
    <AdminMasterBase
      title="人材マスタ (jinzai)"
      apiBase={JINZAI_API_BASE}
      resourceBasePath=""
      resource="jinzai"
      idKey="jinzai_id"
      parentSources={{
        busho: { resource: 'jinzai/busho', query: { limit: 2000, jotai: 'yuko' } },
      }}
      normalizeEditingModel={(model) => {
        const m = { ...(model || {}) };
        const koyou = normalizeKoyouKubun(m.koyou_kubun);
        if (koyou) m.koyou_kubun = koyou;
        return m;
      }}
      onAfterSave={handleAfterSave}
      renderModalExtra={({ editing, setEditing }) => (
        <PartnerChangePanel editing={editing} setEditing={setEditing} />
      )}
      fields={[
        { key: 'name', label: '氏名' },
        {
          key: 'han_type',
          label: '所属区分',
          type: 'select',
          options: HAN_TYPE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'kojin',
          format: (v) => HAN_TYPE_LABEL[normalizeHanType(v)] || '-',
        },
        {
          key: 'partner_type',
          label: '契約主体種別',
          type: 'select',
          options: PARTNER_TYPE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'kojin',
          format: (v, row) => {
            const key = normalizePartnerType(v);
            if (key === 'kigyou' && isHakenKoyou(row?.koyou_kubun)) return '派遣会社';
            return PARTNER_TYPE_LABEL[key] || '-';
          },
        },
        { key: 'partner_id', label: '契約主体ID (partner_id)' },
        {
          key: 'koyou_kubun',
          label: '契約形態',
          type: 'select',
          options: KOYOU_KUBUN_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          format: (v) => {
            const key = normalizeKoyouKubun(v);
            if (!key) return String(v || '-');
            return KOYOU_KUBUN_LABEL[key] || String(v || '-');
          },
        },
        {
          key: 'shokushu',
          label: '職種(JSON配列可)',
          format: (v) => shokushuDisplay(v),
          render: (v, row) => shokushuDisplay(v ?? row?.shokushu),
        },
        {
          key: 'busho_ids',
          label: '部署',
          type: 'multi_select',
          overlay: true,
          sourceKey: 'busho',
          valueKey: 'busho_id',
          labelKey: 'name',
          format: formatBusho,
          render: (v, row) => formatBusho(v, row),
        },
        { key: 'email', label: 'メール' },
        { key: 'phone', label: '電話' },
        { key: 'kigyou_id', label: 'kigyou_id(旧/互換)' },
        { key: 'touroku_at', label: '登録日時', readOnly: true, format: formatMasterDateTime },
      ]}
    />
  );
}
