import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import TemplateRenderer, { getNestedValue, setNestedValue, validateTemplatePayload } from '../../../../shared/components/TemplateRenderer';
import { getTemplateById } from '../../../../templates';
import { apiFetchWorkReport } from '../../api/client';
import { useAuth } from '../../auth/useAuth';

const TEMPLATE_ID = 'CLEANING_SHEETS_3_V1';
const SUPPLEMENT_FOLDERS_KEY = 'supplement.folders';
const SUPPLEMENT_GROUP_PREFIX = 'supplement.groups.';
const MAX_SUPPLEMENT_PHOTOS_PER_FOLDER = 30;

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

function toSafeFolderLabel(v) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.slice(0, 20);
}

function newFolderId() {
  // Stable enough for client-side grouping; not used as a DB primary key.
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error('ファイル変換に失敗しました'));
    reader.readAsDataURL(file);
  });
}

export default function CleaningSheets3UploadPage() {
  const { user, isLoading: authLoading, isAuthenticated, login, getToken } = useAuth();
  const template = useMemo(() => getTemplateById(TEMPLATE_ID), []);
  const [payload, setPayload] = useState(() => ({
    work_date: todayYmd(),
    user_name: user?.name || '',
    sheets: { sheet1: [], sheet2: [], sheet3: [] },
    supplement: {
      folders: [
        { id: 'misc', label: '未分類', key: 'supplement.groups.misc' },
      ],
      groups: { misc: [] },
    },
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

  const supplementFolders = useMemo(() => {
    const folders = coerceArray(getNestedValue(payload, SUPPLEMENT_FOLDERS_KEY));
    // Normalize shape to {id,label,key}. If broken, fallback to a single folder.
    const normalized = folders
      .map((f) => {
        const id = String(f?.id || '').trim();
        const label = toSafeFolderLabel(f?.label);
        const key = String(f?.key || '').trim();
        if (!id || !key) return null;
        return { id, label: label || '（無題）', key };
      })
      .filter(Boolean);
    return normalized.length ? normalized : [{ id: 'misc', label: '未分類', key: 'supplement.groups.misc' }];
  }, [payload]);

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
    const fileBase64 = await fileToBase64(file);
    await apiFetchWorkReport('/upload-put', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uploadUrl: res.uploadUrl,
        contentType: file.type || 'application/octet-stream',
        fileBase64,
      }),
    });
    return {
      url: res.url,
      key: res.key,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };
  }, [authHeaders]);

  const ensureSupplementGroup = useCallback((prev, folderId) => {
    const cur = prev?.supplement?.groups || {};
    if (cur[folderId]) return prev;
    return {
      ...prev,
      supplement: {
        ...(prev.supplement || {}),
        groups: { ...cur, [folderId]: [] },
      },
    };
  }, []);

  const addSupplementFolder = useCallback(() => {
    setPayload((prev) => {
      const id = newFolderId();
      const prevFolders = coerceArray(getNestedValue(prev, SUPPLEMENT_FOLDERS_KEY));
      const nextFolders = [
        ...prevFolders,
        { id, label: `項目${prevFolders.length + 1}`, key: `${SUPPLEMENT_GROUP_PREFIX}${id}` },
      ];
      const next = {
        ...prev,
        supplement: {
          ...(prev.supplement || {}),
          folders: nextFolders,
        },
      };
      return ensureSupplementGroup(next, id);
    });
  }, [ensureSupplementGroup]);

  const renameSupplementFolder = useCallback((folderId, label) => {
    const safe = toSafeFolderLabel(label) || '（無題）';
    setPayload((prev) => {
      const folders = coerceArray(getNestedValue(prev, SUPPLEMENT_FOLDERS_KEY));
      const nextFolders = folders.map((f) => (f?.id === folderId ? { ...f, label: safe } : f));
      return setNestedValue(prev, SUPPLEMENT_FOLDERS_KEY, nextFolders);
    });
  }, []);

  const removeSupplementFolder = useCallback((folderId) => {
    setPayload((prev) => {
      const folders = coerceArray(getNestedValue(prev, SUPPLEMENT_FOLDERS_KEY));
      const nextFolders = folders.filter((f) => f?.id !== folderId);
      const curGroups = prev?.supplement?.groups || {};
      const { [folderId]: _omit, ...rest } = curGroups;
      const next = setNestedValue(prev, SUPPLEMENT_FOLDERS_KEY, nextFolders.length ? nextFolders : [{ id: 'misc', label: '未分類', key: 'supplement.groups.misc' }]);
      return {
        ...next,
        supplement: {
          ...(next.supplement || {}),
          groups: rest.misc ? rest : { ...rest, misc: [] },
        },
      };
    });
  }, []);

  const onFileUpload = useCallback(async (keyPath, file) => {
    setSaving(true);
    setStatus(null);
    try {
      if (String(keyPath).startsWith(SUPPLEMENT_GROUP_PREFIX)) {
        const current = coerceArray(getNestedValue(payload, keyPath));
        if (current.length >= MAX_SUPPLEMENT_PHOTOS_PER_FOLDER) {
          throw new Error(`補助資料はフォルダごとに最大 ${MAX_SUPPLEMENT_PHOTOS_PER_FOLDER} 枚までです`);
        }
      }

      const att = await uploadOne(file);
      setPayload((prev) => {
        // For report sheets: force 1-per-slot by overwriting.
        if (!String(keyPath).startsWith(SUPPLEMENT_GROUP_PREFIX)) {
          return setNestedValue(prev, keyPath, [att]);
        }

        // For supplement groups: append up to limit per folder.
        const current = coerceArray(getNestedValue(prev, keyPath));
        return setNestedValue(prev, keyPath, [...current, att]);
      });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: `アップロード失敗: ${e?.message || e}` });
    } finally {
      setSaving(false);
    }
  }, [payload, uploadOne]);

  const onFileRemove = useCallback((keyPath, index) => {
    setPayload((prev) => {
      const arr = coerceArray(getNestedValue(prev, keyPath));
      if (typeof index !== 'number') return setNestedValue(prev, keyPath, []);
      return setNestedValue(prev, keyPath, arr.filter((_, i) => i !== index));
    });
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
        throw new Error('作業記録証明書 / 作業項目チェックリスト / 作業レポート の画像をアップロードしてください（3/3）。');
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

      <FoldersCard aria-label="補助資料フォルダ">
        <FoldersHead>
          <div className="t">補助資料フォルダ</div>
          <button type="button" className="add" onClick={addSupplementFolder}>
            ＋ フォルダ追加
          </button>
        </FoldersHead>
        <FoldersList>
          {supplementFolders.map((f) => (
            <FolderRow key={f.id}>
              <input
                type="text"
                value={f.label}
                onChange={(e) => renameSupplementFolder(f.id, e.target.value)}
                aria-label={`フォルダ名 ${f.label}`}
                maxLength={20}
              />
              <button
                type="button"
                className="del"
                onClick={() => removeSupplementFolder(f.id)}
                disabled={supplementFolders.length <= 1}
                title="フォルダ削除"
              >
                削除
              </button>
            </FolderRow>
          ))}
        </FoldersList>
        <FoldersHint>例: トイレ / 厨房 / 床 / ガラス / エアコン</FoldersHint>
      </FoldersCard>

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

const FoldersCard = styled.section`
  max-width: 800px;
  margin: 12px auto 12px;
  padding: 14px 14px 12px;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.55);
`;

const FoldersHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  .t {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.02em;
    color: rgba(233,238,252,0.92);
  }
  .add {
    height: 34px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(59, 130, 246, 0.95);
    color: #fff;
    font-weight: 900;
    cursor: pointer;
  }
`;

const FoldersList = styled.div`
  display: grid;
  gap: 8px;
`;

const FolderRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px;
  gap: 8px;
  input {
    height: 40px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.04);
    color: rgba(233,238,252,0.95);
    padding: 0 12px;
    font-weight: 700;
    outline: none;
  }
  .del {
    height: 40px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(239, 68, 68, 0.18);
    color: rgba(255,255,255,0.95);
    font-weight: 900;
    cursor: pointer;
  }
  .del:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FoldersHint = styled.p`
  margin: 10px 0 0;
  font-size: 12px;
  color: rgba(233,238,252,0.72);
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
