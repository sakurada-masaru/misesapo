// ①〜㉞（確定フロー）
export const BASE_STEPS = [
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

export const ROLES = [
    { key: "worker", label: "業務委託者（清掃員）" },
    { key: "op", label: "OP（オペレーター）" },
    { key: "admin", label: "事務/管理" },
    { key: "sales", label: "営業" },
    { key: "accounting", label: "経理" },
    { key: "owner", label: "経営（社長/統括）" },
];

export const ISSUES = [
    { key: "ok", label: "問題なし" },
    { key: "weather", label: "悪天候（雪・台風・路面悪化）" },
    { key: "staff", label: "人員不足（確保できない/欠勤）" },
    { key: "entry", label: "入れない（鍵・入室不可）" },
    { key: "late", label: "遅延（到着遅れ・押しそう）" },
    { key: "complaint", label: "クレーム/再清掃" },
    { key: "payment", label: "未入金/入金遅延" },
];

// ロールごとの工程表示制限（まずは現実的な範囲）
export const ROLE_ALLOWED_STEPS = {
    worker: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    op: [11, 12, 13, 14, 15, 16, 17, 18, 23, 24, 26, 27, 28],
    admin: [10, 11, 12, 13, 14, 15, 23, 24, 25, 26, 27, 28, 29, 30],
    sales: [1, 2, 3, 4, 5, 6, 7, 8, 9, 26, 27, 28, 33, 34],
    accounting: [29, 30, 31, 32],
    owner: BASE_STEPS.map(s => s.id),
};

export const ROLE_ALLOWED_ISSUES = {
    worker: ["ok", "weather", "entry", "late"],
    op: ["ok", "weather", "staff", "entry", "late", "complaint"],
    admin: ["ok", "weather", "staff", "complaint", "payment"],
    sales: ["ok", "complaint"],
    accounting: ["ok", "payment"],
    owner: ["ok", "weather", "staff", "entry", "late", "complaint", "payment"],
};

/**
 * ルール辞書：判断はしない。
 * 「確認項目」「連絡先」「推奨行動」「次工程」を提示するだけ。
 * ※困る頻度が高い所から埋める（増やしやすい形）
 */
export const FLOW_RULES = {
    16: {
        weather: {
            code: "W1",
            title: "悪天候：安全確認と停止報告",
            actions: [
                "路面/天候/交通状況を確認",
                "安全確保が難しい場合『業務続行不可能』としてOPへ報告",
                "顧客連絡はOPが実施（現場は直接調整しない）",
            ],
            nextStep: 11,
        },
        staff: {
            code: "S1",
            title: "人員不足：再手配の確認",
            actions: [
                "OPへ報告",
                "代替要員の再アサイン可否を確認",
                "必要ならスケジュール再調整へ",
            ],
            nextStep: 13,
        },
        entry: {
            code: "E1",
            title: "入室条件：事前確認",
            actions: [
                "鍵/入室方法/担当連絡先を確認",
                "未確定ならOPへ報告（顧客連絡はOP）",
            ],
            nextStep: 17,
        },
        late: {
            code: "L1",
            title: "遅延：影響確認と報告",
            actions: [
                "到着見込みを算出",
                "OPへ報告（顧客連絡はOP）",
                "開店準備等に食い込む可能性を確認",
            ],
            nextStep: 18,
        },
        ok: { code: "OK", title: "通常進行", actions: ["次工程へ進行"], nextStep: 17 },
    },

    17: {
        weather: {
            code: "W1",
            title: "悪天候：実行不可なら停止",
            actions: ["安全確保が難しい場合は停止", "OPへ報告", "延期→スケジュール再調整"],
            nextStep: 11,
        },
        entry: {
            code: "E2",
            title: "入室条件が未確定",
            actions: ["入室条件を確定", "未確定ならOPへ報告（顧客連絡はOP）"],
            nextStep: 16,
        },
        ok: { code: "OK", title: "通常進行", actions: ["次工程へ進行"], nextStep: 18 },
    },

    18: {
        weather: {
            code: "W1",
            title: "現場入前：危険なら停止",
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
            title: "顧客確認NG：再清掃ルート",
            actions: ["OPへ報告（顧客対応一本化）", "是正範囲確定", "再清掃なら⑰→⑱→⑲…へ戻す"],
            nextStep: 17,
        },
        ok: { code: "OK", title: "通常進行", actions: ["了承・サインへ進行"], nextStep: 28 },
    },

    31: {
        payment: {
            code: "P1",
            title: "未入金：催告ルート",
            actions: ["催告", "再請求", "必要なら停止判断（社内規定に従う）"],
            nextStep: 30,
        },
        ok: { code: "OK", title: "通常進行", actions: ["案件クローズへ"], nextStep: 32 },
    },
};
