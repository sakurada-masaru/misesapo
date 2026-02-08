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
    { key: "contact", label: "連絡不通（顧客/鍵担当）" },
    { key: "material", label: "資材・機材トラブル" },
    { key: "incident", label: "事故・破損・怪我" },
    { key: "complaint", label: "クレーム/再清掃" },
    { key: "payment", label: "未入金/入金遅延" },
    { key: "system", label: "システム障害" },
    { key: "no_show", label: "無断欠勤・ドタキャン" },
];

// ロールごとの初期工程（デフォルト）
export const DEFAULT_STEP_BY_ROLE = {
    worker: 16,
    sales: 6,
    op: 11,
    admin: 23,
    accounting: 29,
    owner: 16,
    // 該当なしの場合は16
    default: 16,
};

// 連絡・責任ルール（全体方針）
export const CONTACT_RULE = {
    decision: "onsite", // 判断主体：現場
    primary: "sales",   // 顧客窓口：営業
    secondary: "op",    // 調整主体：OP
    fallback: "onsite", // 例外対応：現場（深夜等）
    owner_cc: true,     // 管理者閲覧：常にログ共有
    op_scope: "reschedule_only",          // OPはリスケ協議のみ
    op_business_hours: "weekday_09_00",   // OP対応は平日09:00以降
};

// ロールごとの工程表示制限
export const ROLE_ALLOWED_STEPS = {
    // worker: 自工程(13-22) + 後工程の閲覧(23-28) ※「自分の仕事の後」を見せるため
    worker: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
    op: [11, 12, 13, 14, 15, 16, 17, 18, 23, 24, 26, 27, 28],
    admin: [10, 11, 12, 13, 14, 15, 23, 24, 25, 26, 27, 28, 29, 30],
    sales: [1, 2, 3, 4, 5, 6, 7, 8, 9, 26, 27, 28, 33, 34],
    accounting: [29, 30, 31, 32],
    owner: BASE_STEPS.map(s => s.id),
};

export const ROLE_ALLOWED_ISSUES = {
    worker: ["ok", "weather", "entry", "late", "contact", "material", "incident", "system"],
    op: ["ok", "weather", "staff", "entry", "late", "contact", "material", "incident", "complaint", "system", "no_show"],
    admin: ["ok", "weather", "staff", "complaint", "payment", "incident", "system"],
    sales: ["ok", "complaint", "contact"],
    accounting: ["ok", "payment"],
    owner: ISSUES.map(i => i.key),
};

/**
 * ルール辞書
 * owner: 責任の所在 -> "営業（調整:OP）" 等に統一
 * customer_contact: 顧客連絡担当
 * on_site_action: 現場での立ち振る舞い
 * messageKey: メッセージテンプレートのキー
 */
