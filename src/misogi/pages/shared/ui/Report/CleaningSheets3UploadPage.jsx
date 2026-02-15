import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import TemplateRenderer, { getNestedValue, setNestedValue, validateTemplatePayload } from '../../../../shared/components/TemplateRenderer';
import { getTemplateById } from '../../../../templates';
import { apiFetchWorkReport } from '../../api/client';
import { useAuth } from '../../auth/useAuth';

const TEMPLATE_ID = 'CLEANING_SHEETS_3_V1';

function todayYmd() {
  try {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

function coerceArray(v) {
  return Array.isArray(v) ? v : [];
}

export default function CleaningSheets3UploadPage() {
  const { user, isLoading: authLoading, isAuthenticated, login, getToken } = useAuth();
  const template = useMemo(() => getTemplateById(TEMPLATE_ID), []);
  const [payload, setPayload] = useState(() => ({
    work_date: todayYmd(),
    user_name: user?.name || '',
    sheets: { sheet1: [], sheet2: [], sheet3: [] },
  }));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // {type,text}

  // Keep user_name updated when auth finishes.
  React.useEffect(() => {
    if (!user?.name) return;
    setPayload((p) => (p.user_name ? p : { ...p, user_name: user.name }));
  }, [user?.name]);

  const sheetCounts = useMemo(() => {
    const s1 = coerceArray(getNestedValue(payload, 'sheets.sheet1')).length;
    const s2 = coerceArray(getNestedValue(payload, 'sheets.sheet2')).length;
    const s3 = coerceArray(getNestedValue(payload, 'sheets.sheet3')).length;
    const filled = (s1 > 0 ? 1 : 0) + (s2 > 0 ? 1 : 0) + (s3 > 0 ? 1 : 0);
    return { s1, s2, s3, filled };
  }, [payload]);

  const canSubmit = sheetCounts.filled === 3 && !saving;

  const authHeaders = useCallback(() => {
    const token = getToken() || localStorage.getItem('cognito_id_token');
    return token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
  }, [getToken]);

  const uploadOne = useCallback(async (file) => {
    const headers = authHeaders();
    const res = await apiFetchWorkReport('/houkoku/upload-url', {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename: file.name, mime: file.type }),
    });
    await fetch(res.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    return { url: res.url, key: res.key, name: file.name };
  }, [authHeaders]);

  const onFileUpload = useCallback(async (keyPath, file) => {
    setSaving(true);
    setStatus(null);
    try {
      const att = await uploadOne(file);
      // Force 1-per-slot: overwrite with a single-item array.
      setPayload((prev) => setNestedValue(prev, keyPath, [att]));
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: `アップロード失敗: ${e?.message || e}` });
    } finally {
      setSaving(false);
    }
  }, [uploadOne]);

  const onFileRemove = useCallback((keyPath) => {
    setPayload((prev) => setNestedValue(prev, keyPath, []));
  }, []);

  const onMetaChange = useCallback((key, value) => {
    setPayload((prev) => ({ ...prev, [key]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!template) return;
    setSaving(true);
    setStatus(null);
    try {
      // Validation: must have 3 photos total AND 1 in each slot.
      const errs = validateTemplatePayload(template, payload);
      const perSlotOk = sheetCounts.filled === 3;
      if (errs.length || !perSlotOk) {
        throw new Error('報告書1〜3の画像をアップロードしてください（3/3）。');
      }

      const workDate = String(payload.work_date || todayYmd());
      const userName = String(payload.user_name || user?.name || '').trim() || '不明';
      const headers = authHeaders();
      await apiFetchWorkReport('/houkoku', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          template_id: TEMPLATE_ID,
          work_date: workDate,
          user_name: userName,
          state: 'submitted',
          payload,
        }),
      });

      setStatus({ type: 'success', text: '提出しました' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: e?.message || '提出に失敗しました' });
    } finally {
      setSaving(false);
    }
  }, [authHeaders, payload, sheetCounts.filled, template, user?.name]);

  if (authLoading) return <Wrap>読み込み中...</Wrap>;
  if (!isAuthenticated) {
    return (
      <Wrap>
        <Card>
          <h1>清掃 報告（画像アップロード）</h1>
          <p>ログインが必要です。</p>
          <button type="button" onClick={login}>Portalへ</button>
        </Card>
      </Wrap>
    );
  }

  return (
    <Wrap data-job="cleaning">
      {status ? (
        <Toast $type={status.type}>
          {status.text}
        </Toast>
      ) : null}

      <TemplateRenderer
        template={template}
        payload={payload}
        report={{ user_name: user?.name || payload.user_name || '', work_date: payload.work_date || todayYmd() }}
        onChange={onMetaChange}
        onFileUpload={onFileUpload}
        onFileRemove={onFileRemove}
        mode="edit"
        footer={(
          <FooterBar>
            <Progress>
              <span className="k">進捗</span>
              <span className="v">{sheetCounts.filled}/3</span>
            </Progress>
            <SubmitBtn type="button" disabled={!canSubmit} onClick={submit}>
              {saving ? '処理中...' : '提出'}
            </SubmitBtn>
          </FooterBar>
        )}
      />
    </Wrap>
  );
}

const Wrap = styled.div`
  min-height: 100vh;
  padding: 18px 12px 80px;
  background: radial-gradient(1200px 800px at 10% -10%, #1b2450 0%, #0b0d12 58%);
  color: #e9eefc;
`;

const Card = styled.div`
  max-width: 520px;
  margin: 60px auto 0;
  padding: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.75);
  h1 { margin: 0 0 10px; font-size: 18px; }
  p { margin: 0 0 12px; color: rgba(233,238,252,0.8); }
  button {
    height: 40px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(37, 99, 235, 0.9);
    color: white;
    font-weight: 800;
    padding: 0 14px;
    cursor: pointer;
  }
`;

const FooterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const Progress = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  .k { font-size: 12px; opacity: 0.8; }
  .v { font-size: 16px; font-weight: 900; }
`;

const SubmitBtn = styled.button`
  height: 44px;
  min-width: 120px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(16, 185, 129, 0.95);
  color: #081a12;
  font-weight: 900;
  cursor: pointer;
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(148, 163, 184, 0.28);
    color: rgba(233,238,252,0.8);
  }
`;

const Toast = styled.div`
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20000;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: ${(p) => (p.$type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)')};
  color: #e9eefc;
  box-shadow: 0 12px 24px rgba(0,0,0,0.35);
  font-weight: 800;
`;

