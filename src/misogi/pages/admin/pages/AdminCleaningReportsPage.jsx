import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/api/client';
import { getAuthHeaders } from '../../shared/auth/cognitoStorage';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * 清掃報告 受領一覧 (管理者用)
 * 現場のテキスト情報をWord形式に自動整形して表示・PDF化
 */
export default function AdminCleaningReportsPage() {
    const [date, setDate] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [status, setStatus] = useState(null); // { text, type }

    const printRef = useRef(null);

    // メッセージ表示
    const showStatus = (text, type = 'info') => {
        setStatus({ text, type });
        if (type !== 'error') {
            setTimeout(() => setStatus(null), 3000);
        }
    };

    // 取得ロジック (新・シンプル版)
    const fetchReports = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const auth = getAuthHeaders();
            const token = auth.Authorization ? auth.Authorization.replace('Bearer ', '') : null;

            const headers = {};
            if (token) headers['X-Simple-Auth'] = token;
            console.log('[AdminCleaningReports] Fetching with headers:', Object.keys(headers));

            // 既知のルート /daily-reports を使用して API Gateway の 403 (Route Not Found) を回避
            const list = await apiFetch(`/daily-reports?type=simple_cleaning&date=${date}`, {
                headers: headers
            });
            setReports(Array.isArray(list) ? list : []);
        } catch (e) {
            showStatus('データ取得失敗: ' + e.message, 'error');
            console.error('[AdminCleaningReports] Fetch Error:', e);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchReports(false);
    }, [fetchReports]);

    // テストデータ作成 (新・シンプル版)
    const handleGenerateTest = async () => {
        setGenerating(true);
        showStatus('テストレポートを生成中...', 'info');
        try {
            const storeName = `テスト店舗_${Math.floor(Math.random() * 900 + 100)}`;
            const reportText = "【現場報告テキスト】\n本日は定期清掃を実施しました。\n床面の洗浄を行い、ワックスの塗布を完了しております。\n特に汚れの激しかった入口付近を重点的に清掃しました。\nまた、エアコンフィルターの清掃も合わせて実施済みです。";

            const testData = {
                date: date,
                work_date: date,
                work_minutes: 90,
                target_label: storeName,
                created_by_name: 'テスト作業員A',
                report_text: reportText,
                // description に JSON 形式も残しておく (互換性のため)
                description: JSON.stringify({
                    store: {
                        name: storeName,
                        address: '東京都渋谷区...',
                        note: reportText
                    },
                    services: [
                        { name: '床面洗浄', minutes: 60, memo: '完了' },
                        { name: 'エアコン清掃', minutes: 30, memo: '完了' }
                    ]
                })
            };

            const auth = getAuthHeaders();
            const token = auth.Authorization ? auth.Authorization.replace('Bearer ', '') : null;

            const headers = {};
            if (token) headers['X-Simple-Auth'] = token;

            // 既知のルート /daily-reports を使用
            await apiFetch('/daily-reports?type=simple_cleaning', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(testData)
            });

            showStatus('テスト生成に成功しました', 'success');
            setTimeout(() => fetchReports(true), 800);
        } catch (e) {
            showStatus('生成失敗: ' + e.message, 'error');
            console.error('[AdminCleaningReports] Generation Error:', e);
        } finally {
            setGenerating(false);
        }
    };

    // PDFエクスポート
    const handleExportPdf = async () => {
        if (!printRef.current || !selected) return;
        setExporting(true);
        showStatus('PDFを生成しています...', 'info');
        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`清掃報告書_${selected.target_label}_${selected.work_date}.pdf`);
            showStatus('PDFの保存が完了しました', 'success');
        } catch (e) {
            showStatus('PDF生成失敗', 'error');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="report-page admin-cleaning-page" data-job="admin">
            <div className="report-page-viz">
                <Visualizer mode="base" />
            </div>

            <div className="report-page-main">
                <div className="report-page-header">
                    <h1 className="report-page-title">清掃報告 受領一覧</h1>
                    <Link to="/admin/entrance" style={{ marginTop: '0.5rem', display: 'inline-block', color: 'var(--accent)', textDecoration: 'none' }}>
                        ← 管理エントランスに戻る
                    </Link>
                </div>

                <div className="report-page-body">
                    {/* ステータスメッセージ */}
                    {status && (
                        <div style={{
                            padding: '1rem',
                            marginBottom: '1.5rem',
                            borderRadius: '8px',
                            background: status.type === 'error' ? '#800' : status.type === 'success' ? '#060' : '#444',
                            color: '#fff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span>{status.text}</span>
                            {status.type === 'error' && <button onClick={() => setStatus(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>×</button>}
                        </div>
                    )}

                    {/* 操作エリア */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>作業日</span>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                style={{ padding: '0.6rem', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px' }}
                            />
                        </div>
                        <button className="btn btn-secondary" onClick={() => fetchReports(false)} disabled={loading}>更新</button>
                        <a
                            href="https://misesapo.co.jp/admin/reports/new.html"
                            className="btn btn-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            新規報告作成
                        </a>
                        <button className="btn btn-secondary" onClick={handleGenerateTest} disabled={generating} style={{ opacity: 0.6 }}>
                            {generating ? '生成中...' : 'テストデータ生成'}
                        </button>
                    </div>

                    {/* 一覧リスト */}
                    {loading ? (
                        <p>読込中...</p>
                    ) : reports.length === 0 ? (
                        <p style={{ padding: '3rem', textAlign: 'center', opacity: 0.5, border: '1px dashed #444', borderRadius: '12px' }}>
                            提出された報告はありません。
                        </p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                            {reports.map((it, idx) => (
                                <div
                                    key={it.log_id || idx}
                                    onClick={() => setSelected(it)}
                                    style={{
                                        padding: '1.25rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid #333',
                                        borderRadius: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{it.target_label}</div>
                                    <div style={{ marginTop: '0.8rem', fontSize: '0.9rem', opacity: 0.8 }}>
                                        <div>担当: {it.created_by_name}</div>
                                        <div>時間: {it.work_minutes}分 / {it.work_date}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Wordプレビュー・オーバーレイ */}
            {selected && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(5px)',
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '1rem', background: '#222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>報告書 自動整形プレビュー</h2>
                            <button className="btn btn-primary btn-sm" onClick={handleExportPdf} disabled={exporting}>
                                {exporting ? '生成中...' : 'PDF保存'}
                            </button>
                        </div>
                        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}>×</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 10px', display: 'flex', justifyContent: 'center' }}>
                        <div ref={printRef} style={{ width: 'fit-content' }}>
                            <CleaningReportDocView report={selected} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CleaningReportDocView({ report }) {
    let doc = {};
    const reportText = report.report_text || '';

    try {
        if (report.description && report.description.startsWith('{')) {
            doc = JSON.parse(report.description);
        }
    } catch (e) { }

    // report_text があればそれを使い、なければ description 内の note を使う
    const finalNote = reportText || doc.store?.note || '-';

    return (
        <div style={{
            background: 'white', color: '#000', padding: '60px 80px', width: '210mm', minHeight: '297mm',
            fontFamily: '"MS PMincho", serif', lineHeight: 1.6, fontSize: '11pt'
        }}>
            <div style={{ textAlign: 'right', fontSize: '9pt' }}>No. {report.log_id?.slice(-8).toUpperCase()}</div>
            <h1 style={{ textAlign: 'center', fontSize: '22pt', textDecoration: 'underline', textUnderlineOffset: '8px', marginBottom: '40px' }}>業務報告書</h1>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                <div>
                    <div style={{ borderBottom: '1px solid #000', width: '300px', marginBottom: '8px', paddingBottom: '3px' }}>
                        <span style={{ fontSize: '12pt', fontWeight: 'bold' }}>{report.target_label}　御中</span>
                    </div>
                    <div>作業日: {report.work_date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div>提出日: {report.updated_at?.slice(0, 10)}</div>
                    <div style={{ fontWeight: 'bold', marginTop: '5px' }}>{report.created_by_name || '清掃担当'}</div>
                    <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
                        {[1, 2, 3].map(i => <div key={i} style={{ width: '40px', height: '40px', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ddd' }}>印</div>)}
                    </div>
                </div>
            </div>

            <p style={{ marginBottom: '20px' }}>本日の業務につきまして、下記の通りご報告申し上げます。</p>

            <h3 style={{ borderLeft: '4px solid #000', paddingLeft: '8px', marginBottom: '10px' }}>1. 概要</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                <tr>
                    <th style={{ border: '1px solid #000', background: '#f0f0f0', padding: '10px', width: '25%', textAlign: 'left' }}>作業時間</th>
                    <td style={{ border: '1px solid #000', padding: '10px' }}>{report.work_minutes}分 ({doc.store?.work_start_time || '--:--'} 〜 {doc.store?.work_end_time || '--:--'})</td>
                </tr>
                <tr>
                    <th style={{ border: '1px solid #000', background: '#f0f0f0', padding: '10px', textAlign: 'left' }}>所感・備考</th>
                    <td style={{ border: '1px solid #000', padding: '10px', height: '120px', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{finalNote}</td>
                </tr>
            </table>

            <h3 style={{ borderLeft: '4px solid #000', paddingLeft: '8px', marginBottom: '10px' }}>2. 清掃詳細</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                        <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left' }}>項目</th>
                        <th style={{ border: '1px solid #000', padding: '10px', width: '80px' }}>時間</th>
                        <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left' }}>備考</th>
                    </tr>
                </thead>
                <tbody>
                    {(doc.services || []).map((s, i) => (
                        <tr key={i}>
                            <td style={{ border: '1px solid #000', padding: '10px' }}>{s.name}</td>
                            <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>{s.minutes}</td>
                            <td style={{ border: '1px solid #000', padding: '10px' }}>{s.memo}</td>
                        </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - (doc.services?.length || 0)) }).map((_, i) => (
                        <tr key={i}><td style={{ border: '1px solid #000', height: '35px' }}></td><td style={{ border: '1px solid #000' }}></td><td style={{ border: '1px solid #000' }}></td></tr>
                    ))}
                </tbody>
            </table>

            <h3 style={{ borderLeft: '4px solid #000', paddingLeft: '8px', marginBottom: '10px' }}>3. 写真</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {(doc.attachments || []).map((a, i) => (
                    <div key={i} style={{ border: '1px solid #eee', padding: '10px' }}>
                        <div style={{ background: '#000', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={a.url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '5px', fontSize: '9pt' }}>{a.name}</div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '40px', textAlign: 'right', fontSize: '9pt', color: '#999' }}>-- 以上 --</div>
        </div>
    );
}
