import React, { useEffect, useMemo, useRef } from "react";

export default function FlowBar({ steps, currentStepId, nextStepId, onSelectStep }) {
    const containerRef = useRef(null);

    const currentIndex = useMemo(
        () => steps.findIndex((s) => s.id === currentStepId),
        [steps, currentStepId]
    );

    // 現在地が見える位置にスクロール
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const node = el.querySelector(`[data-step="${currentStepId}"]`);
        if (node) node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, [currentStepId]);

    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff" }}>
            <div style={{ padding: 10, borderBottom: "1px solid #e5e7eb", fontWeight: 800 }}>
                フロー（現在地をハイライト）
            </div>

            <div
                ref={containerRef}
                style={{
                    display: "flex",
                    overflowX: "auto",
                    gap: 8,
                    padding: 10,
                    alignItems: "center",
                }}
            >
                {steps.map((s, idx) => {
                    const active = s.id === currentStepId;
                    const next = s.id === nextStepId;
                    const passed = currentIndex !== -1 && idx < currentIndex;

                    return (
                        <button
                            key={s.id}
                            data-step={s.id}
                            onClick={() => onSelectStep?.(s.id)}
                            style={{
                                minWidth: 140,
                                textAlign: "left",
                                padding: "10px 10px",
                                borderRadius: 12,
                                border: "1px solid #e5e7eb",
                                background: active ? "#111827" : next ? "#ecfeff" : "#f9fafb",
                                color: active ? "#fff" : "#111827",
                                cursor: "pointer",
                                opacity: passed ? 0.65 : 1,
                            }}
                            title={`${s.id}. ${s.label}`}
                        >
                            <div style={{ fontSize: 12, fontWeight: 800 }}>
                                {String(s.id).padStart(2, "0")}
                                {next ? " →" : ""}
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.25 }}>{s.label}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
