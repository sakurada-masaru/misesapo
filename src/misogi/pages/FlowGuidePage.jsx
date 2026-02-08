import React, { useMemo, useState } from "react";

/**
 * 業務フローガイド（ロール制限版）
 * STEP1: ロール選択（立場）
 * STEP2: ロールに応じて「工程」と「状況」選択肢を制限
 * STEP3: ルールに沿って推奨行動と次工程を提示（判断はしない）
 */

// ========== ①〜㉞（確定フロー） ==========
const BASE_STEPS = [
    { id: 1, label: "問い合わせ・アポ獲得" },
    { id: 2, label: "初期ヒアリング" },
    { id: 3, label: "見込み顧客登録" },
    { id: 4, label: "現地調査" },
    { id: 5, label: "見積作成" },
    { id: 6, label: "見積提示" },
    { id: 7, label: "条件調整" },
    { id: 8, label: "申込・規約同意" },
    { id: 9, label: "契約締結" },
    { id: 10, label: "顧客・案件DB登録" },
    { id: 11, label: "スケジュール作成" },
    { id: 12, label: "作業指示作成" },
    { id: 13, label: "清掃員アサイン" },
    { id: 14, label: "案件共有" },
    { id: 15, label: "受領確認" },
    { id: 16, label: "事前連絡（顧客・現場）" },
    { id: 17, label: "案件詳細確認（場所・鍵・注意事項）" },
    { id: 18, label: "現場入" },
    { id: 19, label: "清掃作業" },
    { id: 20, label: "作業記録（写真・メモ）" },
    { id: 21, label: "業務報告作成" },
    { id: 22, label: "業務報告提出" },
    { id: 23, label: "内容確認" },
    { id: 24, label: "差戻／承認" },
    { id: 25, label: "完了確定" },
    { id: 26, label: "作業報告送付" },
    { id: 27, label: "顧客確認" },
    { id: 28, label: "完了了承・サイン" },
    { id: 29, label: "請求書発行" },
    { id: 30, label: "請求送付" },
    { id: 31, label: "入金確認" },
    { id: 32, label: "案件クローズ" },
    { id: 33, label: "次回提案" },
    { id: 34, label: "次回お約束（→①へ循環）" },
];

// ========== 立場（ロール） ==========
const ROLES = [
    { key: "worker", label: "業務委託者（清掃員）" },
    { key: "op", label: "OP（オペレーター）" },
    { key: "admin", label: "事務/管理" },
    { key: "sales", label: "営業" },
    { key: "accounting", label: "経理" },
    { key: "owner", label: "経営（社長/統括）" },
];

// ========== 困りごと（状況） ==========
const ISSUES = [
    { key: "ok", label: "問題なし（通常進行）" },
    { key: "weather", label: "悪天候（雪・台風・路面悪化）" },
    { key: "staff", label: "人員不足（確保できない/欠勤）" },
    { key: "entry", label: "入れない（鍵・入室不可）" },
    { key: "late", label: "遅延（到着遅れ・押しそう）" },
    { key: "complaint", label: "クレーム・やり直し（再清掃）" },
    { key: "payment", label: "未入金・入金遅延" },
];

// ========== ロールごとの「工程」制限 ==========
/**
 * ここが最重要：
 * “業務内容によって工程表示を制限” を担う。
 * まずは現実的な範囲で絞ってある（運用しながら増減OK）
 */
const ROLE_ALLOWED_STEPS = {
    // 清掃員：手配後〜現場〜報告が中心
    worker: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    // OP：手配〜当日判断〜顧客連絡〜再調整の中心
    op: [11, 12, 13, 14, 15, 16, 17, 18, 23, 24, 26, 27, 28],
    // 事務/管理：登録〜手配〜検収〜顧客〜請求の一部
    admin: [10, 11, 12, 13, 14, 15, 23, 24, 25, 26, 27, 28, 29, 30],
    // 営業：入口〜契約〜顧客確認〜次回提案
    sales: [1, 2, 3, 4, 5, 6, 7, 8, 9, 26, 27, 28, 33, 34],
    // 経理：請求〜入金〜催告
    accounting: [29, 30, 31, 32],
    // 経営：全体俯瞰（必要なら全工程表示にしてOK）
    owner: BASE_STEPS.map((s) => s.id),
};

// ========== ロールごとの「状況」制限 ==========
const ROLE_ALLOWED_ISSUES = {
    worker: ["ok", "weather", "entry", "late"],
    op: ["ok", "weather", "staff", "entry", "late", "complaint"],
    admin: ["ok", "weather", "staff", "complaint", "payment"],
    sales: ["ok", "complaint"],
    accounting: ["ok", "payment"],
    owner: ["ok", "weather", "staff", "entry", "late", "complaint", "payment"],
};

// ========== ルール辞書（推奨行動） ==========
/**
 * 判断はしない。
 * “やるべき確認項目・連絡先・次工程” を提示するだけ。
 */
