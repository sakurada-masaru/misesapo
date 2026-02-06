import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, Link } from 'react-router-dom';
import { apiFetchWorkReport } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';
import TemplateRenderer from '../../../shared/components/TemplateRenderer';
import { getTemplateById } from '../../../templates';

const AdminHoukokuDetailPage = () => {
    const { reportId } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeStoreTab, setActiveStoreTab] = useState(0);
    const { getToken } = useAuth();

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const token = getToken() || localStorage.getItem('cognito_id_token');
                const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
                const data = await apiFetchWorkReport(`/houkoku/${reportId}`, { headers });
                setReport(data);
            } catch (e) {
                setError('データの取得に失敗しました。');
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [reportId, getToken]);

    if (loading) return <Container><LoadingSpinner />読み込み中...</Container>;
    if (error) return <Container><ErrorMessage>{error}</ErrorMessage></Container>;
    if (!report) return <Container><Message>報告が見つかりません。</Message></Container>;

    // payload が object かどうかチェック（型ガード：文字列/NULL対策）
    const payload =
        report?.payload && typeof report.payload === 'object' && !Array.isArray(report.payload)
            ? report.payload
            : {};

    // template_id からテンプレートを取得
    const templateId = report.template_id;
    const template = templateId ? getTemplateById(templateId) : null;

    // header/overview も型ガード（後方互換fallback用）
    const header =
        payload?.header && typeof payload.header === 'object' ? payload.header : {};
    const overview =
        payload?.overview && typeof payload.overview === 'object' ? payload.overview : {};
    const reportMeta = {
        id: report.id,
        work_date: report.work_date || header.work_date || overview.work_date || null,
        user_name: report.user_name || header.reporter_name || header.user_name || overview.worker_name || overview.user_name || null,
        user_id: report.user_id,
        state: report.state,
        created_at: report.created_at,
        updated_at: report.updated_at,
        template_id: report.template_id,
    };

    // 旧データ用（storesがある場合のフォールバック表示）
    // もし stores がなければ、payload 自体を単一の store item として扱う（営業報告書などはこれに該当）
    const stores = Array.isArray(payload.stores) && payload.stores.length > 0
        ? payload.stores
        : [payload]; // 自身を配列に入れる
    const activeStoreRaw = stores[activeStoreTab] || null;
    const activeStore = activeStoreRaw ? {
        ...(activeStoreRaw.store || {}),
        ...activeStoreRaw,
        // metaがあればそれもマージ
        template_id: activeStoreRaw.template_id || report.template_id,
        template_payload: activeStoreRaw.template_payload
    } : null;

    // 作業時間を計算（分）- 旧表示用
    const calcMinutes = (start, end) => {
        if (!start || !end) return null;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    };

    return (
        <Container>
            <TopBar>
                <BackButton to="/admin/houkoku"><i className="fas fa-chevron-left"></i> 戻る</BackButton>
                <Actions>
                    <button onClick={() => window.print()}><i className="fas fa-print"></i> 印刷</button>
                    <button><i className="fas fa-share-alt"></i> 共有</button>
                </Actions>
            </TopBar>

            <ContentArea>
                {/* 1. マルチ店舗（stores）データがある場合: 店舗タブ形式 */}
                {stores.length > 0 ? (
                    <>
                        {/* タブナビゲーション */}
                        {stores.length > 1 && (
                            <StoreTabNav>
                                {stores.map((item, idx) => {
                                    const s = item.store || item;
                                    return (
                                        <StoreTabItem
                                            key={idx}
                                            $active={activeStoreTab === idx}
                                            onClick={() => setActiveStoreTab(idx)}
                                        >
                                            <span>{s.name || s.store_name || `店舗 ${idx + 1}`}</span>
                                        </StoreTabItem>
                                    );
                                })}
                            </StoreTabNav>
                        )}

                        {/* 選択された店舗の報告書 */}
                        {activeStore && (() => {
                            const s = activeStore;
                            const attachments = s.attachments || [];
                            const attachmentsAfter = s.attachments_after || [];
                            const services = s.services || [];
                            const inspection = s.inspection || {};
                            const workMinutes = calcMinutes(s.work_start_time, s.work_end_time);

                            return (
                                <ReportDocument>
                                    {s.template_id ? (
                                        <TemplateRenderer
                                            template={getTemplateById(s.template_id)}
                                            report={{
                                                ...reportMeta,
                                                work_date: header.work_date || reportMeta.work_date,
                                                // 店舗ごとの作業時間を優先して表示に反映させるための調整
                                                start_time: s.work_start_time,
                                                end_time: s.work_end_time
                                            }}
                                            payload={s.template_payload || {}}
                                            mode="view"
                                        />
                                    ) : (
                                        <>
                                            {/* 旧レイアウト（後方互換用） */}
                                            <ReportTitle>グリストラップ清掃 作業報告書</ReportTitle>

                                            <Section>
                                                <SectionTitle>1. 作業概要</SectionTitle>
                                                <InfoList>
                                                    <InfoRow>
                                                        <InfoLabel>作業日：</InfoLabel>
                                                        <InfoValue>{header.work_date || report.work_date || '—'}</InfoValue>
                                                    </InfoRow>
                                                    <InfoRow>
                                                        <InfoLabel>作業時間：</InfoLabel>
                                                        <InfoValue>{workMinutes ? `${workMinutes}分` : '—'}</InfoValue>
                                                    </InfoRow>
                                                    <InfoRow>
                                                        <InfoLabel>作業場所：</InfoLabel>
                                                        <InfoValue>{s.name || s.store_name || '—'}</InfoValue>
                                                    </InfoRow>
                                                    <InfoRow>
                                                        <InfoLabel>担当作業員：</InfoLabel>
                                                        <InfoValue>{header.reporter_name || report.user_name || '—'}</InfoValue>
                                                    </InfoRow>
                                                </InfoList>
                                            </Section>

                                            <Section>
                                                <SectionTitle>3. 作業前の現場状況</SectionTitle>
                                                <CheckList>
                                                    <CheckRow>
                                                        <CheckLabel>油脂の堆積状況：</CheckLabel>
                                                        <CheckOptions>
                                                            <CheckOption $checked={inspection.fat_level === 'low'}>□ 少</CheckOption>
                                                            <CheckOption $checked={inspection.fat_level === 'middle'}>□ 中</CheckOption>
                                                            <CheckOption $checked={inspection.fat_level === 'high'}>□ 多</CheckOption>
                                                        </CheckOptions>
                                                    </CheckRow>
                                                </CheckList>
                                            </Section>

                                            <Section>
                                                <SectionTitle>4. 清掃内容</SectionTitle>
                                                <ServiceList>
                                                    {services.map((sv, si) => (
                                                        <ServiceItem key={si}><i className="fas fa-check"></i> {sv.name}</ServiceItem>
                                                    ))}
                                                </ServiceList>
                                            </Section>

                                            <Section>
                                                <SectionTitle>5. 作業写真</SectionTitle>
                                                <PhotoSection>
                                                    <PhotoGrid>
                                                        {attachments.map((img, i) => (
                                                            <PhotoItem key={i} href={img.url} target="_blank"><img src={img.url} alt="Before" /></PhotoItem>
                                                        ))}
                                                    </PhotoGrid>
                                                </PhotoSection>
                                            </Section>

                                            <ReportFooter>
                                                <FooterInfo>
                                                    <span>提出日時：{report.created_at ? new Date(report.created_at).toLocaleString('ja-JP') : '—'}</span>
                                                    <span>作業者：{report.user_name || '—'}</span>
                                                </FooterInfo>
                                            </ReportFooter>
                                        </>
                                    )}
                                </ReportDocument>
                            );
                        })()}
                    </>
                ) : (
                    <EmptyCard>
                        <i className="fas fa-exclamation-triangle"></i>
                        <p>詳細な店舗データがありません。</p>
                        <details style={{ marginTop: 20, textAlign: 'left', width: '100%' }}>
                            <summary style={{ cursor: 'pointer', color: '#64748b' }}>未展開の生データを確認</summary>
                            <pre style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10, overflowX: 'auto' }}>
                                {JSON.stringify(payload, null, 2)}
                            </pre>
                        </details>
                    </EmptyCard>
                )}
            </ContentArea >
        </Container >
    );
};

