import React, { useId, useState, useCallback, useRef, useEffect } from 'react';
import { TRANSITION_DURATION_MS, TRANSITION_LABEL } from '../ReportTransition/reportTransition.jsx';
import './visualizer.css';

const STATUS_READY = 'READY TO ASSIST';
const STATUS_LISTENING = 'LISTENING...';
const STATUS_PROCESSING = 'PROCESSING...';

/**
 * M.I.S.O.G.I ビジュアライザー
 * mode=base|target|status|plan|log でアニメーション切り替え。
 * base: 現状維持 / target: リングのみ外→内、コア不動 / status: リング非表示、コア鼓動
 * plan: 1秒ごとに6degカチカチ回転 / log: 4フェーズ（0s UIフェード / 1s MODE CHANGE 明滅 / 2.2s グリッチ / 3s CRT＋白フラッシュ / 5.2s 遷移）
 *
 * @param {string} mode - "base" | "target" | "status" | "plan" | "log"（default: "base"）
 * @param {function} onLogTransitionEnd - log の overlay animationend で呼ぶ（報告へ遷移）
 * @param {boolean} active - 聴取中（interactive 時）
 * @param {boolean} interactive
 * @param {function} onActiveChange
 */
export default function Visualizer({
  mode = 'base',
  onLogTransitionEnd,
  active: controlledActive = false,
  interactive = false,
  onActiveChange,
  className = '',
}) {
  const pathId = useId().replace(/:/g, '-');
  const [internalActive, setInternalActive] = useState(false);
  const [statusText, setStatusText] = useState(STATUS_READY);
  const containerRef = useRef(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [planAngle, setPlanAngle] = useState(0);
  const [logPhase, setLogPhase] = useState(0);

  const isControlled = onActiveChange !== undefined;
  const active = isControlled ? controlledActive : internalActive;

  useEffect(() => {
    if (mode !== 'plan') return;
    const id = setInterval(() => {
      setPlanAngle((a) => a + 6);
    }, 1000);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'log') {
      setLogPhase(0);
      return;
    }
    setLogPhase(0);
    const t1 = setTimeout(() => setLogPhase(1), 2000);
    const t2 = setTimeout(() => setLogPhase(2), 3200);
    const t3 = setTimeout(() => setLogPhase(3), 4200);
    const t4 = setTimeout(() => onLogTransitionEnd?.(), TRANSITION_DURATION_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [mode, onLogTransitionEnd]);

  const handleToggle = useCallback(() => {
    if (!interactive) return;
    const next = !active;
    if (!isControlled) setInternalActive(next);
    onActiveChange?.(next);
    if (next) setStatusText(STATUS_LISTENING);
    else {
      setStatusText(STATUS_PROCESSING);
      setTimeout(() => setStatusText((prev) => (prev === STATUS_PROCESSING ? STATUS_READY : prev)), 1500);
    }
  }, [active, interactive, isControlled, onActiveChange]);

  const handleMouseMove = useCallback(
    (e) => {
      if (!interactive || active) {
        setParallax({ x: 0, y: 0 });
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      setParallax({ x: (w / 2 - e.pageX) / 50, y: (h / 2 - e.pageY) / 50 });
    },
    [interactive, active]
  );
  const handleMouseLeave = useCallback(() => setParallax({ x: 0, y: 0 }), []);

  const containerStyle = {
    ...(interactive && (parallax.x !== 0 || parallax.y !== 0) ? { transform: `translate(${parallax.x}px, ${parallax.y}px)` } : {}),
    ...(mode === 'plan' ? { '--plan-angle': `${planAngle}deg` } : {}),
  };

  const showRing = mode !== 'status';

  const inner = (
    <div
      ref={containerRef}
      className={`visualizer-container${active ? ' active' : ''} viz-mode-${mode}${mode === 'log' ? ' log-freeze' : ''} ${className}`.trim()}
      id="misogi-visualizer"
      data-mode={mode}
      role="img"
      aria-label="M.I.S.O.G.I ビジュアライザー"
      onClick={interactive ? handleToggle : undefined}
      onMouseMove={interactive ? handleMouseMove : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
      style={Object.keys(containerStyle).length ? containerStyle : undefined}
    >
      <div className="circle-text-container viz-ring">
        <svg viewBox="0 0 200 200" className="circle-svg" width={200} height={200}>
          <path id={pathId} d="M 100, 100 m -70, 0 a 70,70 0 1,1 140,0 a 70,70 0 1,1 -140,0" />
          <text textLength="439.82" lengthAdjust="spacingAndGlyphs">
            <textPath href={`#${pathId}`} startOffset="0%">
              Misesapo Intelligent System for Operational Guidance &amp; interface • M.I.S.O.G.I •
            </textPath>
          </text>
        </svg>
      </div>
      <div className="core-circle" />
      {(showRing || mode === 'status') && (
        <>
          <div className="wave" />
          <div className="wave" />
          <div className="wave" />
        </>
      )}
    </div>
  );

  return (
    <div className={`visualizer-viz-wrap${mode === 'log' && logPhase >= 2 ? ' log-glitch' : ''}`}>
      {inner}
      {mode === 'log' && (
        <div className="report-cinematic" aria-hidden="true">
          <div className={`report-cinematic-label ${logPhase >= 1 ? 'visible' : ''}`}>
            <span className="label-jitter">{TRANSITION_LABEL}</span>
          </div>
          {logPhase >= 2 && <div className="glitch-overlay glitch-active" />}
          {logPhase >= 3 && (
            <>
              <div className="white-flash" />
              <div className="dark-instant" />
              <div className="crt-off" />
            </>
          )}
        </div>
      )}
      {interactive && (
        <div className="visualizer-status">
          <p className="status-text">{statusText}</p>
          <p className="hint">Click the visualizer to toggle active mode</p>
        </div>
      )}
    </div>
  );
}