const BASE_FLOW_RULES = {
    16: {
        weather: {
            code: "W1",
            messageKey: "weather",
            title: "悪天候：安全確認と停止報告",
            owner: "営業/OP",
            customer_contact: "原則営業（深夜は現場）",
            on_site_action: "安全優先・判断",
            actions: [
                "現場入りの前に営業担当、OPとお客様情報の共有を行なってください。",
                "路面/天候状況を確認",
                "業務続行不可能か判断",
                "営業へ報告（調整:OP）",
            ],
            nextStep: 11,
        },
        staff: {
            code: "S1",
            messageKey: "staff",
            title: "人員不足：再手配の確認",
            owner: "OP",
            customer_contact: "原則営業（深夜は現場）",
            on_site_action: "待機・指示待ち",
            actions: [
                "現場入りの前に営業担当、OPとお客様情報の共有を行なってください。",
                "OPへ状況報告",
                "作業継続の可否判断を待つ",
            ],
            nextStep: 13,
        },
        contact: {
            code: "C1",
            messageKey: "contact",
            title: "連絡不通：リスケ検討",
            owner: "営業/OP",
            customer_contact: "営業（調整:OP）",
            on_site_action: "報告後、待機解除",
            actions: [
                "現場入りの前に営業担当、OPとお客様情報の共有を行なってください。",
                "何度か連絡",
                "不在報告",
                "リスケジュール調整へ",
            ],
            nextStep: 11,
        },
        entry: {
            code: "E1",
            messageKey: "entry",
            title: "入室条件：事前確認",
            owner: "現場→営業",
            customer_contact: "原則営業",
            on_site_action: "情報確認",
            actions: [
                "現場入りの前に営業担当、OPとお客様情報の共有を行なってください。",
                "鍵/入室方法の再確認",
                "不明点を営業・OPへ報告",
            ],
            nextStep: 17,
        },
        late: {
            code: "L1",
            messageKey: "late",
            title: "遅延：影響確認と報告",
            owner: "現場→営業",
            customer_contact: "原則営業（深夜は現場）",
            on_site_action: "急ぎ・安全優先",
            actions: [
                "現場入りの前に営業担当、OPとお客様情報の共有を行なってください。",
                "到着見込み報告",
                "営業経由で顧客へ連絡",
            ],
            nextStep: 18,
        },
        system: {
            code: "SYS1",
            messageKey: "system",
            title: "システム障害",
            owner: "管理",
            customer_contact: "なし",
            on_site_action: "代替手段（LINE等）",
            actions: [
                "現場入りの前に営業担当、OPとお客様情報の共有を行なってください。",
                "LINE等で報告",
            ],
            nextStep: 17,
        },
        ok: {
            code: "OK",
            messageKey: "default",
            title: "通常進行",
            owner: "現場",
            customer_contact: "なし",
            on_site_action: "実施",
            actions: [
                "現場入りの前に営業担当、OPとお客様情報の共有を行なってください。",
                "次工程へ進行",
            ],
            nextStep: 17
        },
    },

    17: {
        weather: {
            code: "W1",
            messageKey: "weather",
            title: "悪天候：実行不可なら停止",
            owner: "営業/OP",
            customer_contact: "原則営業",
            on_site_action: "安全確保",
            actions: ["継続不可なら報告", "営業判断で中止"],
            nextStep: 11,
        },
        entry: {
            code: "E2",
            messageKey: "entry",
            title: "入室条件が未確定",
            owner: "営業/OP",
            customer_contact: "原則営業",
            on_site_action: "待機",
            actions: ["営業へ確認依頼", "待機指示に従う"],
            nextStep: 16,
        },
        contact: {
            code: "C1",
            messageKey: "contact",
            title: "詳細確認時の連絡不通",
            owner: "営業/OP",
            customer_contact: "営業",
            on_site_action: "待機解除",
            actions: ["報告", "リスケ可否確認"],
            nextStep: 16,
        },
        ok: {
            code: "OK",
            messageKey: "default",
            title: "通常進行",
            owner: "現場",
            customer_contact: "なし",
            on_site_action: "実施",
            actions: ["次工程へ進行"],
            nextStep: 18
        },
    },

    18: {
        weather: {
            code: "W1",
            messageKey: "weather",
            title: "現場入前：危険なら停止",
            owner: "管理/営業",
            customer_contact: "原則営業",
            on_site_action: "非侵入・安全確保",
            actions: ["現場判断で危険なら中止", "即時報告"],
            nextStep: 11,
        },
        entry: {
            code: "E3",
            messageKey: "entry",
            title: "現場で入れない",
            owner: "営業/OP",
            customer_contact: "原則営業（深夜は現場一次対応）",
            on_site_action: "現場待機（15分目安）",
            actions: ["即時報告", "営業からの折り返し待ち"],
            nextStep: 11,
        },
        late: {
            code: "L1",
            messageKey: "late",
            title: "現場入の遅延",
            owner: "現場",
            customer_contact: "原則営業（深夜は現場）",
            on_site_action: "迅速開始",
            actions: ["報告", "作業時間確保の確認"],
            nextStep: 19,
        },
        incident: {
            code: "INC1",
            messageKey: "incident",
            title: "事故・破損・怪我発生",
            owner: "現場→営業→管理",
            customer_contact: "営業/管理",
            on_site_action: "安全確保・現場保全",
            actions: [
                "怪我人の救護",
                "現場保全（写真）",
                "即時報告（営業・管理）",
                "勝手な約束はしない"
            ],
            nextStep: 11,
        },
        ok: {
            code: "OK",
            messageKey: "default",
            title: "通常進行",
            owner: "現場",
            customer_contact: "なし",
            on_site_action: "実施",
            actions: ["次工程へ進行"],
            nextStep: 19
        },
    },

    19: {
        material: {
            code: "MAT1",
            messageKey: "material",
            title: "資材不足・機材不良",
            owner: "現場→OP",
            customer_contact: "原則営業",
            on_site_action: "判断（継続/部分/中断）",
            actions: [
                "現状撮影",
                "報告",
                "代替案の相談",
            ],
            nextStep: 20,
        },
        incident: {
            code: "INC1",
            messageKey: "incident",
            title: "作業中の事故・破損",
            owner: "現場→営業→管理",
            customer_contact: "営業/管理",
            on_site_action: "現場保全・中断",
            actions: [
                "作業中断",
                "救護",
                "撮影",
                "即時報告",
            ],
            nextStep: 20,
        },
        ok: {
            code: "OK",
            messageKey: "default",
            title: "通常進行",
            owner: "現場",
            customer_contact: "なし",
            on_site_action: "実施",
            actions: ["作業実施"],
            nextStep: 20
        },
    },

    27: {
        complaint: {
            code: "R1",
            messageKey: "complaint",
            title: "顧客確認NG：再清掃ルート",
            owner: "営業/OP",
            customer_contact: "原則営業",
            on_site_action: "謝罪・待機",
            actions: ["報告（対応一本化）", "是正指示待ち"],
            nextStep: 17,
        },
        ok: {
            code: "OK",
            messageKey: "default",
            title: "通常進行",
            owner: "現場",
            customer_contact: "完了報告",
            on_site_action: "引揚準備",
            actions: ["了承・サインへ進行"],
            nextStep: 28
        },
    },

    31: {
        payment: {
            code: "P1",
            messageKey: "payment",
            title: "未入金：催告ルート",
            owner: "経理/管理",
            customer_contact: "営業/経理",
            on_site_action: "なし",
            actions: ["催告", "再請求"],
            nextStep: 30,
        },
        ok: {
            code: "OK",
            messageKey: "default",
            title: "通常進行",
            owner: "管理",
            customer_contact: "なし",
            on_site_action: "なし",
            actions: ["案件クローズへ"],
            nextStep: 32
        },
    },
};

