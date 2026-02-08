import React, { useEffect, useMemo, useState } from "react";
import FlowBar from "./FlowBar.jsx";
import {
    BASE_STEPS,
    ROLES,
    ISSUES,
    ROLE_ALLOWED_STEPS,
    ROLE_ALLOWED_ISSUES,
    FLOW_RULES,
} from "./flowData.js";

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

export default function FlowGuideDrawer({
    open,
    onClose,
    defaultRoleKey = null,
    defaultStepId = 16,
    defaultIssueKey = null,
}) {
    const [roleKey, setRoleKey] = useState(defaultRoleKey);
    const [stepId, setStepId] = useState(defaultStepId);
    const [issueKey, setIssueKey] = useState(defaultIssueKey);

    // 開く度に初期値反映（ホットバーからの呼び出しに強い）
    useEffect(() => {
        if (!open) return;
        setRoleKey(defaultRoleKey);
        setStepId(defaultStepId);
        setIssueKey(defaultIssueKey);
    }, [open, defaultRoleKey, defaultStepId, defaultIssueKey]);

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

    // 工程がロール範囲外なら補正
    useEffect(() => {
        if (!roleKey) return;
        if (!allowedStepIds.includes(Number(stepId))) {
            const first = allowedStepIds[0] ?? null;
            setStepId(first);
            setIssueKey(null);
        }
    }, [roleKey, allowedStepIds, stepId]);

    const step = useMemo(() => BASE_STEPS.find((s) => s.id === Number(stepId)) ?? null, [stepId]);

    const rule = useMemo(() => {
        if (!stepId || !issueKey) return null;
        return FLOW_RULES[Number(stepId)]?.[issueKey] ?? null;
    }, [stepId, issueKey]);

    const nextStepId = rule?.nextStep ?? null;

    if (!open) return null;

    return (
        <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 9999 }}
            onClick={onClose}
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    height: "100%",
                    width: "min(720px, 96vw)",
                    background: "#fff",
                    borderLeft: "1px solid #e5e7eb",
                    padding: 14,
                    overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>業務フローガイド</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                            判断はしません。必要な確認項目と推奨行動を提示します。
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                    >
                        閉じる
                    </button>
                </div>

                {/* visualizer */}
                <div style={{ marginTop: 12 }}>
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

                {/* STEP1 */}
                <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" }}>
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
                <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>STEP2：該当項目を選択</div>

                    {!roleKey ? (
                        <div style={{ color: "#374151" }}>立場を選択してください。</div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>工程（ロールに応じて制限）</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {stepsForRole.map((s) => (
                                        <Chip key={s.id} active={s.id === Number(stepId)} onClick={() => { setStepId(s.id); setIssueKey(null); }}>
                                            {String(s.id).padStart(2, "0")}. {s.label}
                                        </Chip>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>状況（ロールに応じて制限）</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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

                {/* STEP3 AI風 */}
                <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb" }}>
                    {!roleKey ? (
                        <div style={{ color: "#374151" }}>🤖 まず立場を選択してください。</div>
                    ) : !stepId || !issueKey ? (
                        <div style={{ color: "#374151" }}>🤖 工程と状況を選ぶと、確認項目と推奨行動を表示します。</div>
                    ) : !rule ? (
                        <div style={{ color: "#374151" }}>
                            🤖 その組み合わせのルールは未登録です。OP/管理に確認してください（後でルール追加）。
                        </div>
                    ) : (
                        <div style={{ color: "#111827", lineHeight: 1.65 }}>
                            <div style={{ fontWeight: 900 }}>🤖 {ROLES.find(r => r.key === roleKey)?.label}向け</div>
                            <div style={{ marginTop: 6 }}>
                                現在は <b>{String(step.id).padStart(2, "0")}. {step.label}</b> です。
                            </div>
                            <div style={{ marginTop: 8, display: "inline-block", padding: "2px 8px", borderRadius: 999, background: "#fff", border: "1px solid #e5e7eb", fontSize: 12 }}>
                                {rule.code}
                            </div>
                            <div style={{ marginTop: 8, fontWeight: 900 }}>{rule.title}</div>
                            <ol style={{ marginTop: 8, paddingLeft: 18 }}>
                                {rule.actions.map((a, idx) => <li key={idx} style={{ marginBottom: 4 }}>{a}</li>)}
                            </ol>
                            <div style={{ marginTop: 10 }}>
                                次工程： <b>{rule.nextStep ? `${String(rule.nextStep).padStart(2, "0")}. ${BASE_STEPS.find(s => s.id === rule.nextStep)?.label ?? ""}` : "—"}</b>
                            </div>

                            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                                <button
                                    onClick={() => {
                                        if (!rule.nextStep) return;
                                        setStepId(rule.nextStep);
                                        setIssueKey("ok");
                                    }}
                                    disabled={!rule.nextStep}
                                    style={{
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: "1px solid #e5e7eb",
                                        background: rule.nextStep ? "#111827" : "#f3f4f6",
                                        color: rule.nextStep ? "#fff" : "#9ca3af",
                                        cursor: rule.nextStep ? "pointer" : "not-allowed",
                                    }}
                                >
                                    次工程へ進む
                                </button>

                                <button
                                    onClick={() => {
                                        // 将来：/houkoku 起票 or OP通知に接続
                                        const payload = {
                                            role: roleKey,
                                            stepId,
                                            issueKey,
                                            rule,
                                            at: new Date().toISOString(),
                                        };
                                        alert(`（将来ログ/報告）\n${JSON.stringify(payload, null, 2)}`);
                                    }}
                                    style={{
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: "1px solid #e5e7eb",
                                        background: "#fff",
                                        cursor: "pointer",
                                    }}
                                >
                                    OPへ報告（将来）
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* footer */}
                <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
                    ※ ルール追加は flowData.js の FLOW_RULES に追記してください（運用しながら増やす前提）。
                </div>
            </div>
        </div>
    );
}