const FLOW_RULES = {
    16: {
        weather: {
            code: "W1",
            title: "悪天候：出動可否の確認項目提示",
            actions: [
                "路面/天候/交通状況を確認",
                "安全確保が難しい場合は『業務続行不可能』としてOPへ報告",
                "顧客連絡はOPが実施（現場は直接調整しない）",
            ],
            nextStep: 11,
        },
        staff: {
            code: "S1",
            title: "人員不足：再手配の確認項目提示",
            actions: ["OPへ報告", "代替要員の検討", "再アサイン/再調整"],
            nextStep: 13,
        },
        entry: {
            code: "E1",
            title: "入室不可：確認項目提示",
            actions: ["鍵/入室方法/担当者連絡先を確認", "不明ならOPへ報告", "顧客連絡はOP"],
            nextStep: 17,
        },
        late: {
            code: "L1",
            title: "遅延：報告項目提示",
            actions: ["到着見込みを算出", "OPへ報告", "顧客連絡はOP"],
            nextStep: 18,
        },
        ok: { code: "OK", title: "通常進行", actions: ["次工程へ進行"], nextStep: 17 },
    },

    17: {
        weather: {
            code: "W1",
            title: "悪天候：実行不可なら停止判断の材料提示",
            actions: ["安全確保が難しい場合は停止", "OPへ報告", "延期ならスケジュール再調整"],
            nextStep: 11,
        },
        entry: {
            code: "E2",
            title: "入室条件が未確定",
            actions: ["入室条件を確定", "未確定ならOPへ報告", "顧客連絡はOP"],
            nextStep: 16,
        },
        ok: { code: "OK", title: "通常進行", actions: ["次工程へ進行"], nextStep: 18 },
    },

    18: {
        weather: {
            code: "W1",
            title: "現場入前：危険なら停止の材料提示",
            actions: ["危険なら無理に入らない", "OPへ報告", "延期なら再調整"],
            nextStep: 11,
        },
        entry: {
            code: "E3",
            title: "現場で入れない",
            actions: ["現場からOPへ即報告", "顧客連絡はOP", "再調整へ"],
            nextStep: 11,
        },
        late: {
            code: "L1",
            title: "現場入の遅延",
            actions: ["OPへ報告", "顧客連絡はOP", "作業可否（時間確保）を確認"],
            nextStep: 19,
        },
        ok: { code: "OK", title: "通常進行", actions: ["次工程へ進行"], nextStep: 19 },
    },

    27: {
        complaint: {
            code: "R1",
            title: "顧客確認NG：再清掃ルート提示",
            actions: ["OPへ報告", "是正範囲確定", "再清掃なら『⑰→⑱→⑲…』へ戻す"],
            nextStep: 17,
        },
        ok: { code: "OK", title: "通常進行", actions: ["了承・サインへ進行"], nextStep: 28 },
    },

    31: {
        payment: {
            code: "P1",
            title: "未入金：催告ルート提示",
            actions: ["催告", "再請求", "必要なら停止判断（社内規定に従う）"],
            nextStep: 30,
        },
        ok: { code: "OK", title: "通常進行", actions: ["案件クローズへ"], nextStep: 32 },
    },
};

// ========== 軽量UI ==========
function Card({ children }) {
    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
            {children}
        </div>
    );
}

