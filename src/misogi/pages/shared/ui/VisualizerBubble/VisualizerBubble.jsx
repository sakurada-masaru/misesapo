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
    maxHeight = "42vh",
    estimatedHeight = 260,
    closeOnBackdrop = true,
}) {
    const typed = useTypewriter(text, 12, open);

    const bubblePos = useMemo(() => {
        if (!anchorRect) return null;
        const centerX = anchorRect.left + anchorRect.width / 2;
        const centerY = anchorRect.top + anchorRect.height / 2;

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const w = Math.min(560, viewportW - 32);
        const h = estimatedHeight;

        const margin = 12;

        // ビジュアライザーの位置によって上下を切り替え（下にはみ出る場合は上へ）
        let actualPlacement = placement;
        const spaceBelow = viewportH - (centerY + anchorRect.height / 2);
        if (placement === "bottom" && spaceBelow < h + 100) {
            actualPlacement = "top";
        }

        if (actualPlacement === "bottom") {
            const left = (viewportW - w) / 2;
            // 選択肢(EXHotbar)のスペースを確保するため、吹き出しをさらに上に配置
            return {
                bubbleLeft: left,
                bubbleTop: Math.min(centerY + anchorRect.height / 2 + 15, viewportH - h - 450),
                tail: { x: w / 2, y: -10, dir: "up" },
            };
        }
        if (actualPlacement === "top") {
            const left = (viewportW - w) / 2;
            return {
                bubbleLeft: left,
                bubbleTop: Math.max(margin, centerY - anchorRect.height / 2 - h - 300),
                tail: { x: w / 2, y: h + 10, dir: "down" },
            };
        }
        if (actualPlacement === "right") {
            const top = Math.max(margin, Math.min(viewportH - h - 100, centerY - h / 2));
            return {
                bubbleLeft: Math.min(viewportW - w - margin, anchorRect.left + anchorRect.width + 15),
                bubbleTop: top,
                tail: { x: -10, y: centerY - top, dir: "left" },
            };
        }
        // left
        const top = Math.max(margin, Math.min(viewportH - h - 100, centerY - h / 2));
        return {
            bubbleLeft: Math.max(margin, anchorRect.left - w - 15),
            bubbleTop: top,
            tail: { x: w + 10, y: centerY - top, dir: "right" },
        };
    }, [anchorRect, placement, estimatedHeight]);

    if (!open || !anchorRect || !bubblePos) return null;

    const { bubbleLeft, bubbleTop, tail } = bubblePos;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}>
            {closeOnBackdrop && (
                <div
                    style={{ position: "fixed", inset: 0, background: "transparent", pointerEvents: "auto" }}
                    onClick={onClose}
                />
            )}

            {/* bubble */}
            <div
                style={{
                    position: "fixed",
                    left: bubbleLeft,
                    top: bubbleTop,
                    width: "min(560px, calc(100vw - 32px))",
                    maxHeight,
                    borderRadius: 20,
                    border: "1.5px solid var(--accent-color)", // パーソナルカラーを枠線に
                    background: "rgba(18, 18, 20, 0.82)",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    color: "#fff",
                    padding: "18px 22px",
                    // ぼんやり光らせる
                    boxShadow: "0 20px 50px rgba(0,0,0,0.45), 0 0 15px var(--accent-glow)",
                    pointerEvents: "auto",
                    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* tail SVG for perfect glass join */}
                <svg
                    width="24"
                    height="12"
                    viewBox="0 0 24 12"
                    style={{
                        position: "absolute",
                        ...(tail.dir === "up" ? { top: -11, left: tail.x - 12 } :
                            tail.dir === "down" ? { bottom: -11, left: tail.x - 12, transform: "rotate(180deg)" } :
                                tail.dir === "left" ? { left: -14, top: tail.y - 6, transform: "rotate(-90deg)" } :
                                    { right: -14, top: tail.y - 6, transform: "rotate(90deg)" }),
                        pointerEvents: "none",
                    }}
                >
                    <path
                        d="M0 12 L12 0 L24 12"
                        fill="rgba(18, 18, 20, 0.82)"
                        stroke="var(--accent-color)" // しっぽの枠線も合わせる
                        strokeWidth="1.5"
                    />
                </svg>

                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 12,
                        border: "none",
                        background: "transparent",
                        color: "rgba(255,255,255,0.3)",
                        cursor: "pointer",
                        fontSize: 22,
                        lineHeight: 1,
                        padding: 4
                    }}
                >
                    ×
                </button>

                <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", fontWeight: 600, letterSpacing: '0.01em', overflowY: "auto", maxHeight: `calc(${maxHeight} - 72px)`, paddingRight: 4 }}>
                    {typed}
                    <span style={{ color: "var(--accent-color)", marginLeft: 2, display: typed.length < text.length ? "inline" : "none" }}>▍</span>
                </div>

                {onOpenDetail && (
                    <div style={{ marginTop: 14, textAlign: 'right' }}>
                        <button
                            onClick={onOpenDetail}
                            style={{
                                border: "none",
                                background: "rgba(255,255,255,0.08)",
                                color: "rgba(255,255,255,0.6)",
                                borderRadius: 8,
                                padding: "4px 12px",
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 500,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
                        >
                            詳細ドロワーを開く
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