const getLabel = (id) => {
    if (id?.includes('CLEANING')) return '清掃業務報告';
    if (id?.includes('SALES')) return '営業外勤報告';
    return '業務報告';
};

const getFatLabel = (lvl) => {
    const map = { low: '少', middle: '中', high: '多', abnormal: '異常' };
    return map[lvl] || lvl;
};

const getOdorLabel = (lvl) => {
    const map = { none: 'なし', low: '弱', middle: '中', high: '強' };
    return map[lvl] || lvl;
};

// --- Styles ---
const Container = styled.div` background: #f0f2f5; min-height: 100vh; padding-bottom: 60px; font-family: 'Inter', sans-serif; `;
const TopBar = styled.div` background: white; padding: 12px 24px; display: flex; align-items: center; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 100; `;
const BackButton = styled(Link)` text-decoration: none; color: #1e293b; font-weight: 700; margin-right: 20px; font-size: 14px; &:hover { color:#3b82f6; } `;
const Badge = styled.div` background: ${props => props.$type?.includes('CLEANING') ? '#10b981' : '#3b82f6'}; color: white; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; `;
const Actions = styled.div` margin-left: auto; display: flex; gap: 8px; button { background: white; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; &:hover { background:#f8fafc; } } `;
const ContentArea = styled.div` max-width: 1000px; margin: 32px auto; padding: 0 20px; `;
const HeroSection = styled.div` background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; border-radius: 24px; padding: 40px; display: flex; gap: 40px; align-items: center; margin-bottom: 24px; `;
const Avatar = styled.div` width: 72px; height: 72px; background: rgba(255,255,255,0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; border: 2px solid rgba(255,255,255,0.2); `;
const ReporterInfo = styled.div` display: flex; gap: 20px; align-items: center; flex: 1; `;
const ReporterName = styled.h1` font-size: 28px; font-weight: 800; margin: 0; `;
const ReportDate = styled.div` opacity: 0.6; font-size: 14px; margin-top: 4px; `;
const OverviewGrid = styled.div` display: flex; gap: 32px; `;
const StatBox = styled.div` text-align: center; `;
const StatLabel = styled.div` font-size: 11px; opacity: 0.5; text-transform: uppercase; margin-bottom: 8px; font-weight: 700; `;
const StatValue = styled.div` font-size: 18px; font-weight: 800; `;
const NoteCard = styled.div` background: #fffbeb; border: 1px solid #fde68a; border-radius: 20px; padding: 24px; margin-bottom: 32px; `;
const NoteContent = styled.div` font-size: 16px; line-height: 1.7; color: #92400e; `;
const StoreCard = styled.div` background: white; border-radius: 24px; margin-bottom: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; `;
const StoreHeader = styled.div` padding: 20px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; `;
const StoreTitle = styled.h3` font-size: 18px; font-weight: 800; margin: 0; color: #1e293b; `;
const StoreTime = styled.span` font-size: 13px; font-weight: 700; color: #64748b; background: white; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; `;
const StoreGrid = styled.div` display: grid; grid-template-columns: 1.2fr 1fr; `;
const InfoPanel = styled.div` padding: 32px; border-right: 1px solid #f1f5f9; `;
const ImagePanel = styled.div` padding: 32px; background: #fafafa; `;
const LabelSmall = styled.div` font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px; `;
const TagList = styled.div` display: flex; flex-wrap: wrap; gap: 8px; `;
const Tag = styled.span` background: white; border: 1px solid #e2e8f0; padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #334155; i { color: #10b981; margin-right: 4px; } `;
const ValueBlock = styled.div` font-size: 15px; line-height: 1.6; color: #334155; white-space: pre-wrap; `;
const PhotoGridMini = styled.div` display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; `;
const PhotoItem = styled.a` display: block; aspect-ratio: 4/3; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; img { width: 100%; height: 100%; object-fit: cover; transition: 0.2s; } &:hover img { transform: scale(1.05); } `;
const EmptyImage = styled.div` aspect-ratio: 16/9; background: #f1f5f9; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; color:#94a3b8; font-size: 14px; i { font-size: 24px; margin-bottom: 8px; } `;
const SectionHeader = styled.h2` font-size: 14px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 40px 0 16px; letter-spacing: 0.1em; `;
const EmptyCard = styled.div` background: white; border-radius: 24px; padding: 60px; text-align: center; color: #64748b; border: 2px dashed #e2e8f0; i { font-size: 40px; color: #f59e0b; margin-bottom: 20px; } p { max-width: 400px; margin: 0 auto; line-height: 1.6; } `;
const LoadingSpinner = styled.div` width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 100px auto 20px; @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } `;
const Message = styled.div` text-align: center; padding: 100px; color:#94a3b8; `;
const ErrorMessage = styled(Message)` color:#ef4444; `;