function Select({ label, value, onChange, options, placeholder }) {
    return (
        <label style={{ display: "block" }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
            <select
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value ? e.target.value : null)}
                style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((o) => (
                    <option key={String(o.value)} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export default function FlowGuidePage() {
    // STEP1：ロール
    const [roleKey, setRoleKey] = useState(null);
    // STEP2：工程＋状況
    const [stepId, setStepId] = useState(null);
    const [issueKey, setIssueKey] = useState(null);

    // ロール変更時は下位選択をリセット（重要：矛盾防止）
    const onRoleChange = (rk) => {
        setRoleKey(rk);
        setStepId(null);
        setIssueKey(null);
    };

    const roleOptions = useMemo(() => ROLES.map((r) => ({ value: r.key, label: r.label })), []);

    const allowedSteps = useMemo(() => {
        if (!roleKey) return [];
        const ids = ROLE_ALLOWED_STEPS[roleKey] ?? [];
        const set = new Set(ids);
        return BASE_STEPS.filter((s) => set.has(s.id));
    }, [roleKey]);

    const stepOptions = useMemo(
        () =>
            allowedSteps.map((s) => ({
                value: String(s.id),
                label: `${String(s.id).padStart(2, "0")}. ${s.label}`,
            })),
        [allowedSteps]
    );

    const allowedIssues = useMemo(() => {
        if (!roleKey) return [];
        const keys = ROLE_ALLOWED_ISSUES[roleKey] ?? [];
        const set = new Set(keys);
        return ISSUES.filter((i) => set.has(i.key));
    }, [roleKey]);

    const issueOptions = useMemo(() => allowedIssues.map((i) => ({ value: i.key, label: i.label })), [allowedIssues]);

    const step = useMemo(() => BASE_STEPS.find((s) => s.id === Number(stepId)) ?? null, [stepId]);

    const rule = useMemo(() => {
        if (!stepId || !issueKey) return null;

        const sid = Number(stepId);
        const r = FLOW_RULES[sid]?.[issueKey] ?? null;

        // ルールが無い場合は「判断しない」前提で、確認先を提示する
        if (!r) {
            return {
                code: "INFO",
                title: "該当ルール未登録（確認項目のみ提示）",
                actions: [
                    "工程と状況を再確認",
                    "判断に迷う場合はOP/管理へ相談",
                    "（必要ならルール追加を申請）",
                ],
                nextStep: null,
            };
        }
        return r;
    }, [stepId, issueKey]);

    const nextStepLabel = useMemo(() => {
        if (!rule?.nextStep) return "—";
        const next = BASE_STEPS.find((s) => s.id === rule.nextStep);
        return next ? `${String(next.id).padStart(2, "0")}. ${next.label}` : `次工程: ${rule.nextStep}`;
    }, [rule]);

    const canShowStep2 = !!roleKey;
    const canShowResult = !!roleKey && !!stepId && !!issueKey;

    return (
        <div style={{ padding: 16, maxWidth: 880, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, margin: 0 }}>業務フローガイド</h1>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        判断はしません。必要な確認項目と推奨行動を提示します。
                    </div>
                </div>
                <button
                    onClick={() => {
                        setRoleKey(null);
                        setStepId(null);
                        setIssueKey(null);
                    }}
                    style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        cursor: "pointer",
                    }}
                >
                    リセット
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                {/* STEP1 */}
                <Card>
                    <Select
                        label="STEP1：あなたの立場は？"
                        value={roleKey}
                        onChange={onRoleChange}
                        options={roleOptions}
                        placeholder="立場を選択してください"
                    />
                </Card>

                {/* STEP2 */}
                <Card>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>STEP2：該当項目を選択</div>
                    {!canShowStep2 ? (
                        <div style={{ color: "#374151" }}>まず立場を選択してください。</div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                            <Select
                                label="現在地（工程）"
                                value={stepId}
                                onChange={(v) => {
                                    setStepId(v);
                                    // 工程が変わったら状況もリセット（矛盾防止）
                                    setIssueKey(null);
                                }}
                                options={stepOptions}
                                placeholder="工程を選択してください"
                            />
                            <Select
                                label="状況（困りごと）"
                                value={issueKey}
                                onChange={setIssueKey}
                                options={issueOptions}
                                placeholder="状況を選択してください"
                            />
                        </div>
                    )}
                </Card>

                {/* STEP3 */}
                <Card>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>STEP3：推奨行動</div>
                    {!canShowResult ? (
                        <div style={{ marginTop: 8, color: "#374151" }}>立場・工程・状況を選ぶと表示されます。</div>
                    ) : (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        border: "1px solid #e5e7eb",
                                        background: "#f9fafb",
                                    }}
                                >
                                    {rule.code}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>{rule.title}</div>
                            </div>

                            <div style={{ marginTop: 10, color: "#374151" }}>
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>推奨行動（確認項目）</div>
                                <ol style={{ margin: 0, paddingLeft: 18 }}>
                                    {rule.actions.map((a, idx) => (
                                        <li key={idx} style={{ marginBottom: 4 }}>
                                            {a}
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                                <div style={{ fontWeight: 600 }}>次工程</div>
                                <div style={{ marginTop: 4 }}>{nextStepLabel}</div>
                            </div>

                            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                    onClick={() => {
                                        if (rule?.nextStep) {
                                            setStepId(String(rule.nextStep));
                                            setIssueKey("ok");
                                        }
                                    }}
                                    disabled={!rule?.nextStep}
                                    style={{
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: "1px solid #e5e7eb",
                                        background: rule?.nextStep ? "#111827" : "#f3f4f6",
                                        color: rule?.nextStep ? "#fff" : "#9ca3af",
                                        cursor: rule?.nextStep ? "pointer" : "not-allowed",
                                    }}
                                >
                                    次工程へ進む（現在地を更新）
                                </button>

                                <button
                                    onClick={() => {
                                        const payload = {
                                            role: roleKey,
                                            step: step ? { id: step.id, label: step.label } : null,
                                            issue: issueKey,
                                            rule,
                                            at: new Date().toISOString(),
                                        };
                                        // 将来：houkoku起票 / OP通知 / ログ保存へ接続
                                        alert(`（将来ログ送信）\n${JSON.stringify(payload, null, 2)}`);
                                    }}
                                    disabled={!rule}
                                    style={{
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: "1px solid #e5e7eb",
                                        background: "#fff",
                                        cursor: rule ? "pointer" : "not-allowed",
                                    }}
                                >
                                    OPへ報告（将来機能）
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
