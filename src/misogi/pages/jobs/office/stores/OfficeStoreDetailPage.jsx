import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

// 既存のAPI呼び出し関数があるなら、そっちに差し替えてOK。
// （例: apiGet("/stores/..") みたいなの）
async function apiGet(path) {
    const base = "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod";
    const token = localStorage.getItem("idToken") || localStorage.getItem("id_token") || "";
    const res = await fetch(`${base}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json();
}

function TabButton({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
                color: "white",
                cursor: "pointer",
            }}
        >
            {children}
        </button>
    );
}

export default function OfficeStoreDetailPage() {
    const { storeId } = useParams();
    const [tab, setTab] = useState("karte");

    const [store, setStore] = useState(null);
    const [brands, setBrands] = useState([]);
    const [clients, setClients] = useState([]);
    const [recentHoukoku, setRecentHoukoku] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [err, setErr] = useState("");

    // マップ化
    const brandMap = useMemo(() => {
        const m = new Map();
        (brands?.items || brands || []).forEach((b) => m.set(b.id, b));
        return m;
    }, [brands]);

    const clientMap = useMemo(() => {
        const m = new Map();
        (clients?.items || clients || []).forEach((c) => m.set(c.id, c));
        return m;
    }, [clients]);

    const brand = store?.brand_id ? brandMap.get(store.brand_id) : null;
    const client = brand?.client_id ? clientMap.get(brand.client_id) : null;

    const title = `${brand?.name || store?.brand_name || "（ブランド不明）"} / ${store?.name || "（店舗不明）"}`;

    useEffect(() => {
        let mounted = true;
        setErr("");

        (async () => {
            try {
                // 1) 店舗
                const s = await apiGet(`/stores/${storeId}`);
                if (!mounted) return;
                setStore(s);

                // 2) マスタ
                const [b, c] = await Promise.all([apiGet(`/brands`), apiGet(`/clients`)]);
                if (!mounted) return;
                setBrands(b);
                setClients(c);

                // 3) houkoku（店別があるならこれがベスト）
                // まだ無い場合は 404/400 になるので、catchして“未対応”表示にする
                try {
                    const hk = await apiGet(`/houkoku?store_id=${encodeURIComponent(storeId)}&limit=5`);
                    if (mounted) setRecentHoukoku(hk.items || hk || []);
                } catch (e) {
                    if (mounted) setRecentHoukoku([]);
                }

                // 4) schedules（store_id filterが無い場合もあるので、同様に未対応扱い）
                try {
                    const today = new Date();
                    const from = today.toISOString().slice(0, 10);
                    const toDate = new Date(today.getTime() + 30 * 86400 * 1000);
                    const to = toDate.toISOString().slice(0, 10);

                    const sc = await apiGet(`/schedules?date_from=${from}&date_to=${to}&store_id=${encodeURIComponent(storeId)}`);
                    if (mounted) setSchedules(sc.items || sc || []);
                } catch (e) {
                    if (mounted) setSchedules([]);
                }
            } catch (e) {
                if (!mounted) return;
                setErr(String(e?.message || e));
            }
        })();

        return () => {
            mounted = false;
        };
    }, [storeId]);

    return (
        <div style={{ padding: 18, color: "white" }}>
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>
                    {client?.name || store?.client_name || ""}{" "}
                    {store?.address1 ? `｜ ${store.address1}${store.address2 || ""}` : ""}
                </div>
                {err ? (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(239,68,68,0.2)" }}>
                        <div style={{ fontWeight: 700 }}>読み込みエラー</div>
                        <div style={{ opacity: 0.9, whiteSpace: "pre-wrap" }}>{err}</div>
                    </div>
                ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>基本情報</TabButton>
                <TabButton active={tab === "karte"} onClick={() => setTab("karte")}>カルテ</TabButton>
                <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")}>スケジュール</TabButton>
                <TabButton active={tab === "history"} onClick={() => setTab("history")}>過去履歴</TabButton>
                <TabButton active={tab === "storage"} onClick={() => setTab("storage")}>ストレージ</TabButton>
                <TabButton active={tab === "announce"} onClick={() => setTab("announce")}>お知らせ</TabButton>
            </div>

            <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", padding: 14 }}>
                {tab === "overview" && (
                    <div>
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>基本情報</div>
                        <pre style={{ whiteSpace: "pre-wrap", opacity: 0.95 }}>{JSON.stringify({ store, brand, client }, null, 2)}</pre>
                    </div>
                )}

                {tab === "karte" && (
                    <div>
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>カルテ</div>

                        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>① 初回問診（仮）</div>
                            <div style={{ opacity: 0.85 }}>※ ここは stores の karte_initial か、UNIVERSAL_WORK_LOGS(Initial) を表示する想定</div>
                        </div>

                        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>② 直近 houkoku（5件）</div>
                            {recentHoukoku?.length ? (
                                <ul style={{ margin: 0, paddingLeft: 18 }}>
                                    {recentHoukoku.map((h) => (
                                        <li key={h.id} style={{ marginBottom: 6 }}>
                                            <span style={{ opacity: 0.9 }}>{h.work_date}</span>{" "}
                                            <span style={{ opacity: 0.9 }}>｜ {h.template_id}</span>{" "}
                                            <span style={{ opacity: 0.7 }}>｜ {h.user_name}</span>
                                            <div style={{ opacity: 0.85 }}>{h?.payload?.overview?.note || ""}</div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div style={{ opacity: 0.8 }}>
                                    （店別houkoku一覧APIが未実装 or まだデータがありません）
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === "schedule" && (
                    <div>
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>スケジュール（直近30日）</div>
                        {schedules?.length ? (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {schedules.slice(0, 10).map((s) => (
                                    <li key={s.id} style={{ marginBottom: 6 }}>
                                        <span style={{ opacity: 0.9 }}>{s.start_at || s.date || ""}</span>
                                        <span style={{ opacity: 0.85 }}> ｜ {s.title || s.service_name || "予定"}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div style={{ opacity: 0.8 }}>
                                （store_idで絞る /schedules APIが未対応なら、後で追加します）
                            </div>
                        )}
                    </div>
                )}

                {tab === "history" && (
                    <div>
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>過去履歴（次フェーズ）</div>
                        <div style={{ opacity: 0.85 }}>
                            ここは UNIVERSAL_WORK_LOGS + houkoku + files を時系列で統合して表示します。
                        </div>
                    </div>
                )}

                {tab === "storage" && (
                    <div>
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>ストレージ（次フェーズ）</div>
                        <div style={{ opacity: 0.85 }}>写真/PDFの一覧（store_idで紐付け）を表示します。</div>
                    </div>
                )}

                {tab === "announce" && (
                    <div>
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>お知らせ（次フェーズ）</div>
                        <div style={{ opacity: 0.85 }}>
                            店舗向けのお知らせCRUD。将来の「顧客閲覧用ページ」への転用の核になります。
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