const InspectionGrid = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const InspectionItem = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
    padding: 8px 16px;
    border-radius: 12px;
    border: 1px solid #f1f5f9;
    .label {
        font-size: 13px;
        font-weight: 700;
        color: #64748b;
    }
`;

const StatusBadge = styled.span`
    font-size: 12px;
    font-weight: 800;
    padding: 2px 10px;
    border-radius: 6px;
    ${props => {
        if (props.$level === 'high' || props.$level === 'abnormal') return 'background: #fee2e2; color: #ef4444;';
        if (props.$level === 'middle') return 'background: #fef3c7; color: #d97706;';
        if (props.$level === 'low' || props.$level === 'none') return 'background: #ecfdf5; color: #10b981;';
        return 'background: #f1f5f9; color: #64748b;';
    }}
`;

const StoreTabNav = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    overflow-x: auto;
    padding-bottom: 8px;
    &::-webkit-scrollbar {
        height: 4px;
    }
    &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
    }
`;

const StoreTabItem = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: 2px solid ${props => props.$active ? '#3b82f6' : '#e2e8f0'};
    background: ${props => props.$active ? '#3b82f6' : 'white'};
    color: ${props => props.$active ? 'white' : '#64748b'};
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    &:hover {
        border-color: #3b82f6;
        background: ${props => props.$active ? '#3b82f6' : '#eff6ff'};
    }
    i {
        font-size: 12px;
    }
