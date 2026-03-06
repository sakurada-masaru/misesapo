import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './hotbar.css';
import FlowGuideDrawer from '../../../../flow/FlowGuideDrawer';
import VisualizerBubble from '../VisualizerBubble/VisualizerBubble';
import EXHotbar from './EXHotbar';
import { ROLES, ISSUES, FLOW_RULES, ROLE_ALLOWED_ISSUES, BASE_STEPS } from '../../../../flow/flowData';
import { useAuth } from '../../auth/useAuth';
import { useI18n } from '../../i18n/I18nProvider';

function resolveIconKind(action) {
  const explicit = String(action?.icon || '').toLowerCase().trim();
  if (explicit) return explicit;
  const id = String(action?.id || '').toLowerCase();
  const label = String(action?.label || '').toLowerCase();
  const role = String(action?.role || '').toLowerCase();
  const key = `${id} ${label} ${role}`;
  if (/preview|プレビュー|search|虫眼鏡/.test(key)) return 'preview';
  if (/pdf/.test(key)) return 'pdf';
  if (/camera|カメラ/.test(key)) return 'camera';
  if (/report|houkoku|log|報告|日誌/.test(key)) return 'report';
  if (/plan|yotei|schedule|calendar|予定|休み/.test(key)) return 'plan';
  if (/tool|flow|utility|status|ツール|業務フロー/.test(key)) return 'tools';
  if (/setting|config|設定/.test(key)) return 'settings';
  return 'default';
}

/**
 * アクションボタン。ジョブごとに内容は変えるが、仕組みは機能呼び出しだけ。
 */
export default function Hotbar({ actions = [], active, onChange, showFlowGuideButton = true }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const userName = user?.name || user?.displayName || user?.username || user?.id || t('ユーザー');
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
    if (flowStep === 'result') return [{ key: 'reset', label: t('最初から'), action: resetFlow }];
    return [];
  }, [flowStep, selectedRole]);

  const bubbleText = useMemo(() => {
    if (flowStep === 'role') return `お疲れ様です ${userName} 様\n現在のあなたの役割を教えてください。`;
    if (flowStep === 'issue') return `${userName} 様、了解しました。何かお困りごとはありますか？`;
    if (flowStep === 'result') {
      const rule = FLOW_RULES[currentStepId]?.[selectedIssue.key];
      if (!rule) return t('確認しましたが、ルールが見当たりませんでした。');
      return `【${t(rule.title)}】\n\n${t('推奨アクション：')}\n${rule.actions.map(a => `・${t(a)}`).join('\n')}`;
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
      <div className="hotbar" role={t('navigation')}>
        {actions.map((a) => {
          const isDisabled = a.disabled === true;
          const iconKind = resolveIconKind(a);
          return (
            <button
              key={a.id}
              type="button"
              className={`hotbar-btn ${a.id === active ? 'active' : ''} ${isDisabled ? 'hotbar-btn-disabled' : ''}`}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange?.(a.id)}
            >
              <span className={`hotbar-btn-icon hotbar-icon-${iconKind}`} aria-hidden="true" />
              <span className="hotbar-btn-label">{t(a.label)}</span>
            </button>
          );
        })}
        {showFlowGuideButton && (
          <button
            type="button"
            className={`hotbar-btn ${isFlowGuidePage ? 'active' : ''}`}
            onClick={navigateToFlow}
          >
            <span className={`hotbar-btn-icon hotbar-icon-${isFlowGuidePage ? 'home' : 'flow'}`} aria-hidden="true" />
            <span className="hotbar-btn-label">{isFlowGuidePage ? t('ポータル') : t('業務フロー')}</span>
          </button>
        )}
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
        title={t('MISOGI / 業務フロー')}
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
