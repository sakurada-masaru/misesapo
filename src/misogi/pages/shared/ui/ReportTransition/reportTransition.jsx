/**
 * 報告モード遷移アニメーションのテンプレート
 *
 * NOTE:
 * 現場運用のフィードバックにより「MODE CHANGE」系の遷移演出は無効化した。
 * UI 側はこのモジュールを参照し続けられるが、遷移は即時に行う（互換維持）。
 */

import React, { useCallback } from 'react';
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
  // 遷移演出は無効化（即時遷移へ移行）
  void visible;
  return null;
}

/**
 * 報告スタイル遷移フック
 * 遷移開始 → 指定時間経過 → 指定パスへ navigate する。
 *
 * @param {function} navigate - react-router の navigate
 * @returns {{ isTransitioning: boolean, startTransition: (path: string) => void }}
 */
export function useReportStyleTransition(navigate) {
  // 演出は無効化: 即時遷移
  const startTransition = useCallback((path) => {
    if (!path) return;
    // .html で終わるパスは React 外部の既存ページへの遷移として扱う
    if (String(path).endsWith('.html')) {
      window.location.href = String(path);
      return;
    }
    navigate(String(path));
  }, [navigate]);

  return { isTransitioning: false, startTransition };
}

/**
 * 高速フラッシュ遷移フック（戻るボタン用）
 * 全局イベントを発行して、App.jsx 等に配置された GlobalFlashTransition を起動させる。
 */
export function useFlashTransition() {
  // 演出は無効化: 即時遷移（イベント/オーバーレイは使わない）
  const navigate = useNavigate();
  const startTransition = useCallback((path) => {
    if (!path) return;
    if (String(path).endsWith('.html')) {
      window.location.href = String(path);
      return;
    }
    navigate(String(path));
  }, [navigate]);

  return { startTransition };
}

/**
 * 全全局で使い回すフラッシュ遷移コンポーネント
 * App.jsx に配置することで、ページ遷移中も暗転を維持できる。
 */
export function GlobalFlashTransition() {
  // 演出は無効化
  return null;
}