`;

const BrandTag = styled.span`
    margin-left: 12px;
    font-size: 12px;
    font-weight: 600;
    color: #ec4899;
    background: #fdf2f8;
    padding: 2px 10px;
    border-radius: 6px;
`;

const StoreInfoBar = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px 24px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
`;

const InfoItem = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #64748b;
    i {
        color: #94a3b8;
        font-size: 12px;
    }
`;

// 報告書フォーマット用スタイル（外枠コンテナ）
const ReportDocument = styled.div`
    width: 100%;
    margin: 0 auto;
    @media print {
        padding: 0;
    }
`;

const ReportTitle = styled.h1`
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 40px 0;
    padding-bottom: 16px;
    border-bottom: 2px solid #1e293b;
    font-style: italic;
`;

const Section = styled.section`
    margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 16px 0;
`;

const SubSection = styled.div`
    margin-left: 16px;
`;

const SubSectionTitle = styled.h3`
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 12px 0;
`;

const InfoList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
`;

const InfoRow = styled.li`
    display: flex;
    align-items: baseline;
    padding: 8px 0;
    border-bottom: 1px dotted #e5e7eb;
    &:last-child {
        border-bottom: none;
    }
`;

const InfoLabel = styled.span`
    font-size: 14px;
    color: #374151;
    min-width: 180px;
    flex-shrink: 0;
`;

const InfoValue = styled.span`
    font-size: 14px;
    color: #1e293b;
    font-weight: 500;
`;

const DescriptionText = styled.p`
    font-size: 14px;
    line-height: 1.8;
    color: #374151;
    margin: 0 0 12px 0;
    &:last-child {
        margin-bottom: 0;
    }
`;

const CheckList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const CheckRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const CheckLabel = styled.span`
    font-size: 14px;
    color: #374151;
    min-width: 160px;
`;

const CheckOptions = styled.div`
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
`;

const CheckOption = styled.span`
    font-size: 14px;
    color: ${props => props.$checked ? '#1e293b' : '#9ca3af'};
    font-weight: ${props => props.$checked ? '700' : '400'};
    ${props => props.$checked && `
        &::before {
            content: '☑';
            margin-right: -2px;
        }
        &::first-letter {
            visibility: hidden;
        }
    `}
`;

const ServiceList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

const ServiceItem = styled.span`
    font-size: 14px;
    color: #374151;
    i {
        color: #10b981;
        margin-right: 6px;
    }
`;

const PhotoSection = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    @media (max-width: 768px) {
        grid-template-columns: 1fr;
    }
`;

const PhotoGroup = styled.div``;

const PhotoGroupTitle = styled.h4`
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    margin: 0 0 12px 0;
`;

const PhotoGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
`;

const EmptyPhoto = styled.div`
    background: #f8fafc;
    border: 1px dashed #e2e8f0;
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    color: #94a3b8;
    font-size: 13px;
`;

const NoteBlock = styled.div`
    background: #f8fafc;
    border-left: 4px solid #3b82f6;
    padding: 16px 20px;
    font-size: 14px;
    line-height: 1.7;
    color: #374151;
    white-space: pre-wrap;
`;

const ReportFooter = styled.div`
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
`;

const FooterInfo = styled.div`
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #64748b;
`;

export default AdminHoukokuDetailPage;

