import React, { useState, useEffect } from 'react';
import './hotbar.css';
import FlowGuideDrawer from '../../../../flow/FlowGuideDrawer';
import VisualizerBubble from '../VisualizerBubble/VisualizerBubble';

/**
 * アクションボタン。ジョブごとに内容は変えるが、仕組みは機能呼び出しだけ。
 * action.disabled === true のときはボタン無効（onChange は呼ばない）。
 */
export default function Hotbar({ actions, active, onChange }) {
  const [flowOpen, setFlowOpen] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const openFlow = () => {
    const el = document.getElementById('misogi-visualizer');
    if (el) {
      const rect = el.getBoundingClientRect();
      setAnchorRect(rect);
      setBubbleOpen(true);
    } else {
      setFlowOpen(true);
    }
  };

  // リサイズ/スクロールで追従
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

  if (!actions?.length) return null;

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
        <button
          type="button"
          className="hotbar-btn"
          style={{ borderStyle: 'dashed' }}
          onClick={openFlow}
        >
          📘 業務フロー
        </button>
      </div>

      <FlowGuideDrawer
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        defaultRoleKey={null}
        defaultStepId={16}
        defaultIssueKey={null}
      />

      <VisualizerBubble
        open={bubbleOpen}
        anchorRect={anchorRect}
        placement="bottom"
        title="MISOGI / 業務フロー"
        text={
          "現在の状況に合わせて、最適なフローをガイドします。\n\n" +
          "立場を選択してください：\n" +
          "・業務委託者（清掃員）\n・OP（オペレーター）\n・事務/管理\n・営業\n・経理\n\n" +
          "※詳細はドロワー版で確認できます。"
        }
        onClose={() => setBubbleOpen(false)}
        onOpenDetail={() => {
          setBubbleOpen(false);
          setFlowOpen(true);
        }}
      />
    </>
  );
}
