import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, Link } from 'react-router-dom';
import { apiFetchWorkReport } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';

const AdminHoukokuDetailPage = () => {
    const { reportId } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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

    const payload = report.payload || {};
    const header = payload.header || (payload.work_date ? payload : {});
    const stores = payload.stores || [];

    // 写真の集計
    let allPhotos = [...(payload.attachments || [])];
    stores.forEach(s => { if (s.attachments) allPhotos = [...allPhotos, ...s.attachments]; });

    return (
        <Container>
            <TopBar>
                <BackButton to="/admin/houkoku"><i className="fas fa-chevron-left"></i> 戻る</BackButton>
                <Badge $type={report.template_id}>{getLabel(report.template_id)}</Badge>
                <Actions>
                    <button onClick={() => window.print()}><i className="fas fa-print"></i> 印刷</button>
                    <button><i className="fas fa-share-alt"></i> 共有</button>
                </Actions>
            </TopBar>

            <ContentArea>
                {/* 1. Header Hero Section */}
                <HeroSection>
                    <ReporterInfo>
                        <Avatar>{report.user_name?.charAt(0)}</Avatar>
                        <div>
                            <ReporterName>{report.user_name}</ReporterName>
                            <ReportDate>{new Date(report.created_at).toLocaleString('ja-JP')} 提出</ReportDate>
                        </div>
                    </ReporterInfo>
                    <OverviewGrid>
                        <StatBox>
                            <StatLabel>作業日</StatLabel>
                            <StatValue>{header.work_date || report.work_date}</StatValue>
                        </StatBox>
                        <StatBox>
                            <StatLabel>稼働時間</StatLabel>
                            <StatValue>{header.work_start_time || '--:--'} 〜 {header.work_end_time || '--:--'}</StatValue>
                        </StatBox>
                        <StatBox>
                            <StatLabel>店舗数</StatLabel>
                            <StatValue>{stores.length} 件</StatValue>
                        </StatBox>
                    </OverviewGrid>
                </HeroSection>

                {/* 2. 備考 (もしあれば) */}
                {header.note && (
                    <NoteCard>
                        <SectionTitle><i className="fas fa-comment-dots"></i> 作業者からの共通備考</SectionTitle>
                        <NoteContent>{header.note}</NoteContent>
                    </NoteCard>
                )}

                {/* 3. 詳細データ：店舗ごと */}
                <SectionHeader>詳細レポート項目</SectionHeader>
                {stores.length > 0 ? (
                    stores.map((item, idx) => {
                        const s = item.store || item;
                        const attachments = s.attachments || [];
                        const attachmentsAfter = s.attachments_after || [];
                        const services = s.services || [];
                        const inspection = s.inspection || {};

                        return (
                            <StoreCard key={idx}>
                                <StoreHeader>
                                    <StoreTitle><i className="fas fa-store"></i> {s.name || s.store_name || `店舗 ${idx + 1}`}</StoreTitle>
                                    <StoreTime>{s.work_start_time} - {s.work_end_time}</StoreTime>
                                </StoreHeader>

                                <StoreGrid>
                                    <InfoPanel>
                                        <LabelSmall>清掃箇所</LabelSmall>
                                        <TagList>
                                            {services.map((sv, si) => (
                                                <Tag key={si}><i className="fas fa-check-circle"></i> {sv.name}</Tag>
                                            ))}
                                            {services.length === 0 && <span style={{ color: '#94a3b8' }}>記録なし</span>}
                                        </TagList>

                                        {/* 点検項目の表示 */}
                                        {Object.keys(inspection).length > 0 && (
                                            <>
                                                <LabelSmall style={{ marginTop: '24px' }}>点検・調査結果</LabelSmall>
                                                <InspectionGrid>
                                                    {inspection.fat_level && (
                                                        <InspectionItem>
                                                            <div className="label">油脂堆積</div>
                                                            <StatusBadge $level={inspection.fat_level}>{getFatLabel(inspection.fat_level)}</StatusBadge>
                                                        </InspectionItem>
                                                    )}
                                                    {inspection.odor_level && (
                                                        <InspectionItem>
                                                            <div className="label">悪臭</div>
                                                            <StatusBadge $level={inspection.odor_level}>{getOdorLabel(inspection.odor_level)}</StatusBadge>
                                                        </InspectionItem>
                                                    )}
                                                    {inspection.assessment && (
                                                        <InspectionItem>
                                                            <div className="label">評価</div>
                                                            <StatusBadge $level={inspection.assessment === 'normal' ? 'none' : 'high'}>
                                                                {inspection.assessment === 'normal' ? '通常' : '想定外・異常'}
                                                            </StatusBadge>
                                                        </InspectionItem>
                                                    )}
                                                </InspectionGrid>
                                            </>
                                        )}

                                        <LabelSmall style={{ marginTop: '24px' }}>所感・伝達事項</LabelSmall>
                                        <ValueBlock>{s.note || s.memo || '特筆事項なし'}</ValueBlock>
                                    </InfoPanel>

                                    <ImagePanel>
                                        {/* Before 写真 */}
                                        <LabelSmall>{s.photo_mode === 'execution' ? '施工写真' : '作業前 (Before)'} ({attachments.length})</LabelSmall>
                                        <PhotoGridMini>
                                            {attachments.map((img, i) => (
                                                <PhotoItem key={i} href={img.url} target="_blank">
                                                    <img src={img.url} alt="Before" />
                                                </PhotoItem>
                                            ))}
                                        </PhotoGridMini>
                                        {attachments.length === 0 && <EmptyImage><i className="fas fa-image"></i> 写真なし</EmptyImage>}

                                        {/* After 写真があれば表示 */}
                                        {attachmentsAfter.length > 0 && (
                                            <>
                                                <LabelSmall style={{ marginTop: '24px' }}>作業後 (After) ({attachmentsAfter.length})</LabelSmall>
                                                <PhotoGridMini>
                                                    {attachmentsAfter.map((img, i) => (
                                                        <PhotoItem key={i} href={img.url} target="_blank">
                                                            <img src={img.url} alt="After" />
                                                        </PhotoItem>
                                                    ))}
                                                </PhotoGridMini>
                                            </>
                                        )}
                                    </ImagePanel>
                                </StoreGrid>
                            </StoreCard>
                        );
                    })
                ) : (
                    <EmptyCard>
                        <i className="fas fa-exclamation-triangle"></i>
                        <p>詳細な店舗データがありません。全体保存のみ、あるいは詳細の「完了チェック」が行われなかった可能性があります。</p>
                        {/* 救済策：もし payload に何かデータがあれば RAW で出す */}
                        <details style={{ marginTop: 20, textAlign: 'left', width: '100%' }}>
                            <summary style={{ cursor: 'pointer', color: '#64748b' }}>未展開の生データを確認</summary>
                            <pre style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10, overflowX: 'auto' }}>
                                {JSON.stringify(payload, null, 2)}
                            </pre>
                        </details>
                    </EmptyCard>
                )}
            </ContentArea>
        </Container>
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
const SectionTitle = styled.h3` font-size: 16px; font-weight: 800; margin-bottom: 16px; color: #1e293b; i { color: #f59e0b; margin-right: 8px; } `;
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

export default AdminHoukokuDetailPage;
