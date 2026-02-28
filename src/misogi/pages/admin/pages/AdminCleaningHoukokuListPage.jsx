import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { apiFetchWorkReport } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';

const CLEANING_TEMPLATE_ID = 'CLEANING_SHEETS_3_V1';

function norm(v) {
  return String(v || '').trim();
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseJsonMaybe(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function normalizeRecord(it) {
  const payload = parseJsonMaybe(it?.payload || it?.payload_json || it?.description || it?.body || it?.data);
  const context = payload?.context && typeof payload.context === 'object' ? payload.context : {};
  const templateId = norm(it?.template_id || it?.templateId || payload?.template_id || payload?.templateId);
  const reportId = norm(
    it?.report_id || it?.work_report_id || it?.houkoku_id || it?.id || it?.log_id || it?.reportId
  );

  const serviceNames = [
    ...asArray(it?.service_names),
    ...asArray(context?.service_names),
  ].map((v) => norm(v)).filter(Boolean);

  const cleanerNames = [
    ...asArray(it?.cleaner_names),
    ...asArray(it?.worker_names),
    ...asArray(context?.cleaner_names),
  ].map((v) => norm(v)).filter(Boolean);

  const singleCleaner = norm(
    it?.user_name || it?.worker_name || it?.cleaner_name || context?.cleaner_name || payload?.user_name
  );
  if (singleCleaner && !cleanerNames.length) cleanerNames.push(singleCleaner);

  return {
    id: reportId,
    templateId,
    workDate: norm(it?.work_date || payload?.work_date || context?.work_date || ''),
    tenpoLabel: norm(it?.target_label || context?.tenpo_label || payload?.target_label || ''),
    cleanerNames,
    serviceNames,
    status: norm(it?.state || it?.status || 'submitted'),
    createdAt: norm(it?.created_at || it?.submitted_at || it?.updated_at || ''),
  };
}

function isCleaningHoukokuRecord(rec) {
  const tid = norm(rec?.templateId);
  return tid === CLEANING_TEMPLATE_ID;
}

function formatDateTime(s) {
  const v = norm(s);
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminCleaningHoukokuListPage() {
  const { getToken } = useAuth();
  const [fromDate, setFromDate] = useState(() => addDays(todayYmd(), -30));
  const [toDate, setToDate] = useState(() => todayYmd());
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken() || localStorage.getItem('cognito_id_token');
      const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
      const states = encodeURIComponent('draft,submitted,triaged,rejected,approved,archived');
      const url = `/admin/work-reports?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&states=${states}&limit=2000`;
      const res = await apiFetchWorkReport(url, { method: 'GET', headers });
      const normalized = asItems(res)
        .map(normalizeRecord)
        .filter(isCleaningHoukokuRecord)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setItems(normalized);
    } catch (e) {
      console.error('[AdminCleaningHoukokuList] fetch failed', e);
      setError(e?.message || '一覧の取得に失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, getToken, toDate]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filtered = useMemo(() => {
    const q = norm(query).toLowerCase();
    if (!q) return items;
    return (items || []).filter((it) => {
      const blob = [
        it?.id,
        it?.workDate,
        it?.tenpoLabel,
        ...(it?.cleanerNames || []),
        ...(it?.serviceNames || []),
        it?.status,
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [items, query]);

  return (
    <Wrap data-job="admin-cleaning-houkoku-list">
      <Header>
        <div>
          <h1>レポート一覧</h1>
          <p>清掃レポート作成ツールから提出された報告を一覧表示します。</p>
        </div>
        <HeaderActions>
          <Link className="sub" to="/admin/tools/cleaning-houkoku">レポート作成へ</Link>
          <button type="button" onClick={fetchList} disabled={loading}>{loading ? '更新中...' : '更新'}</button>
        </HeaderActions>
      </Header>

      <FilterCard>
        <label>
          <span>開始日</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(norm(e.target.value))} />
        </label>
        <label>
          <span>終了日</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(norm(e.target.value))} />
        </label>
        <label className="search">
          <span>検索</span>
          <input
            type="text"
            placeholder="店舗名 / 清掃員 / サービス / report_id"
            value={query}
            onChange={(e) => setQuery(String(e.target.value || ''))}
          />
        </label>
      </FilterCard>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <TableCard>
        <TableHead>
          <strong>件数: {filtered.length}</strong>
          <span>{fromDate} 〜 {toDate}</span>
        </TableHead>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>作業日</th>
                <th>店舗情報</th>
                <th>清掃員</th>
                <th>サービス</th>
                <th>提出日時</th>
                <th>状態</th>
                <th>詳細</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">読み込み中...</td>
                </tr>
              ) : filtered.length ? filtered.map((it) => (
                <tr key={it.id || `${it.workDate}-${it.createdAt}`}>
                  <td>{it.workDate || '-'}</td>
                  <td>{it.tenpoLabel || '-'}</td>
                  <td>{it.cleanerNames.length ? it.cleanerNames.join(' / ') : '-'}</td>
                  <td>{it.serviceNames.length ? it.serviceNames.join(' / ') : '-'}</td>
                  <td>{formatDateTime(it.createdAt)}</td>
                  <td>{it.status || '-'}</td>
                  <td>
                    {it.id ? (
                      <Link className="detail" to={`/admin/houkoku/${encodeURIComponent(it.id)}`}>表示</Link>
                    ) : '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="empty">対象期間の清掃レポートはありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </TableCard>
    </Wrap>
  );
}

const Wrap = styled.div`
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 14px 64px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;

  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
  }

  p {
    margin: 6px 0 0;
    font-size: 12px;
    opacity: 0.8;
  }
`;

const HeaderActions = styled.div`
  display: inline-flex;
  gap: 8px;
  align-items: center;

  .sub,
  button {
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    padding: 0 12px;
    font-size: 12px;
    font-weight: 800;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .sub {
    background: rgba(59, 130, 246, 0.16);
    color: inherit;
  }

  button {
    background: rgba(16, 185, 129, 0.2);
    color: inherit;
    cursor: pointer;
  }
`;

const FilterCard = styled.div`
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.45);
  padding: 10px;
  display: grid;
  grid-template-columns: 180px 180px minmax(260px, 1fr);
  gap: 8px;

  label {
    display: grid;
    gap: 4px;
  }

  label span {
    font-size: 11px;
    font-weight: 800;
    opacity: 0.78;
  }

  input {
    height: 34px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    padding: 0 8px;
    outline: none;
  }

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const ErrorBox = styled.div`
  margin-top: 10px;
  border: 1px solid rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.14);
  color: #fecaca;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 700;
`;

const TableCard = styled.div`
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.45);
  overflow: hidden;
`;

const TableHead = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 12px;

  strong {
    font-size: 12px;
    font-weight: 900;
  }

  span {
    font-size: 11px;
    opacity: 0.76;
  }
`;

const TableWrap = styled.div`
  overflow: auto;

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 920px;
  }

  th,
  td {
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.45;
  }

  th {
    position: sticky;
    top: 0;
    background: rgba(2, 6, 23, 0.92);
    font-size: 11px;
    font-weight: 900;
    z-index: 1;
  }

  .detail {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 52px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(59, 130, 246, 0.45);
    background: rgba(59, 130, 246, 0.16);
    color: inherit;
    text-decoration: none;
    font-weight: 800;
    font-size: 11px;
  }

  .empty {
    text-align: center;
    padding: 18px;
    opacity: 0.8;
    font-weight: 700;
  }
`;
