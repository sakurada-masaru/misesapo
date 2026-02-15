import React, { useMemo, useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { apiFetchWorkReport } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';

function parseYmd(ymd) {
    // Avoid TZ drift: interpret as local date (00:00).
    const [y, m, d] = String(ymd || '').split('-').map((v) => Number(v));
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function toYmd(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDays(ymd, days) {
    const d = parseYmd(ymd);
    d.setDate(d.getDate() + Number(days || 0));
    return toYmd(d);
}

function getWeekRange(anchorYmd) {
    const d = parseYmd(anchorYmd);
    // Monday-start week (ISO-like): Mon=1..Sun=0
    const dow = d.getDay(); // 0=Sun
    const deltaToMon = dow === 0 ? -6 : (1 - dow);
    d.setDate(d.getDate() + deltaToMon);
    const from = toYmd(d);
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const to = days[6];
    return { from, to, days };
}

function getMonthRange(anchorYmd) {
    const d = parseYmd(anchorYmd);
    const y = d.getFullYear();
    const m = d.getMonth();
    const fromDate = new Date(y, m, 1, 0, 0, 0, 0);
    const toDate = new Date(y, m + 1, 0, 0, 0, 0, 0);
    const from = toYmd(fromDate);
    const to = toYmd(toDate);
    const days = [];
    for (let cur = new Date(fromDate); cur <= toDate; cur.setDate(cur.getDate() + 1)) {
        days.push(toYmd(cur));
    }
    return { from, to, days, yyyyMm: `${y}-${String(m + 1).padStart(2, '0')}` };
}

function normalizeNameKey(name) {
    return String(name || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/　+/g, '')
        .toLowerCase();
}

async function mapLimit(list, limit, fn) {
    const items = Array.isArray(list) ? list : [];
    const lim = Math.max(1, Number(limit || 6));
    const results = new Array(items.length);
    let i = 0;
    const workers = Array.from({ length: Math.min(lim, items.length) }, async () => {
        while (true) {
            const idx = i++;
            if (idx >= items.length) break;
            results[idx] = await fn(items[idx], idx);
        }
    });
    await Promise.all(workers);
    return results;
}

const AdminHoukokuListPage = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reports, setReports] = useState([]);
    const [reportsByDate, setReportsByDate] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('day'); // day | week | month | calendar
    const [expectedUsers, setExpectedUsers] = useState([]);
    const { getToken } = useAuth();

    const coercePayloadObject = useCallback((raw) => {
        if (!raw) return {};
        if (typeof raw === 'object') return raw;
        if (typeof raw !== 'string') return {};
        const s = raw.trim();
        if (!s) return {};
        try {
            const j = JSON.parse(s);
            return (j && typeof j === 'object') ? j : {};
        } catch {
            return {};
        }
    }, []);

    const normalizeReport = useCallback((item) => {
        if (!item || typeof item !== 'object') return null;
        const payload = coercePayloadObject(
            item.payload ??
            item.payload_json ??
            item.payloadJson ??
            item.body ??
            item.data
        );

        const template_id =
            item.template_id ||
            item.templateId ||
            item.template ||
            payload.template_id ||
            payload.templateId ||
            payload.template ||
            'GENERAL_V1';

        return {
            ...item,
            id: item.id || item.log_id || item.report_id || '',
            template_id,
            user_id:
                item.user_id ||
                item.worker_id ||
                item.sagyouin_id ||
                item.created_by ||
                item.submitted_by ||
                payload.user_id ||
                payload.worker_id ||
                payload.sagyouin_id ||
                payload.created_by ||
                payload.submitted_by ||
                null,
            user_name:
                item.user_name ||
                item.worker_name ||
                item.sagyouin_name ||
                item.created_by_name ||
                item.submitted_by_name ||
                payload.user_name ||
                payload.worker_name ||
                payload.sagyouin_name ||
                '不明なユーザー',
            created_at:
                item.submitted_at ||
                item.created_at ||
                item.updated_at ||
                payload.submitted_at ||
                payload.created_at ||
                payload.updated_at ||
                new Date().toISOString(),
            work_date:
                item.work_date ||
                payload.work_date ||
                null,
            payload,
        };
    }, [coercePayloadObject]);

    const fetchByHoukoku = useCallback(async (date, headers) => {
        const res = await apiFetchWorkReport(`/houkoku?date=${date}`, {
            method: 'GET',
            headers,
        });
        const items = Array.isArray(res) ? res : (res?.items || []);
        return items.map((it) => {
            const r = normalizeReport(it);
            if (!r) return null;
            return { ...r, work_date: r.work_date || date };
        }).filter(Boolean);
    }, [normalizeReport]);

    const fetchByAdminRange = useCallback(async (from, to, headers) => {
        // Prefer range API (reduces calls, avoids UI hangs). Fallback to per-day later if unavailable.
        const url = `/admin/work-reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=2000`;
        const res = await apiFetchWorkReport(url, { method: 'GET', headers });
        const items = Array.isArray(res) ? res : (res?.items || res?.rows || []);
        const normalized = items.map((it) => {
            const r = normalizeReport(it);
            if (!r) return null;
            // work_date is required for grouping; best-effort fallbacks.
            const d =
                r.work_date ||
                r?.payload?.work_date ||
                r?.payload?.header?.work_date ||
                r?.payload?.overview?.work_date ||
                null;
            return { ...r, work_date: d };
        }).filter(Boolean);
        return normalized;
    }, [normalizeReport]);

    const fetchExpectedUsers = useCallback(async (headers) => {
        // Expectation set: internal JINZAI (display-only; used for submitted/missing visualization).
        // NOTE: reports may not include stable user_id; we match by cognito_sub/jinzai_id/name as best-effort.
        try {
            const res = await fetch(`/api-jinzai/jinzai?limit=2000&jotai=yuko`, { headers });
            if (!res.ok) return [];
            const j = await res.json();
            const items = Array.isArray(j) ? j : (j?.items || []);
            return items
                .filter((it) => (String(it?.han_type || it?.partner_type || 'internal') === 'internal'))
                .map((it) => ({
                    jinzai_id: it?.jinzai_id || it?.id || null,
                    cognito_sub: it?.cognito_sub || it?.sub || null,
                    name: it?.name || it?.display_name || it?.full_name || it?.username || '',
                    raw: it,
                }))
                .filter((it) => it.name || it.jinzai_id || it.cognito_sub);
        } catch {
            return [];
        }
    }, []);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken() || localStorage.getItem('cognito_id_token');
            const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
            if (viewMode === 'day') {
                const items = await fetchByHoukoku(date, headers);
                setReports(items);
                setReportsByDate({ [date]: items });
                return;
            }

            // Range modes
            const expected = await fetchExpectedUsers(headers);
            setExpectedUsers(expected);

            const range =
                viewMode === 'week'
                    ? getWeekRange(date)
                    : getMonthRange(date);

            let byDate = {};
            let all = [];

            // 1) Try range API first (fast, less hang risk)
            try {
                const allRange = await fetchByAdminRange(range.from, range.to, headers);
                all = allRange;
                byDate = {};
                for (const d of range.days) byDate[d] = [];
                for (const r of allRange) {
                    const d = r.work_date;
                    if (!d || !byDate[d]) continue;
                    byDate[d].push(r);
                }
            } catch (e) {
                // 404/403 etc: fallback to per-day fetch
                console.warn('[AdminHoukokuList] range API unavailable, fallback to per-day', e?.status || e);
                const rows = await mapLimit(range.days, 4, async (d) => {
                    const items = await fetchByHoukoku(d, headers);
                    return [d, items];
                });
                byDate = {};
                all = [];
                for (const [d, items] of rows) {
                    byDate[d] = items;
                    all.push(...(items || []));
                }
            }

            setReportsByDate(byDate);
            setReports(all);
        } catch (e) {
            console.error("Failed to fetch reports:", e);
            if (e?.status === 502) {
                setError('houkoku API が 502 を返しています（バックエンド要確認）');
            } else {
                setError('報告の取得に失敗しました。');
            }
        } finally {
            setLoading(false);
        }
    }, [date, getToken, fetchByHoukoku, fetchExpectedUsers, viewMode]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const filteredReports = useMemo(() => {
        const t = String(searchTerm || '').toLowerCase();
        if (!t) return reports;
        return (reports || []).filter((r) => {
            const searchStr = JSON.stringify(r).toLowerCase();
            return searchStr.includes(t);
        });
    }, [reports, searchTerm]);

    const getTemplateLabel = (tid) => {
        const s = String(tid || '');
        // Backward compatible buckets + newer template IDs.
        if (s === 'CLEANING_V1' || s.startsWith('CLEAN_') || s.startsWith('CLEANING_')) {
            return { label: '清掃', color: '#10B981', icon: 'fa-broom' };
        }
        if (s === 'SALES_V1' || s.startsWith('SALES_')) return { label: '営業', color: '#3B82F6', icon: 'fa-briefcase' };
        if (s === 'ENGINEERING_V1' || s.startsWith('ENGINEERING_') || s.startsWith('DEV_')) return { label: '開発', color: '#8B5CF6', icon: 'fa-code' };
        if (s === 'OFFICE_V1' || s.startsWith('OFFICE_')) return { label: '事務', color: '#F59E0B', icon: 'fa-file-invoice' };
        return { label: '一般', color: '#6B7280', icon: 'fa-file' };
    };

    const getReportPreview = useCallback((report) => {
        const payload = report?.payload || {};
        const pick = (...keys) => {
            for (const k of keys) {
                const v = payload?.[k];
                if (typeof v === 'string' && v.trim()) return v.trim();
            }
            return '';
        };

        // Common-ish names across templates / historical payloads
        const tenpoName =
            pick('tenpo_name', 'store_name', 'target_name') ||
            (payload?.stores?.[0]?.name ? String(payload.stores[0].name) : '');

        if (report?.template_id === 'SALES_V1') {
            return (
                pick('honjitsu_seika', 'result_today', 'summary', 'memo') ||
                tenpoName ||
                '営業報告'
            );
        }
        if (report?.template_id === 'CLEANING_V1') {
            return (
                tenpoName ||
                pick('summary', 'memo') ||
                '清掃報告'
            );
        }
        if (report?.template_id === 'ENGINEERING_V1') {
            return (
                pick('project', 'summary', 'memo') ||
                '開発報告'
            );
        }
        if (report?.template_id === 'OFFICE_V1') {
            return (
                pick('summary', 'memo') ||
                '事務報告'
            );
        }
        return (
            pick('summary', 'honjitsu_seika', 'memo') ||
            tenpoName ||
            '業務報告'
        );
    }, []);

    const periodLabel = useMemo(() => {
        if (viewMode === 'day') return date;
        if (viewMode === 'week') {
            const r = getWeekRange(date);
            return `${r.from}〜${r.to}（週）`;
        }
        const r = getMonthRange(date);
        return `${r.yyyyMm}（月）`;
    }, [date, viewMode]);

    const submissionSummary = useMemo(() => {
        const expected = expectedUsers || [];
        const expectedKeyToUser = new Map();
        for (const u of expected) {
            if (u.cognito_sub) expectedKeyToUser.set(String(u.cognito_sub), u);
            if (u.jinzai_id) expectedKeyToUser.set(String(u.jinzai_id), u);
            if (u.name) expectedKeyToUser.set(normalizeNameKey(u.name), u);
        }

        const submittedByUserKey = new Map(); // key -> { user, dates:Set, count:number }
        const unknownSubmitted = new Map(); // nameKey -> { name, dates:Set, count:number }

        for (const r of (reports || [])) {
            const keys = [];
            if (r?.user_id) keys.push(String(r.user_id));
            if (r?.user_name) keys.push(normalizeNameKey(r.user_name));
            let matched = null;
            for (const k of keys) {
                if (expectedKeyToUser.has(k)) {
                    matched = expectedKeyToUser.get(k);
                    break;
                }
            }
            const d = r?.work_date || date;
            if (matched) {
                const primaryKey = matched.cognito_sub || matched.jinzai_id || normalizeNameKey(matched.name);
                if (!submittedByUserKey.has(primaryKey)) {
                    submittedByUserKey.set(primaryKey, { user: matched, dates: new Set(), count: 0 });
                }
                const v = submittedByUserKey.get(primaryKey);
                v.dates.add(d);
                v.count += 1;
            } else {
                const nk = normalizeNameKey(r?.user_name || '不明');
                if (!unknownSubmitted.has(nk)) unknownSubmitted.set(nk, { name: r?.user_name || '不明', dates: new Set(), count: 0 });
                const v = unknownSubmitted.get(nk);
                v.dates.add(d);
                v.count += 1;
            }
        }

        const submittedUsers = Array.from(submittedByUserKey.values())
            .sort((a, b) => normalizeNameKey(a.user?.name).localeCompare(normalizeNameKey(b.user?.name)));
        const missingUsers = expected
            .filter((u) => {
                const primaryKey = u.cognito_sub || u.jinzai_id || normalizeNameKey(u.name);
                return !submittedByUserKey.has(primaryKey);
            })
            .sort((a, b) => normalizeNameKey(a.name).localeCompare(normalizeNameKey(b.name)));

        const unknown = Array.from(unknownSubmitted.values())
            .sort((a, b) => normalizeNameKey(a.name).localeCompare(normalizeNameKey(b.name)));

        return {
            expectedCount: expected.length,
            submittedCount: submittedUsers.length,
            missingCount: missingUsers.length,
            submittedUsers,
            missingUsers,
            unknown,
        };
    }, [date, expectedUsers, reports]);

    const goPrev = useCallback(() => {
        if (viewMode === 'day') return setDate((d) => addDays(d, -1));
        if (viewMode === 'week') return setDate((d) => addDays(getWeekRange(d).from, -7));
        // month/calendar
        const cur = parseYmd(date);
        cur.setMonth(cur.getMonth() - 1);
        setDate(toYmd(cur));
    }, [date, viewMode]);

    const goNext = useCallback(() => {
        if (viewMode === 'day') return setDate((d) => addDays(d, 1));
        if (viewMode === 'week') return setDate((d) => addDays(getWeekRange(d).from, 7));
        const cur = parseYmd(date);
        cur.setMonth(cur.getMonth() + 1);
        setDate(toYmd(cur));
    }, [date, viewMode]);

    const calendarGrid = useMemo(() => {
        if (viewMode !== 'calendar' && viewMode !== 'month') return null;
        const r = getMonthRange(date);
        const first = parseYmd(r.from);
        const startDow = first.getDay(); // 0=Sun
        const pad = startDow; // calendar grid starts Sunday
        const cells = [];
        for (let i = 0; i < pad; i++) cells.push(null);
        for (const d of r.days) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        const weeks = [];
        for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
        return { ...r, weeks };
    }, [date, viewMode]);

    return (
        <Container>
            <Header>
                <HeaderLeft>
                    <BackButton to="/admin/entrance" aria-label="管理トップへ戻る">
                        <i className="fas fa-chevron-left"></i>
                        <span>管理トップ</span>
                    </BackButton>
                    <Title>報告一覧</Title>
                </HeaderLeft>
                <Controls>
                    <ModeTabs role="tablist" aria-label="表示形式">
                        <ModeTab type="button" $active={viewMode === 'day'} onClick={() => setViewMode('day')}>日</ModeTab>
                        <ModeTab type="button" $active={viewMode === 'week'} onClick={() => setViewMode('week')}>週</ModeTab>
                        <ModeTab type="button" $active={viewMode === 'month'} onClick={() => setViewMode('month')}>月</ModeTab>
                        <ModeTab type="button" $active={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>カレンダー</ModeTab>
                    </ModeTabs>
                    <NavGroup>
                        <NavBtn type="button" onClick={goPrev} aria-label="前へ"><i className="fas fa-chevron-left"></i></NavBtn>
                        <DateInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                        <NavBtn type="button" onClick={goNext} aria-label="次へ"><i className="fas fa-chevron-right"></i></NavBtn>
                    </NavGroup>
                    <SearchBox>
                        <i className="fas fa-search"></i>
                        <input
                            placeholder="名前、キーワードで検索..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </SearchBox>
                </Controls>
            </Header>

            {viewMode !== 'day' && (
                <SummaryRow>
                    <PeriodChip>
                        <i className="fas fa-calendar-alt"></i>
                        <span>{periodLabel}</span>
                    </PeriodChip>
                    <SummaryRight>
                        <SummaryPill>
                            <span className="k">提出</span>
                            <span className="v">{submissionSummary.submittedCount}/{submissionSummary.expectedCount}</span>
                        </SummaryPill>
                        <SummaryPill $danger={submissionSummary.missingCount > 0}>
                            <span className="k">未提出</span>
                            <span className="v">{submissionSummary.missingCount}</span>
                        </SummaryPill>
                    </SummaryRight>
                </SummaryRow>
            )}

            {viewMode !== 'day' && submissionSummary.missingCount > 0 && (
                <MissingBox>
                    <MissingTitle>
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>未提出者（{submissionSummary.missingCount}）</span>
                    </MissingTitle>
                    <MissingTags>
                        {submissionSummary.missingUsers.slice(0, 40).map((u) => (
                            <MissingTag key={u.cognito_sub || u.jinzai_id || u.name}>{u.name || u.jinzai_id || '不明'}</MissingTag>
                        ))}
                        {submissionSummary.missingUsers.length > 40 && (
                            <MissingTag>… +{submissionSummary.missingUsers.length - 40}</MissingTag>
                        )}
                    </MissingTags>
                </MissingBox>
            )}

            {loading ? (
                <LoadingMessage><i className="fas fa-spinner fa-spin"></i> 読み込み中...</LoadingMessage>
            ) : error ? (
                <ErrorMessage>{error}</ErrorMessage>
            ) : viewMode === 'calendar' && calendarGrid ? (
                <CalendarWrap>
                    <CalendarHeader>
                        <h2>{calendarGrid.yyyyMm}</h2>
                        <div className="hint">日付をクリックすると、その日の詳細に絞り込みます。</div>
                    </CalendarHeader>
                    <CalendarWeekHead>
                        {['日', '月', '火', '水', '木', '金', '土'].map((w) => <div key={w}>{w}</div>)}
                    </CalendarWeekHead>
                    <CalendarGrid>
                        {calendarGrid.weeks.map((week, wi) => (
                            <React.Fragment key={wi}>
                                {week.map((d, di) => {
                                    if (!d) return <CalCell key={`${wi}-${di}`} />;
                                    const items = reportsByDate?.[d] || [];
                                    const unique = new Set(items.map((r) => normalizeNameKey(r?.user_name || '不明'))).size;
                                    const total = items.length;
                                    const isToday = d === toYmd(new Date());
                                    return (
                                        <CalCell
                                            key={d}
                                            $clickable
                                            $today={isToday}
                                            onClick={() => { setDate(d); setViewMode('day'); }}
                                        >
                                            <div className="top">
                                                <div className="day">{Number(String(d).split('-')[2])}</div>
                                                {isToday && <div className="badge">TODAY</div>}
                                            </div>
                                            <div className="meta">
                                                <span className="c">{total}件</span>
                                                <span className="u">{unique}人</span>
                                            </div>
                                        </CalCell>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </CalendarGrid>
                </CalendarWrap>
            ) : filteredReports.length === 0 ? (
                <EmptyMessage>
                    <i className="fas fa-folder-open"></i>
                    <p>{periodLabel} の報告は見つかりませんでした。</p>
                </EmptyMessage>
            ) : (
                <Grid>
                    {filteredReports.map(report => {
                        const style = getTemplateLabel(report.template_id);
                        return (
                            <ReportCard key={report.id}>
                                <CardHeader $color={style.color}>
                                    <TypeTag $color={style.color}>
                                        <i className={`fas ${style.icon}`}></i> {style.label}
                                    </TypeTag>
                                    <CardId>{report.id.split('#').pop()}</CardId>
                                </CardHeader>
                                    <CardBody>
                                        <UserName>{report.user_name || '不明なユーザー'}</UserName>
                                    <ContentPreview>{getReportPreview(report)}</ContentPreview>
                                    <Timestamp>{new Date(report.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 提出</Timestamp>
                                </CardBody>
                                <CardFooter>
                                    <DetailButton to={`/admin/houkoku/${report.id}`}>詳細を見る</DetailButton>
                                </CardFooter>
                            </ReportCard>
                        );
                    })}
                </Grid>
            )}
        </Container>
    );
};

// Styled Components
const Container = styled.div`
    padding: 32px;
    max-width: 1240px;
    margin: 0 auto;
    min-height: 100vh;
    color: #1e293b;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    flex-wrap: wrap;
    gap: 20px;
`;

const HeaderLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
`;

const BackButton = styled(Link)`
    height: 40px;
    border-radius: 999px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    transition: all 0.2s;
    gap: 10px;
    padding: 0 14px;
    font-weight: 800;
    letter-spacing: 0.01em;
    span { font-size: 13px; color: #334155; }
    &:hover { transform: translateX(-3px); color: #1e293b; }
`;

const Title = styled.h1`
    font-size: 28px;
    font-weight: 800;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const Controls = styled.div`
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
`;

const ModeTabs = styled.div`
    display: inline-flex;
    gap: 6px;
    padding: 6px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #ffffffcc;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(6px);
`;

const ModeTab = styled.button`
    appearance: none;
    border: 0;
    border-radius: 10px;
    padding: 8px 12px;
    font-weight: 900;
    font-size: 13px;
    color: ${p => p.$active ? '#0f172a' : '#64748b'};
    background: ${p => p.$active ? '#e2e8f0' : 'transparent'};
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
    &:hover { transform: translateY(-1px); }
`;

const NavGroup = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 8px;
`;

const NavBtn = styled.button`
    appearance: none;
    border: 1px solid #e2e8f0;
    background: white;
    color: #334155;
    height: 40px;
    width: 40px;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 6px 10px rgba(15, 23, 42, 0.06);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    &:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 16px rgba(15, 23, 42, 0.10);
    }
`;

const DateInput = styled.input`
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    font-weight: 600;
    color: #1e293b;
    outline: none;
    &:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
`;

const SearchBox = styled.div`
    position: relative;
    i {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
    }
    input {
        padding: 10px 16px 10px 36px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        width: 240px;
        outline: none;
        transition: all 0.2s;
        &:focus { width: 300px; border-color: #3B82F6; }
    }
`;

const SummaryRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
    flex-wrap: wrap;
`;

const PeriodChip = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background: white;
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
    font-weight: 900;
    color: #0f172a;
    i { color: #3b82f6; }
`;

const SummaryRight = styled.div`
    display: inline-flex;
    gap: 10px;
    align-items: center;
`;

const SummaryPill = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 1px solid ${p => p.$danger ? '#fecaca' : '#e2e8f0'};
    background: ${p => p.$danger ? '#fff1f2' : 'white'};
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
    .k { font-weight: 900; color: ${p => p.$danger ? '#b91c1c' : '#334155'}; }
    .v { font-weight: 1000; letter-spacing: 0.02em; color: ${p => p.$danger ? '#991b1b' : '#0f172a'}; }
`;

const MissingBox = styled.div`
    border: 1px solid #fecaca;
    background: #fff1f2;
    border-radius: 16px;
    padding: 14px 14px 10px;
    margin-bottom: 18px;
`;

const MissingTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 1000;
    color: #991b1b;
    margin-bottom: 10px;
`;

const MissingTags = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

const MissingTag = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: white;
    border: 1px solid #fecaca;
    color: #7f1d1d;
    font-weight: 800;
    font-size: 12px;
`;

const CalendarWrap = styled.div`
    background: white;
    border-radius: 20px;
    border: 1px solid #f1f5f9;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
    padding: 18px;
`;

const CalendarHeader = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
    h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 1000;
        letter-spacing: 0.02em;
        color: #0f172a;
    }
    .hint {
        font-size: 12px;
        color: #64748b;
        font-weight: 700;
    }
`;

const CalendarWeekHead = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 10px;
    margin-bottom: 10px;
    div {
        text-align: center;
        font-size: 12px;
        font-weight: 900;
        color: #64748b;
    }
`;

const CalendarGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 10px;
`;

const CalCell = styled.div`
    min-height: 86px;
    border-radius: 16px;
    border: 1px solid #f1f5f9;
    background: #f8fafc;
    padding: 10px 10px 12px;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    ${p => p.$clickable ? 'cursor: pointer; background: white;' : ''}
    ${p => p.$today ? 'border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(59,130,246,0.15);' : ''}
    &:hover {
        ${p => p.$clickable ? 'transform: translateY(-2px); box-shadow: 0 12px 18px rgba(15,23,42,0.10);' : ''}
    }
    .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    .day {
        font-weight: 1000;
        color: #0f172a;
        font-size: 18px;
    }
    .badge {
        font-size: 10px;
        font-weight: 1000;
        background: #3b82f6;
        color: white;
        padding: 2px 8px;
        border-radius: 999px;
        letter-spacing: 0.06em;
    }
    .meta {
        display: flex;
        gap: 10px;
        align-items: center;
        font-size: 12px;
        font-weight: 900;
        color: #334155;
    }
    .meta .c { color: #0f172a; }
    .meta .u { color: #64748b; }
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
`;

const ReportCard = styled.div`
    background: white;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid #f1f5f9;
    &:hover {
        transform: translateY(-8px);
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
`;

const CardHeader = styled.div`
    padding: 16px 20px;
    background: ${props => props.$color}10;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const TypeTag = styled.span`
    font-size: 13px;
    font-weight: 700;
    color: ${props => props.$color};
    display: flex;
    align-items: center;
    gap: 6px;
`;

const CardId = styled.span`
    font-size: 11px;
    color: #94a3b8;
    font-family: monospace;
`;

const CardBody = styled.div`
    padding: 20px;
`;

const UserName = styled.div`
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
`;

const ContentPreview = styled.div`
    font-size: 14px;
    color: #64748b;
    line-height: 1.5;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

const Timestamp = styled.div`
    font-size: 12px;
    color: #94a3b8;
`;

const CardFooter = styled.div`
    padding: 16px 20px;
    border-top: 1px solid #f1f5f9;
`;

const DetailButton = styled(Link)`
    display: block;
    text-align: center;
    padding: 10px;
    background: #f8fafc;
    border-radius: 10px;
    color: #1e293b;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.2s;
    &:hover { background: #1e293b; color: white; }
`;

const LoadingMessage = styled.div`
    text-align: center;
    padding: 100px;
    color: #64748b;
    font-size: 18px;
`;

const ErrorMessage = styled.div`
    background: #fef2f2;
    color: #ef4444;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
`;

const EmptyMessage = styled.div`
    text-align: center;
    padding: 100px;
    color: #94a3b8;
    i { font-size: 64px; margin-bottom: 20px; }
    p { font-size: 18px; }
`;

export default AdminHoukokuListPage;