const STEP_NEXT_MAP = BASE_STEPS.reduce((acc, step, idx) => {
    const next = BASE_STEPS[idx + 1]?.id ?? 1;
    acc[step.id] = next;
    return acc;
}, {});

const ISSUE_DEFAULTS = {
    ok: {
        code: "OK",
        messageKey: "default",
        title: "通常進行",
        owner: "現場",
        customer_contact: "なし",
        on_site_action: "次工程へ進行",
    },
    weather: {
        code: "W1",
        messageKey: "weather",
        title: "悪天候：安全最優先",
        owner: "現場→営業（調整:OP）",
        customer_contact: "原則営業（深夜は現場一次対応）",
        on_site_action: "安全確認・続行不可なら停止報告",
    },
    staff: {
        code: "S1",
        messageKey: "staff",
        title: "人員不足：再手配確認",
        owner: "OP（調整）",
        customer_contact: "原則営業（深夜は現場一次対応）",
        on_site_action: "無理な続行をせず報告",
    },
    entry: {
        code: "E1",
        messageKey: "entry",
        title: "入室不可：条件再確認",
        owner: "現場→営業（調整:OP）",
        customer_contact: "原則営業（深夜は現場一次対応）",
        on_site_action: "鍵/入室条件確認・待機判断",
    },
    late: {
        code: "L1",
        messageKey: "late",
        title: "遅延：影響確認",
        owner: "現場→営業（調整:OP）",
        customer_contact: "原則営業（深夜は現場一次対応）",
        on_site_action: "到着見込みを共有",
    },
    contact: {
        code: "C1",
        messageKey: "contact",
        title: "連絡不通：待機/再調整",
        owner: "営業（調整:OP）",
        customer_contact: "営業",
        on_site_action: "再連絡を試行し報告",
    },
    material: {
        code: "MAT1",
        messageKey: "material",
        title: "資材・機材トラブル",
        owner: "現場→OP",
        customer_contact: "品質影響時は営業",
        on_site_action: "継続/部分実施/中断の一次判断",
    },
    incident: {
        code: "INC1",
        messageKey: "incident",
        title: "事故・破損・怪我",
        owner: "現場→営業→管理",
        customer_contact: "営業/管理",
        on_site_action: "救護・現場保全・即時報告",
    },
    complaint: {
        code: "R1",
        messageKey: "complaint",
        title: "クレーム/再清掃",
        owner: "営業（調整:OP）",
        customer_contact: "営業",
        on_site_action: "事実整理・一本化報告",
    },
    payment: {
        code: "P1",
        messageKey: "payment",
        title: "未入金/入金遅延",
        owner: "経理/管理（営業連携）",
        customer_contact: "営業/経理",
        on_site_action: "現場での金銭交渉は行わない",
    },
    system: {
        code: "SYS1",
        messageKey: "system",
        title: "システム障害",
        owner: "管理",
        customer_contact: "必要時は営業",
        on_site_action: "代替手段で報告継続",
    },
    no_show: {
        code: "NS1",
        messageKey: "no_show",
        title: "無断欠勤・ドタキャン",
        owner: "OP（調整）/営業（顧客連絡）",
        customer_contact: "営業",
        on_site_action: "即時報告・代替判断待ち",
    },
};

