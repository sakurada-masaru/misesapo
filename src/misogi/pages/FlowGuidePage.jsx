import React, { useMemo, useState } from "react";
import FlowBar from "../flow/FlowBar.jsx";
import {
    BASE_STEPS,
    ROLES,
    ISSUES,
    ROLE_ALLOWED_STEPS,
    ROLE_ALLOWED_ISSUES,
    FLOW_RULES,
} from "../flow/flowData.js";

function Chip({ active, children, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: active ? "#111827" : "#fff",
                color: active ? "#fff" : "#111827",
                cursor: "pointer",
                fontSize: 12,
            }}
        >
            {children}
        </button>
    );
}

export default function FlowGuidePage() {
    const [roleKey, setRoleKey] = useState(null);
    const [stepId, setStepId] = useState(16);
    const [issueKey, setIssueKey] = useState(null);

    // ロール選択に応じて工程/状況を制限
    const allowedStepIds = useMemo(() => (roleKey ? ROLE_ALLOWED_STEPS[roleKey] ?? [] : []), [roleKey]);
    const allowedIssueKeys = useMemo(() => (roleKey ? ROLE_ALLOWED_ISSUES[roleKey] ?? [] : []), [roleKey]);

    const stepsForRole = useMemo(() => {
        const set = new Set(allowedStepIds);
        return BASE_STEPS.filter((s) => set.has(s.id));
    }, [allowedStepIds]);

    const issuesForRole = useMemo(() => {
        const set = new Set(allowedIssueKeys);
        return ISSUES.filter((i) => set.has(i.key));
    }, [allowedIssueKeys]);

    const step = useMemo(() => BASE_STEPS.find((s) => s.id === Number(stepId)) ?? null, [stepId]);

    const rule = useMemo(() => {
        if (!stepId || !issueKey) return null;
        return FLOW_RULES[Number(stepId)]?.[issueKey] ?? null;
    }, [stepId, issueKey]);

    const nextStepId = rule?.nextStep ?? null;

    return (
        <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", background: "#fbfbfb", minHeight: "100vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>業務フローガイド（ドロワー版相当）</h1>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        判断はしません。必要な確認項目と推奨行動を提示します。
                    </div>
                </div>
            </div>

            {/* visualizer */}
            <div style={{ marginBottom: 20 }}>
                <FlowBar
                    steps={stepsForRole.length ? stepsForRole : BASE_STEPS}
                    currentStepId={Number(stepId)}
                    nextStepId={nextStepId}
                    onSelectStep={(id) => {
                        setStepId(id);
                        setIssueKey(null);
                    }}
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 768 ? "1fr 1.5fr" : "1fr", gap: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* STEP1 */}
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff" }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>STEP1：あなたの立場は？</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {ROLES.map((r) => (
                                <Chip
                                    key={r.key}
                                    active={r.key === roleKey}
                                    onClick={() => {
                                        setRoleKey(r.key);
                                        setIssueKey(null);
                                    }}
                                >
                                    {r.label}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    {/* STEP2 */}
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff" }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>STEP2：該当項目を選択</div>

                        {!roleKey ? (
                            <div style={{ color: "#374151" }}>立場を選択してください。</div>
                        ) : (
                            <>
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>工程</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {stepsForRole.map((s) => (
                                            <Chip key={s.id} active={s.id === Number(stepId)} onClick={() => { setStepId(s.id); setIssueKey(null); }}>
                                                {s.id}. {s.label}
                                            </Chip>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>状況</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {issuesForRole.map((i) => (
                                            <Chip key={i.key} active={i.key === issueKey} onClick={() => setIssueKey(i.key)}>
                                                {i.label}
                                            </Chip>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* STEP3 */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, background: "#fff" }}>
                    {!roleKey ? (
                        <div style={{ color: "#374151", textAlign: "center", padding: 40 }}>🤖 まず立場を選択してください。</div>
                    ) : !stepId || !issueKey ? (
                        <div style={{ color: "#374151", textAlign: "center", padding: 40 }}>🤖 工程と状況を選んでください。</div>
                    ) : !rule ? (
                        <div style={{ color: "#374151", textAlign: "center", padding: 40 }}>
                            🤖 ルール未登録です。OPへ確認してください。
                        </div>
                    ) : (
                        <div style={{ color: "#111827", lineHeight: 1.65 }}>
                            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>🤖 MISOGI ガイド</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                                <div style={{ background: "#111827", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                                    {rule.code}
                                </div>
                                <div style={{ fontWeight: 900, fontSize: 18 }}>{rule.title}</div>
                            </div>

                            <div style={{ background: "#f9fafb", padding: 16, borderRadius: 12, marginBottom: 20 }}>
                                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 14 }}>推奨されるアクション</div>
                                <ol style={{ margin: 0, paddingLeft: 20 }}>
                                    {rule.actions.map((a, idx) => <li key={idx} style={{ marginBottom: 6 }}>{a}</li>)}
                                </ol>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #eee" }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#6b7280" }}>次工程</div>
                                    <div style={{ fontWeight: 800 }}>
                                        {rule.nextStep ? `${rule.nextStep}. ${BASE_STEPS.find(s => s.id === rule.nextStep)?.label}` : "—"}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (!rule.nextStep) return;
                                        setStepId(rule.nextStep);
                                        setIssueKey("ok");
                                    }}
                                    disabled={!rule.nextStep}
                                    style={{
                                        padding: "12px 20px",
                                        borderRadius: 12,
                                        border: "none",
                                        background: rule.nextStep ? "#111827" : "#f3f4f6",
                                        color: rule.nextStep ? "#fff" : "#9ca3af",
                                        fontWeight: 800,
                                        cursor: rule.nextStep ? "pointer" : "not-allowed",
                                    }}
                                >
                                    次工程へ進む
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
