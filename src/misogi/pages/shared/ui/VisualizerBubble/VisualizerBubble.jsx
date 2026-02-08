import React, { useEffect, useMemo, useState } from "react";

function useTypewriter(text, speedMs = 14, enabled = true) {
    const [out, setOut] = useState("");

    useEffect(() => {
        if (!enabled) {
            setOut(text);
            return;
        }
        setOut("");
        let i = 0;
        const t = setInterval(() => {
            i += 1;
            setOut(text.slice(0, i));
            if (i >= text.length) clearInterval(t);
        }, speedMs);
        return () => clearInterval(t);
    }, [text, speedMs, enabled]);

    return out;
}

export default function VisualizerBubble({
    open,
    anchorRect, // {top,left,width,height}
    title = "MISOGI",
    text = "",
    onClose,
    onOpenDetail,
    placement = "bottom", // "bottom" | "left" | "right"
}) {
    const typed = useTypewriter(text, 12, open);

    const bubblePos = useMemo(() => {
        if (!anchorRect) return null;
        const centerX = anchorRect.left + anchorRect.width / 2;
        const centerY = anchorRect.top + anchorRect.height / 2;

        // 吹き出しサイズ（ざっくり固定でOK）
        const w = 420;
        const h = 160;

        if (placement === "bottom") {
            return {
                bubbleLeft: Math.max(12, Math.min(window.innerWidth - w - 12, centerX - w / 2)),
                bubbleTop: Math.min(window.innerHeight - h - 12, centerY + anchorRect.height / 2 + 14),
                tail: { x: centerX, y: anchorRect.top + anchorRect.height + 6, dir: "up" },
            };
        }
        if (placement === "right") {
            return {
                bubbleLeft: Math.min(window.innerWidth - w - 12, anchorRect.left + anchorRect.width + 14),
                bubbleTop: Math.max(12, Math.min(window.innerHeight - h - 12, centerY - h / 2)),
                tail: { x: anchorRect.left + anchorRect.width + 6, y: centerY, dir: "left" },
            };
        }
        // left
        return {
            bubbleLeft: Math.max(12, anchorRect.left - w - 14),
            bubbleTop: Math.max(12, Math.min(window.innerHeight - h - 12, centerY - h / 2)),
            tail: { x: anchorRect.left - 6, y: centerY, dir: "right" },
        };
    }, [anchorRect, placement]);

    if (!open || !anchorRect || !bubblePos) return null;

    const { bubbleLeft, bubbleTop, tail } = bubblePos;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
            {/* クリックで閉じたいなら overlay で受ける（pointerEventsを一部だけ有効にする） */}
            <div
                style={{ position: "fixed", inset: 0, background: "transparent", pointerEvents: "auto" }}
                onClick={onClose}
            />

            {/* bubble */}
            <div
                style={{
                    position: "fixed",
                    left: bubbleLeft,
                    top: bubbleTop,
                    width: 420,
                    borderRadius: 16,
                    border: "1px solid rgba(229,231,235,0.25)",
                    background: "rgba(10,10,10,0.88)",
                    color: "#fff",
                    padding: 12,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(10px)",
                    pointerEvents: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.9 }}>{title}</div>
                    <button
                        onClick={onClose}
                        style={{
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "transparent",
                            color: "#fff",
                            borderRadius: 10,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontSize: 12,
                        }}
                    >
                        閉じる
                    </button>
                </div>

                <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                    <span style={{ opacity: 0.85 }}>● </span>
                    {typed}
                    <span style={{ opacity: 0.5, marginLeft: 4 }}>{typed.length < text.length ? "▍" : ""}</span>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                        onClick={onOpenDetail}
                        style={{
                            border: "none",
                            background: "rgba(255,255,255,0.15)",
                            color: "#fff",
                            borderRadius: 10,
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 800,
                        }}
                    >
                        詳細ガイド（ドロワー）を開く
                    </button>
                </div>

                {/* tail（三角） */}
                <div
                    style={{
                        position: "fixed",
                        left: tail.x,
                        top: tail.y,
                        width: 0,
                        height: 0,
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "none",
                        ...(tail.dir === "up"
                            ? {
                                borderLeft: "10px solid transparent",
                                borderRight: "10px solid transparent",
                                borderBottom: "12px solid rgba(10,10,10,0.88)",
                            }
                            : tail.dir === "left"
                                ? {
                                    borderTop: "10px solid transparent",
                                    borderBottom: "10px solid transparent",
                                    borderRight: "12px solid rgba(10,10,10,0.88)",
                                }
                                : {
                                    borderTop: "10px solid transparent",
                                    borderBottom: "10px solid transparent",
                                    borderLeft: "12px solid rgba(10,10,10,0.88)",
                                }),
                    }}
                />
            </div>
        </div>
    );
}
