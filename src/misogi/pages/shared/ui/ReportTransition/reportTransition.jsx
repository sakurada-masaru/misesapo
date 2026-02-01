/**
 * 報告モード遷移アニメーションのテンプレート
 * 報告タブ・顧客サブボタンなど、同一の「フェードアウト → 経過後に遷移」を行う箇所で共有する。
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './reportTransition.css';

/** 遷移アニメーションの長さ（ms）。Visualizer log モードの完了タイミングと揃える */
export const TRANSITION_DURATION_MS = 5200;

/** 高速遷移（戻るボタン用など）の長さ（ms） */
export const FAST_TRANSITION_DURATION_MS = 800;

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
      // .html で終わるパスは React 外部の既存ページへの遷移として扱う
      if (targetPath.endsWith('.html')) {
        window.location.href = targetPath;
      } else {
        navigate(targetPath);
      }
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

/**
 * 高速フラッシュ遷移フック（戻るボタン用）
 * 全局イベントを発行して、App.jsx 等に配置された GlobalFlashTransition を起動させる。
 */
export function useFlashTransition() {
  const startTransition = useCallback((path) => {
    window.dispatchEvent(new CustomEvent('misogi-flash-transition', { detail: { path } }));
  }, []);

  return { startTransition };
}

/**
 * 全全局で使い回すフラッシュ遷移コンポーネント
 * App.jsx に配置することで、ページ遷移中も暗転を維持できる。
 */
export function GlobalFlashTransition() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle'); // idle | noise | snap | dark | fading
  const [targetPath, setTargetPath] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      const { path } = e.detail;
      setTargetPath(path);
      setPhase('noise');

      // 0.6秒間ノイズを見せる
      setTimeout(() => setPhase('snap'), 600);

      // 0.4秒間のスナップアニメーション後に暗転
      setTimeout(() => setPhase('dark'), 1000);

      // 暗転中に遷移実行
      setTimeout(() => {
        if (path.endsWith('.html')) {
          window.location.href = path;
        } else {
          navigate(path);
        }
        // 遷移実行後、少し待ってからフェードアウト開始
        setTimeout(() => setPhase('fading'), 300);
      }, 1200);

      // 全行程終了
      setTimeout(() => {
        setPhase('idle');
        setTargetPath(null);
      }, 2000);
    };

    window.addEventListener('misogi-flash-transition', handler);
    return () => window.removeEventListener('misogi-flash-transition', handler);
  }, [navigate]);

  if (phase === 'idle') return null;

  return (
    <div className="report-transition-overlay"
      style={{
        zIndex: 10000000,
        background: (phase === 'dark' || phase === 'snap' || phase === 'fading') ? '#000' : 'transparent',
        pointerEvents: 'all'
      }}>
      {/* ノイズ: snap フェーズまで表示 */}
      {(phase === 'noise' || phase === 'snap') && (
        <div className="report-transition-glitch report-transition-glitch-active" style={{ zIndex: 10000001 }} />
      )}
      {/* CRTスナップ演出 */}
      {phase === 'snap' && (
        <div className="report-transition-crt-snap" style={{ zIndex: 10000002 }} />
      )}
      {/* フェードアウト */}
      {phase === 'fading' && (
        <div className="report-transition-dark-fade-out" style={{ animationDuration: '0.6s', zIndex: 10000003 }} />
      )}
    </div>
  );
}