function getFallbackNextStep(stepId, issueKey) {
    if (issueKey === "ok") return STEP_NEXT_MAP[stepId] ?? 1;

    if (issueKey === "payment") {
        if (stepId >= 31) return 30;
        return 29;
    }

    if (issueKey === "complaint") {
        if (stepId >= 27) return 17;
        return STEP_NEXT_MAP[stepId] ?? 1;
    }

    if (issueKey === "weather") {
        if (stepId >= 16 && stepId <= 18) return 11;
        return STEP_NEXT_MAP[stepId] ?? 1;
    }

    if (issueKey === "staff" || issueKey === "no_show") return 13;
    if (issueKey === "entry") return stepId >= 18 ? 11 : 17;
    if (issueKey === "contact") return stepId >= 16 && stepId <= 18 ? 11 : STEP_NEXT_MAP[stepId] ?? 1;
    if (issueKey === "material") return stepId >= 19 ? 20 : STEP_NEXT_MAP[stepId] ?? 1;
    if (issueKey === "incident") return 11;
    if (issueKey === "system") return STEP_NEXT_MAP[stepId] ?? 1;
    if (issueKey === "late") return STEP_NEXT_MAP[stepId] ?? 1;

    return STEP_NEXT_MAP[stepId] ?? 1;
}

function buildFallbackRule(stepId, issueKey) {
    const def = ISSUE_DEFAULTS[issueKey] || ISSUE_DEFAULTS.ok;
    const nextStep = getFallbackNextStep(stepId, issueKey);
    return {
        ...def,
        actions: [
            "状況を確認して共有",
            "顧客窓口（営業）へ報告し、深夜帯は一次対応のみ実施",
            "OP調整は平日09:00以降にリスケ協議として実施",
            "次工程または再調整へ進行",
        ],
        nextStep,
    };
}

function buildCompleteFlowRules(baseRules) {
    const completed = {};
    const stepIds = BASE_STEPS.map((s) => s.id);

    for (const stepId of stepIds) {
        completed[stepId] = { ...(baseRules[stepId] || {}) };
        for (const issue of ISSUES) {
            if (!completed[stepId][issue.key]) {
                completed[stepId][issue.key] = buildFallbackRule(stepId, issue.key);
            }
        }
    }
    return completed;
}

export const FLOW_RULES = buildCompleteFlowRules(BASE_FLOW_RULES);
