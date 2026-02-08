import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './hotbar.css';
import FlowGuideDrawer from '../../../../flow/FlowGuideDrawer';
import VisualizerBubble from '../VisualizerBubble/VisualizerBubble';
import EXHotbar from './EXHotbar';
import { ROLES, ISSUES, FLOW_RULES, ROLE_ALLOWED_ISSUES, BASE_STEPS } from '../../../../flow/flowData';
import { useAuth } from '../../auth/useAuth';

/**
 * アクションボタン。ジョブごとに内容は変えるが、仕組みは機能呼び出しだけ。
 */
export default function Hotbar({ actions = [], active, onChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = user?.name || user?.displayName || user?.username || user?.id || 'ユーザー';
  const [flowOpen, setFlowOpen] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  // 会話フロー用ステート（補助的なドロワー用）
  const [flowStep, setFlowStep] = useState('none');
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [currentStepId, setCurrentStepId] = useState(16);

  const isFlowGuidePage = location.pathname === '/flow-guide';

  const navigateToFlow = () => {
    if (isFlowGuidePage) {
      navigate('/');
    } else {
      navigate('/flow-guide');
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setFlowStep('issue');
  };

  const handleIssueSelect = (issue) => {
    setSelectedIssue(issue);
    setFlowStep('result');
  };

  const resetFlow = () => {
    setFlowStep('role');
    setSelectedRole(null);
    setSelectedIssue(null);
  };

  const exOptions = useMemo(() => {
    if (flowStep === 'role') return ROLES.map(r => ({ key: r.key, label: r.label, data: r }));
    if (flowStep === 'issue' && selectedRole) {
      const allowed = ROLE_ALLOWED_ISSUES[selectedRole.key] || [];
      return ISSUES.filter(i => allowed.includes(i.key)).map(i => ({ key: i.key, label: i.label, data: i }));
    }
    if (flowStep === 'result') return [{ key: 'reset', label: '最初から', action: resetFlow }];
    return [];
  }, [flowStep, selectedRole]);

  const bubbleText = useMemo(() => {
    if (flowStep === 'role') return `お疲れ様です ${userName} 様\n現在のあなたの役割を教えてください。`;
    if (flowStep === 'issue') return `${userName} 様、了解しました。何かお困りごとはありますか？`;
    if (flowStep === 'result') {
      const rule = FLOW_RULES[currentStepId]?.[selectedIssue.key];
      if (!rule) return "確認しましたが、ルールが見当たりませんでした。";
      return `【${rule.title}】\n\n推奨アクション：\n${rule.actions.map(a => `・${a}`).join('\n')}`;
    }
    return "";
  }, [flowStep, userName, selectedIssue, currentStepId]);

  useEffect(() => {
    if (!bubbleOpen) return;
    const update = () => {
      const el = document.getElementById('misogi-visualizer');
      if (el) setAnchorRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [bubbleOpen]);

  return (
    <>
      <div className="hotbar" role="navigation">
        {actions.map((a) => {
          const isDisabled = a.disabled === true;
          return (
            <button
              key={a.id}
              type="button"
              className={`hotbar-btn ${a.id === active ? 'active' : ''} ${isDisabled ? 'hotbar-btn-disabled' : ''}`}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange?.(a.id)}
            >
              {a.label}
            </button>
          );
        })}
        {/* メインの導線：専用画面へ */}
        <button
          type="button"
          className={`hotbar-btn ${isFlowGuidePage ? 'active' : ''}`}
          style={{ borderStyle: 'dashed' }}
          onClick={navigateToFlow}
        >
          {isFlowGuidePage ? '🏠 ポータルへ' : '📘 業務フロー'}
        </button>
      </div>

      <EXHotbar
        visible={bubbleOpen}
        options={exOptions}
        onSelect={(opt) => {
          if (opt.action) opt.action();
          else if (flowStep === 'role') handleRoleSelect(opt.data);
          else if (flowStep === 'issue') handleIssueSelect(opt.data);
        }}
      />

      <FlowGuideDrawer
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        defaultRoleKey={selectedRole?.key || null}
        defaultStepId={currentStepId}
        defaultIssueKey={selectedIssue?.key || null}
      />

      <VisualizerBubble
        open={bubbleOpen}
        anchorRect={anchorRect}
        placement="bottom"
        title="MISOGI / 業務フロー"
        text={bubbleText}
        onClose={() => {
          setBubbleOpen(false);
          setFlowStep('none');
        }}
        onOpenDetail={() => {
          setBubbleOpen(false);
          setFlowOpen(true);
        }}
      />
    </>
  );
}
