# 円形スケジュール表示の回転操作実装計画

## 調査結果まとめ

### 参考になる技術・ライブラリ

1. **SVG + CSS Transform**
   - `transform: rotate()` を使用した回転アニメーション
   - `stroke-dasharray` と `stroke-dashoffset` で円の描画アニメーション

2. **JavaScriptライブラリ**
   - **Chart.js**: アニメーション機能付きグラフライブラリ
   - **Raphael.js**: SVG操作に特化
   - **Circliful**: jQueryプラグイン（円グラフ専用）

3. **インタラクティブ操作**
   - マウスドラッグ/タッチジェスチャーで角度計算
   - `atan2()` 関数でマウス位置から角度を算出
   - スナップ機能（特定の角度に吸着）

## 実装方針

### 1. 回転操作の実装方法

#### 方法A: SVG全体を回転させる
```javascript
// SVG要素全体を回転
svg.setAttribute('transform', `rotate(${rotationAngle} ${centerX} ${centerY})`);
```

**メリット:**
- 実装が簡単
- パフォーマンスが良い
- ラベルも一緒に回転する

**デメリット:**
- ラベルが読みにくくなる可能性

#### 方法B: 各セグメントを個別に回転させる
```javascript
// 各セグメントの角度を調整
const adjustedAngle = originalAngle - rotationAngle;
```

**メリット:**
- ラベルを常に読みやすい向きに保てる
- より柔軟な制御が可能

**デメリット:**
- 実装が複雑
- パフォーマンスへの影響

#### 方法C: ハイブリッド（推奨）
- セグメントと区切り線は回転
- ラベルは常に上向きに固定（transformで補正）

### 2. ドラッグ操作の実装

```javascript
let isDragging = false;
let startAngle = 0;
let currentRotation = 0;

// マウス/タッチ開始
function onDragStart(e) {
  isDragging = true;
  const point = getEventPoint(e);
  startAngle = getAngleFromCenter(point);
}

// ドラッグ中
function onDrag(e) {
  if (!isDragging) return;
  const point = getEventPoint(e);
  const currentAngle = getAngleFromCenter(point);
  const deltaAngle = currentAngle - startAngle;
  currentRotation += deltaAngle;
  
  // スナップ機能（オプション）
  currentRotation = snapToSegment(currentRotation);
  
  applyRotation(currentRotation);
  startAngle = currentAngle;
}

// 角度計算
function getAngleFromCenter(point) {
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}
```

### 3. スナップ機能

```javascript
function snapToSegment(angle) {
  const segments = getSegmentCount(); // 月次: 30-31, 週次: 7, 日次: 12
  const segmentAngle = 360 / segments;
  const snappedAngle = Math.round(angle / segmentAngle) * segmentAngle;
  return snappedAngle;
}
```

### 4. アニメーション

```javascript
// CSS transitionを使用
.circular-svg {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

// またはJavaScriptでアニメーション
function animateRotation(targetAngle) {
  const startAngle = currentRotation;
  const duration = 300;
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    currentRotation = startAngle + (targetAngle - startAngle) * eased;
    applyRotation(currentRotation);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}
```

## 実装ステップ

### Phase 1: 基本的な回転機能
1. SVG要素に回転を適用
2. マウスドラッグで回転
3. タッチジェスチャー対応

### Phase 2: スナップ機能
1. セグメント境界にスナップ
2. スナップ時の視覚的フィードバック

### Phase 3: アニメーション
1. スムーズな回転アニメーション
2. 慣性スクロール（オプション）

### Phase 4: UX改善
1. 回転中のラベル読みやすさ向上
2. 回転範囲の制限（必要に応じて）
3. リセットボタン

## 参考実装例

### iOSの時間選択ホイール
- 回転可能な円形ホイール
- スナップ機能
- 慣性スクロール

### AndroidのMaterial Time Picker
- タッチで回転
- スムーズなアニメーション

### カスタム実装例
- SVG + JavaScript
- Canvas + JavaScript
- WebGL（Three.js等）

## 技術的な考慮事項

1. **パフォーマンス**
   - `requestAnimationFrame` を使用
   - 回転中の再描画を最適化

2. **アクセシビリティ**
   - キーボード操作対応
   - スクリーンリーダー対応

3. **モバイル対応**
   - タッチイベントの適切な処理
   - タッチアクションの最適化

4. **ブラウザ互換性**
   - SVG transform の対応状況
   - タッチイベントの対応状況








