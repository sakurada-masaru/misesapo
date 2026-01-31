/**
 * 報告モード遷移アニメーションのテンプレート
 * 報告タブ・顧客サブボタンなど、同一の「フェードアウト → 経過後に遷移」を行う箇所で共有する。
 */

import React, { useState, useCallback, useEffect } from 'react';
import './reportTransition.css';

/** 遷移アニメーションの長さ（ms）。Visualizer log モードの完了タイミングと揃える */
export const TRANSITION_DURATION_MS = 5200;

/** 遷移中にページルートに付与するクラス名（ホットバー非表示など） */
export const TRANSITION_CLASS_PAGE = 'log-transition';

/** 遷移中にメインUIに付与するクラス名（フェードアウト・縮小） */
export const TRANSITION_CLASS_UI = 'transitioning-out';

/** 遷移オーバーレイに表示するラベル文言 */
export const TRANSITION_LABEL = 'MODE CHANGE';

/** ノイズ（グリッチ）を表示するまでの遅延（ms）。Visualizer log の 2.2s グリッチと揃える */
export const GLITCH_PHASE_DELAY_MS = 2200;

/** 白フラッシュ＋暗転を表示するまでの遅延（ms）。Visualizer log の logPhase 3 と揃える */
export const FLASH_PHASE_DELAY_MS = 4000;

/**
 * 遷移中に表示するラベル付きオーバーレイ
 * useReportStyleTransition の isTransitioning 時に表示する。
 * 約1秒後にラベル表示、約2.2秒後にノイズ（グリッチ）、約4秒後に一瞬白フラッシュ→暗転。
 *
 * @param {boolean} visible - オーバーレイを表示するか
 */
export function ReportTransitionOverlay({ visible }) {
  const [labelVisible, setLabelVisible] = useState(false);
  const [showGlitch, setShowGlitch] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (!visible) {
      setLabelVisible(false);
      setShowGlitch(false);
      setShowFlash(false);
      return;
    }
    const t1 = setTimeout(() => setLabelVisible(true), 1000);
    const t2 = setTimeout(() => setShowGlitch(true), GLITCH_PHASE_DELAY_MS);
    const t3 = setTimeout(() => setShowFlash(true), FLASH_PHASE_DELAY_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="report-transition-overlay" aria-hidden="true">
      <div className={`report-transition-label ${labelVisible ? 'visible' : ''}`}>
        <span className="label-jitter">{TRANSITION_LABEL}</span>
      </div>
      {showGlitch && <div className="report-transition-glitch report-transition-glitch-active" />}
      {showFlash && (
        <>
          <div className="report-transition-white-flash" />
          <div className="report-transition-dark-instant" />
        </>
      )}
    </div>
  );
}

/**
 * 報告スタイル遷移フック
 * 遷移開始 → 指定時間経過 → 指定パスへ navigate する。
 *
 * @param {function} navigate - react-router の navigate
 * @returns {{ isTransitioning: boolean, startTransition: (path: string) => void }}
 */
export function useReportStyleTransition(navigate) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetPath, setTargetPath] = useState(null);

  useEffect(() => {
    if (!targetPath) return;
    const t = setTimeout(() => {
      navigate(targetPath);
      setTargetPath(null);
      setIsTransitioning(false);
    }, TRANSITION_DURATION_MS);
    return () => clearTimeout(t);
  }, [targetPath, navigate]);

  const startTransition = useCallback((path) => {
    setTargetPath(path);
    setIsTransitioning(true);
  }, []);

  return { isTransitioning, startTransition };
}
