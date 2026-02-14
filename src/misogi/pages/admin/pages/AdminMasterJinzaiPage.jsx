import React, { useCallback, useMemo, useState } from 'react';
import AdminMasterBase from './AdminMasterBase';

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

function normalizePartnerType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'kigyou' || s === 'company') return 'kigyou';
  if (s === 'kojin' || s === 'personal') return 'kojin';
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
              <option value="kojin">kojin（個人）</option>
              <option value="kigyou">kigyou（法人/企業）</option>
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
      onAfterSave={handleAfterSave}
      renderModalExtra={({ editing, setEditing }) => (
        <PartnerChangePanel editing={editing} setEditing={setEditing} />
      )}
      fields={[
        { key: 'name', label: '氏名' },
        { key: 'han_type', label: '所属区分 (han_type)' },
        { key: 'partner_type', label: '契約主体種別 (partner_type)' },
        { key: 'partner_id', label: '契約主体ID (partner_id)' },
        { key: 'koyou_kubun', label: '契約形態' },
        { key: 'shokushu', label: '職種(JSON配列可)' },
        { key: 'busho_ids', label: '部署ID(JSON配列可)' },
        { key: 'email', label: 'メール' },
        { key: 'phone', label: '電話' },
        { key: 'kigyou_id', label: 'kigyou_id(旧/互換)' },
      ]}
    />
  );
}
