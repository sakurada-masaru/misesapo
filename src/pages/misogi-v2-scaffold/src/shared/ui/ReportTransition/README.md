# ReportTransition（報告モード遷移アニメーション）

報告タブや顧客サブボタンなど、「同じフェードアウト → 経過後に遷移」を行う箇所で共有するテンプレートです。

## エクスポート

- **TRANSITION_DURATION_MS** (5200)  
  遷移アニメーションの長さ（ms）。Visualizer log モードの完了タイミングと揃えている。

- **TRANSITION_CLASS_PAGE** (`'log-transition'`)  
  遷移中にページルートに付与するクラス名（例: ホットバー非表示）。

- **TRANSITION_CLASS_UI** (`'transitioning-out'`)  
  遷移中にメインUIに付与するクラス名（フェードアウト・縮小）。  
  CSS は `components.css` の `.job-entrance-ui.transitioning-out` などを参照。

- **TRANSITION_LABEL** (`'MODE CHANGE'`)  
  遷移オーバーレイに表示するラベル文言。Visualizer log モードおよび ReportTransitionOverlay で共通利用。

- **GLITCH_PHASE_DELAY_MS** (2200)  
  ノイズ（グリッチ：走査線＋RGBズレ）を表示するまでの遅延（ms）。Visualizer log の 2.2s グリッチと揃えている。

- **FLASH_PHASE_DELAY_MS** (4000)  
  白フラッシュ＋暗転を表示するまでの遅延（ms）。Visualizer log の logPhase 3 と揃えている。

- **ReportTransitionOverlay**  
  遷移中に表示するラベル付きオーバーレイコンポーネント。`visible={true}` のとき約1秒後にラベル表示（ジッター）、約2.2秒後にノイズ（グリッチ）、約4秒後に一瞬白フラッシュ→暗転。  
  `useReportStyleTransition` の `isTransitioning` 時に `<ReportTransitionOverlay visible />` として表示する。

- **useReportStyleTransition(navigate)**  
  フック。戻り値:
  - `isTransitioning`: 遷移中かどうか。
  - `startTransition(path)`: 遷移を開始し、`TRANSITION_DURATION_MS` 経過後に `navigate(path)` する。

## 使用例

```jsx
import { useReportStyleTransition, TRANSITION_CLASS_PAGE, TRANSITION_CLASS_UI, ReportTransitionOverlay } from './ReportTransition/reportTransition';

const { isTransitioning, startTransition } = useReportStyleTransition(navigate);
const showTransition = isLogTransition || isTransitioning;

<div className={`page ${showTransition ? TRANSITION_CLASS_PAGE : ''}`}>
  <div className={`main-ui ${showTransition ? TRANSITION_CLASS_UI : ''}`}>
    ...
    <button onClick={() => startTransition('/sales/customers')}>顧客一覧</button>
  </div>
  {isTransitioning && <ReportTransitionOverlay visible />}
</div>
```

## Visualizer log モードとの関係

Visualizer の `mode="log"` では、内部で `TRANSITION_DURATION_MS` を参照し、同じタイミングで `onLogTransitionEnd` を呼びます。報告タブ押下時は Visualizer がアニメーションを担当し、顧客サブボタン押下時は `useReportStyleTransition` が同じ長さで遷移します。
