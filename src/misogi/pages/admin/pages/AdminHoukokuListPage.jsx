import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { apiFetchWorkReport } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';

const AdminHoukokuListPage = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
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
            payload,
        };
    }, [coercePayloadObject]);

    const fetchByHoukoku = useCallback(async (date, headers) => {
        const res = await apiFetchWorkReport(`/houkoku?date=${date}`, {
            method: 'GET',
            headers,
        });
        const items = Array.isArray(res) ? res : (res?.items || []);
        return items.map(normalizeReport).filter(Boolean);
    }, [normalizeReport]);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken() || localStorage.getItem('cognito_id_token');
            const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
            const items = await fetchByHoukoku(date, headers);
            setReports(items);
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
    }, [date, getToken, fetchByHoukoku]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const filteredReports = reports.filter(r => {
        const searchStr = JSON.stringify(r).toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
    });

    const getTemplateLabel = (tid) => {
        if (tid === 'CLEANING_V1') return { label: '清掃', color: '#10B981', icon: 'fa-broom' };
        if (tid === 'SALES_V1') return { label: '営業', color: '#3B82F6', icon: 'fa-briefcase' };
        if (tid === 'ENGINEERING_V1') return { label: '開発', color: '#8B5CF6', icon: 'fa-code' };
        if (tid === 'OFFICE_V1') return { label: '事務', color: '#F59E0B', icon: 'fa-file-invoice' };
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

    return (
        <Container>
            <Header>
                <HeaderLeft>
                    <BackButton to="/portal"><i className="fas fa-chevron-left"></i></BackButton>
                    <Title>報告一覧 <small>New</small></Title>
                </HeaderLeft>
                <Controls>
                    <DateInput type="date" value={date} onChange={e => setDate(e.target.value)} />
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

            {loading ? (
                <LoadingMessage><i className="fas fa-spinner fa-spin"></i> 読み込み中...</LoadingMessage>
            ) : error ? (
                <ErrorMessage>{error}</ErrorMessage>
            ) : filteredReports.length === 0 ? (
                <EmptyMessage>
                    <i className="fas fa-folder-open"></i>
                    <p>{date} の報告は見つかりませんでした。</p>
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
    max-width: 1200px;
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
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    transition: all 0.2s;
    &:hover { transform: translateX(-4px); color: #1e293b; }
`;

const Title = styled.h1`
    font-size: 28px;
    font-weight: 800;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    small {
        font-size: 12px;
        background: #3B82F6;
        color: white;
        padding: 2px 8px;
        border-radius: 999px;
        text-transform: uppercase;
    }
`;

const Controls = styled.div`
    display: flex;
    gap: 12px;
    align-items: center;
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
