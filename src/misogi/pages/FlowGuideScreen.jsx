import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Visualizer from "./shared/ui/Visualizer/Visualizer";
import VisualizerBubble from "./shared/ui/VisualizerBubble/VisualizerBubble";
import EXHotbar from "./shared/ui/Hotbar/EXHotbar";
import Hotbar from "./shared/ui/Hotbar/Hotbar";
import "./flow-guide-screen.css";
import {
    BASE_STEPS,
    ROLES,
    ISSUES,
    ROLE_ALLOWED_STEPS,
    ROLE_ALLOWED_ISSUES,
    FLOW_RULES,
    DEFAULT_STEP_BY_ROLE,
    CONTACT_RULE,
} from "../flow/flowData";
import { buildMessage } from "../flow/messageTemplates";
import { useAuth } from "./shared/auth/useAuth";

export default function FlowGuideScreen() {
    const navigate = useNavigate();
    const { user, authz } = useAuth();
    const userName = user?.name || user?.displayName || user?.username || user?.id || 'ユーザー';

    const normalizeRoleKey = (candidate) => {
        const raw = String(candidate || "").trim().toLowerCase();
        if (!raw) return null;
        const roleMap = {
            worker: "worker",
            staff: "worker",
            cleaning: "worker",
            op: "op",
            operator: "op",
            admin: "admin",
            office: "admin",
            sales: "sales",
            accounting: "accounting",
            finance: "accounting",
            owner: "owner",
            superadmin: "owner",
        };
        return roleMap[raw] || null;
    };

    // ユーザーロールの取得 (フォールバックは worker)
    const userRoleKey = useMemo(() => {
        const fromUser = normalizeRoleKey(user?.group || user?.role || user?.dept || user?.department);
        if (fromUser) return fromUser;
        const fromAuthz = normalizeRoleKey(authz?.dept);
        return fromAuthz || "worker";
    }, [user, authz]);

    const businessTiming = useMemo(() => {
        const now = new Date();
        const day = now.getDay(); // 0:Sun ... 6:Sat
        const hour = now.getHours();
        const isWeekday = day >= 1 && day <= 5;
        const isBeforeBusiness = hour < 9;
        const opAvailableNow = isWeekday && !isBeforeBusiness;
        return {
            isWeekday,
            isBeforeBusiness,
            opAvailableNow,
        };
    }, []);

    const resolvedRole = useMemo(
        () => ROLES.find((r) => r.key === userRoleKey) || null,
        [userRoleKey]
    );
    const isRoleLocked = Boolean(resolvedRole);

    // 会話フェーズ管理
    const [flowStep, setFlowStep] = useState(isRoleLocked ? 'intent' : 'role'); // 'role' | 'intent' | 'stepRange' | 'step' | 'stepBrief' | 'issue' | 'result'
    const [selectedRole, setSelectedRole] = useState(resolvedRole);
    const [currentStepId, setCurrentStepId] = useState(
        DEFAULT_STEP_BY_ROLE[userRoleKey] || DEFAULT_STEP_BY_ROLE.default
    );
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [intentMode, setIntentMode] = useState("current"); // current | change | trouble
    const [selectedStepRange, setSelectedStepRange] = useState(null);

    // ログインロールに追従
    useEffect(() => {
        if (!resolvedRole) {
            setSelectedRole(null);
            setFlowStep('role');
            return;
        }
        setSelectedRole(resolvedRole);
        setCurrentStepId(DEFAULT_STEP_BY_ROLE[resolvedRole.key] || DEFAULT_STEP_BY_ROLE.default);
        setSelectedIssue(null);
        setIntentMode("current");
        setSelectedStepRange(null);
        setFlowStep('intent');
    }, [resolvedRole]);

    // UI管理
    const [anchorRect, setAnchorRect] = useState(null);

    // 初期配置: 画面中央のVisualizerの位置を計算してAnchorにする
    useEffect(() => {
        const update = () => {
            const el = document.getElementById('misogi-flow-viz');
            if (el) setAnchorRect(el.getBoundingClientRect());
        };
        // 少し待ってから取得（レイアウト安定待ち）
        const timer = setTimeout(update, 100);
        window.addEventListener('resize', update);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', update);
        };
    }, []);

    const allowedStepIds = useMemo(() => {
        if (!selectedRole) return [];
        return ROLE_ALLOWED_STEPS[selectedRole.key] || [];
    }, [selectedRole]);

    const allowedSteps = useMemo(() => {
        const set = new Set(allowedStepIds);
        return BASE_STEPS.filter((s) => set.has(s.id));
    }, [allowedStepIds]);

    const getAvailableIssuesForStep = (stepId, roleKey, mode = "current") => {
        const allowed = ROLE_ALLOWED_ISSUES[roleKey] || [];
        const stepRules = FLOW_RULES[stepId] || {};
        return allowed.filter((issueKey) => {
            if (mode === "trouble" && issueKey === "ok") return false;
            return !!stepRules[issueKey];
        });
    };

    const selectableSteps = useMemo(() => {
        if (!selectedRole) return [];
        return allowedSteps.filter((s) => getAvailableIssuesForStep(s.id, selectedRole.key, intentMode).length > 0);
    }, [allowedSteps, selectedRole, intentMode]);

    const stepRanges = useMemo(() => {
        const chunks = [];
        const chunkSize = 4;
        for (let i = 0; i < selectableSteps.length; i += chunkSize) {
            const steps = selectableSteps.slice(i, i + chunkSize);
            if (!steps.length) continue;
            chunks.push({
                key: `${steps[0].id}-${steps[steps.length - 1].id}`,
                startId: steps[0].id,
                endId: steps[steps.length - 1].id,
                steps,
            });
        }
        return chunks;
    }, [selectableSteps]);

    const stepNav = useMemo(() => {
        const ids = selectableSteps.map((s) => s.id).sort((a, b) => a - b);
        const idx = ids.indexOf(currentStepId);
        const prevId = idx > 0 ? ids[idx - 1] : null;
        const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;
        const prev = prevId ? BASE_STEPS.find((s) => s.id === prevId) : null;
        const current = BASE_STEPS.find((s) => s.id === currentStepId) || null;
        const next = nextId ? BASE_STEPS.find((s) => s.id === nextId) : null;
        return { prev, current, next };
    }, [selectableSteps, currentStepId]);

    // 選択肢の生成
    const exOptions = useMemo(() => {
        if (flowStep === "role" && !isRoleLocked) {
            return ROLES.map(r => ({ key: r.key, label: r.label, data: r }));
        }
        if (flowStep === "intent") {
            return [
                { key: "intent_current", label: "現在地で確認する", data: { mode: "current" } },
                { key: "intent_change", label: "工程を選んで確認する", data: { mode: "change" } },
                { key: "intent_trouble", label: "トラブル対応を確認する", data: { mode: "trouble" } },
            ];
        }
        if (flowStep === "stepRange") {
            const rangeOptions = stepRanges.map((r) => {
                const head = BASE_STEPS.find((s) => s.id === r.startId)?.label || "";
                const tail = BASE_STEPS.find((s) => s.id === r.endId)?.label || "";
                const compactHead = compactStepLabel(head);
                const compactTail = compactStepLabel(tail);
                return {
                    key: r.key,
                    label: `${String(r.startId).padStart(2, "0")}〜${String(r.endId).padStart(2, "0")}（${compactHead}〜${compactTail}）`,
                    fullLabel: `${String(r.startId).padStart(2, "0")}〜${String(r.endId).padStart(2, "0")}（${head}〜${tail}）`,
                    data: r,
                };
            });
            return [
                ...rangeOptions,
                { key: "back_to_intent", label: "← 戻る", action: () => setFlowStep("intent") },
            ];
        }
        if (flowStep === "step") {
            const steps = selectedStepRange?.steps || [];
            const stepOptions = steps.map((s) => ({
                key: s.id,
                label: `${String(s.id).padStart(2, "0")} ${s.label}`,
                data: s,
            }));
            return [
                ...stepOptions,
                { key: "back_to_range", label: "← 戻る", action: () => setFlowStep("stepRange") },
            ];
        }
        if (flowStep === "stepBrief") {
            const backAction = intentMode === "change"
                ? { key: "back_to_step", label: "← 工程を選び直す", action: () => setFlowStep("step") }
                : { key: "back_to_intent", label: "← 戻る", action: () => setFlowStep("intent") };
            return [
                { key: "go_issue", label: "困りごとを選択する", action: () => setFlowStep("issue") },
                backAction,
            ];
        }
        if (flowStep === 'issue' && selectedRole) {
            const availableIssueKeys = getAvailableIssuesForStep(currentStepId, selectedRole.key, intentMode);
            const issueOptions = ISSUES
                .filter(i => availableIssueKeys.includes(i.key))
                .map(i => ({ key: i.key, label: i.label, data: i }));
            const backAction = { key: "back_to_brief", label: "← 工程の説明に戻る", action: () => setFlowStep("stepBrief") };
            return [...issueOptions, backAction];
        }
        if (flowStep === 'result') {
            return [
                {
                    key: "back_to_issue",
                    label: "← 戻る",
                    action: () => setFlowStep("issue"),
                },
                {
                    key: 'reset', label: '最初からやり直す', action: () => {
                        // ユーザーロールがあるなら step からリセット
                        if (resolvedRole) {
                            setSelectedRole(resolvedRole);
                            setFlowStep('intent');
                        } else {
                            setSelectedRole(null);
                            setFlowStep('role');
                        }
                        setIntentMode("current");
                        setSelectedStepRange(null);
                        setSelectedIssue(null);
                    }
                },
                {
                    key: 'confirm', label: '✔ この内容で了解', action: () => {
                        // ログデータの作成
                        const logData = {
                            id: Math.random().toString(36).substr(2, 9),
                            timestamp: new Date().toISOString(),
                            user: {
                                id: user?.id || 'guest',
                                name: userName,
                                role: userRoleKey
                            },
                            context: {
                                step_id: currentStepId,
                                step_label: BASE_STEPS.find(s => s.id === currentStepId)?.label,
                                issue_key: selectedIssue?.key,
                                issue_label: selectedIssue?.label,
                            },
                            // その時点での判断ルールをスナップショットとして保存
                            rule_applied: FLOW_RULES[currentStepId]?.[selectedIssue?.key],
                            contact_rule: CONTACT_RULE
                        };

                        try {
                            const existingLogs = JSON.parse(localStorage.getItem('misogi_consultation_logs') || '[]');
                            existingLogs.unshift(logData);
                            localStorage.setItem('misogi_consultation_logs', JSON.stringify(existingLogs));
                            console.log("Consultation log saved:", logData);
                        } catch (e) {
                            console.error("Failed to save log:", e);
                        }

                        alert("対応内容を記録しました。安全第一で作業を進めてください。\n（ポータルに戻ります）");
                        navigate('/');
                    }
                }
            ];
        }
        return [];
    }, [flowStep, selectedRole, userRoleKey, navigate, isRoleLocked, resolvedRole, stepRanges, selectedStepRange, intentMode]);

    const bubbleMaxHeight = useMemo(() => {
        if (flowStep === "result") return "44vh";
        if (flowStep === "intent") return "34vh";
        if (flowStep === "stepBrief") return "40vh";
        if (flowStep === "stepRange" || flowStep === "step") return "38vh";
        return "42vh";
    }, [flowStep]);

    const bubbleEstimatedHeight = useMemo(() => {
        if (flowStep === "result") return 340;
        if (flowStep === "intent") return 220;
        if (flowStep === "stepBrief") return 300;
        if (flowStep === "stepRange" || flowStep === "step") return 280;
        return 260;
    }, [flowStep]);

    // セリフの生成
    const bubbleText = useMemo(() => {
        const contactMap = {
            onsite: "現場",
            sales: "営業",
            op: "OP",
        };

        if (flowStep === 'role') {
            return `【業務フロー相談モード】\nお疲れ様です ${userName} 様。現場での判断に迷われましたか？\nまずは、現在のあなたの「役割」を教えてください。`;
        }
        if (flowStep === "intent") {
            return `了解です、${selectedRole?.label} の ${userName} 様。\n確認したい内容を選んでください。`;
        }
        if (flowStep === "stepRange") {
            if (!stepRanges.length) return "この役割で現在選択できる工程がまだ登録されていません。";
            return `工程を絞って確認します。\nどのあたりの工程ですか？`;
        }
        if (flowStep === "step") {
            if (!(selectedStepRange?.steps?.length)) return "この範囲には選択可能な工程がありません。範囲を戻して選び直してください。";
            return `対象の工程を選んでください。`;
        }
        if (flowStep === "stepBrief") {
            const current = BASE_STEPS.find((s) => s.id === currentStepId);
            const okRule = FLOW_RULES[currentStepId]?.ok;
            const actions = okRule?.actions?.length
                ? okRule.actions.map((a) => `・${a}`).join("\n")
                : "・通常手順に沿って次工程へ進行";
            return `【工程の模範説明】\n${String(currentStepId).padStart(2, "0")} ${current?.label || ""}\n\n通常時は以下を実施します。\n${actions}\n\nこの工程で、困りごとはありますか？`;
        }
        if (flowStep === 'issue') {
            const stepName = BASE_STEPS.find(s => s.id === currentStepId)?.label;
            const availableIssueCount = selectedRole ? getAvailableIssuesForStep(currentStepId, selectedRole.key, intentMode).length : 0;
            if (availableIssueCount === 0) {
                return `[${String(currentStepId).padStart(2, '0')} ${stepName}] の工程では、現在の条件で選択できる対応項目がありません。\n戻って工程を選び直してください。`;
            }
            return `[${String(currentStepId).padStart(2, '0')} ${stepName}] の工程ですね。\n現在の状況において、何かお困りごとはありますか？`;
        }
        if (flowStep === 'result') {
            const stepRules = FLOW_RULES[currentStepId];
            if (!stepRules) return "申し訳ありません。この工程に関する詳細ルールがまだ登録されていません。営業または管理者に連絡してください。";

            const rule = stepRules[selectedIssue?.key];
            if (!rule) {
                return "この状況に関するルールが見つかりませんでした。一般的なトラブルとして営業へ連絡してください。";
            }

            const msg = buildMessage(rule);
            const nextStepLabel = rule.nextStep ? BASE_STEPS.find(s => s.id === rule.nextStep)?.label : "確認中";
            const isIrregular = selectedIssue?.key && selectedIssue.key !== "ok";
            const opTimingText = businessTiming.opAvailableNow
                ? "平日09:00以降（現在対応時間内）"
                : "翌営業日09:00以降";
            const offHoursGuide = !businessTiming.opAvailableNow && isIrregular
                ? `\n\n【時間外運用】\n・一次対応：現場/営業\n・OP調整：${opTimingText}にリスケ協議のみ`
                : "";
            const contactGuide = `\n\n【役割】\n・判断：${contactMap[CONTACT_RULE.decision] || CONTACT_RULE.decision}\n・顧客窓口：${contactMap[CONTACT_RULE.primary] || CONTACT_RULE.primary}\n・調整：${contactMap[CONTACT_RULE.secondary] || CONTACT_RULE.secondary}（${opTimingText} / リスケ協議のみ）`;

            return `【${msg.title}】\n\n${msg.text}${contactGuide}${offHoursGuide}\n\n次工程：${nextStepLabel}`;
        }
        return "";
    }, [flowStep, userName, selectedRole, currentStepId, selectedIssue, userRoleKey, stepRanges, selectedStepRange, intentMode, businessTiming]);

    const handleSelect = (opt) => {
        if (opt.action) {
            opt.action();
            return;
        }
        if (flowStep === 'role') {
            setSelectedRole(opt.data);
            setIntentMode("current");
            setSelectedStepRange(null);
            setFlowStep('intent');
        } else if (flowStep === "intent") {
            const mode = opt.data?.mode || "current";
            setIntentMode(mode);
            setSelectedIssue(null);
            if (mode === "change") {
                setFlowStep("stepRange");
            } else if (mode === "current") {
                setFlowStep("stepBrief");
            } else {
                setFlowStep("stepBrief");
            }
        } else if (flowStep === "stepRange") {
            setSelectedStepRange(opt.data);
            setFlowStep("step");
        } else if (flowStep === 'step') {
            setCurrentStepId(opt.data.id);
            setFlowStep('stepBrief');
        } else if (flowStep === 'issue') {
            setSelectedIssue(opt.data);
            setFlowStep('result');
        }
    };

    const navHintText = useMemo(() => {
        if (flowStep === "intent") return "確認したい内容を選んでください";
        if (flowStep === "stepRange") return "まず工程の範囲を選択";
        if (flowStep === "step") return "次に具体的な工程を選択";
        if (flowStep === "stepBrief") return "工程の模範説明を確認";
        if (flowStep === "issue") return "最後に状況を選択";
        if (flowStep === "result") return "対応内容と次工程を確認";
        return "";
    }, [flowStep]);

    return (
        <div className="flow-guide-screen">
            {/* Visualizer Container */}
            <div
                id="misogi-flow-viz"
                className="flow-guide-screen__viz"
            >
                <Visualizer
                    mode={flowStep === 'result' && selectedIssue?.key !== 'ok' ? "alert" : "base"}
                    className="flow-guide-screen__visualizer-node"
                />
            </div>

            {/* ヘッダー情報（役割・連絡ルール） */}
            <div className="flow-guide-screen__status">
                <div className="flow-guide-screen__status-role">
                    [{selectedRole?.label || '未選択'}]
                    {flowStep !== 'role' && flowStep !== 'intent' && `・${String(currentStepId).padStart(2, '0')}`}
                </div>
                <div>判断：{CONTACT_RULE.decision === 'onsite' ? '現場' : CONTACT_RULE.decision}</div>
                <div>顧客窓口：{CONTACT_RULE.primary === "sales" ? "営業" : CONTACT_RULE.primary}（調整:{CONTACT_RULE.secondary === "op" ? "OP" : CONTACT_RULE.secondary}）</div>
                <div>OP対応：{businessTiming.opAvailableNow ? "平日09:00以降（対応時間内）" : "翌営業日09:00以降"}（リスケ協議のみ）</div>
                <div>{businessTiming.opAvailableNow ? "通常モード：営業日中運用" : "時間外モード：一次対応のみ"}</div>
            </div>

            {/* Main Content Area */}
            <div className="flow-guide-screen__main">
                {/* 戻るボタン */}
                <button
                    onClick={() => navigate('/')}
                    className="flow-guide-screen__back"
                >
                    ← 戻る
                </button>


                {/* 会話用吹き出し */}
                <VisualizerBubble
                    open={true}
                    anchorRect={anchorRect}
                    placement="bottom"
                    text={bubbleText}
                    title="MISOGI"
                    maxHeight={bubbleMaxHeight}
                    estimatedHeight={bubbleEstimatedHeight}
                    closeOnBackdrop={false}
                    onClose={() => navigate('/')}
                />

                {/* 選択肢リスト */}
                <div className="flow-guide-screen__options">
                    <div className="flow-guide-screen__navhint">
                        <button
                            type="button"
                            className="flow-guide-screen__navbtn"
                            disabled={!stepNav.prev}
                            onClick={() => stepNav.prev && setCurrentStepId(stepNav.prev.id)}
                            title={stepNav.prev ? `${String(stepNav.prev.id).padStart(2, "0")} ${stepNav.prev.label}` : "前工程なし"}
                        >
                            ← {stepNav.prev ? `${String(stepNav.prev.id).padStart(2, "0")}` : "--"}
                        </button>
                        <div className="flow-guide-screen__navcenter" title={stepNav.current ? `${String(stepNav.current.id).padStart(2, "0")} ${stepNav.current.label}` : ""}>
                            {navHintText}
                            {stepNav.current ? ` / ${String(stepNav.current.id).padStart(2, "0")} ${compactStepLabel(stepNav.current.label, 10)}` : ""}
                        </div>
                        <button
                            type="button"
                            className="flow-guide-screen__navbtn"
                            disabled={!stepNav.next}
                            onClick={() => stepNav.next && setCurrentStepId(stepNav.next.id)}
                            title={stepNav.next ? `${String(stepNav.next.id).padStart(2, "0")} ${stepNav.next.label}` : "次工程なし"}
                        >
                            {stepNav.next ? `${String(stepNav.next.id).padStart(2, "0")}` : "--"} →
                        </button>
                    </div>
                    <EXHotbar
                        visible={true}
                        inline={true}
                        className="flow-guide-screen__exhotbar"
                        options={exOptions}
                        onSelect={handleSelect}
                    />
                </div>
            </div>

            {/* 下部ホットバー */}
            <Hotbar actions={[]} />
        </div>
    );
}
    const compactStepLabel = (label, maxLen = 9) => {
        const plain = String(label || "").replace(/（.*?）/g, "").trim();
        if (plain.length <= maxLen) return plain;
        return `${plain.slice(0, maxLen)}…`;
    };
