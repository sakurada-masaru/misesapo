# 管理ダッシュボードページのレイアウト設定

## 現在の設定

### メインコンテナ（`.admin-dashboard.container`）

#### PC版
- **幅**: `width: 100%`（フルスクリーン）
- **最大幅**: `max-width: none`（制限なし）
- **パディング**: `padding: 0 24px 64px`（左右24px、下64px）
- **マージン**: `margin: 0`

#### 中サイズ（1200px以下）
- **パディング**: `padding: 0 16px 48px`（左右16px、下48px）

#### SP版（768px以下）
- **パディング**: `padding: 0 16px 40px`（左右16px、下40px）

---

### 各セクション・要素の幅

#### 1. ダッシュボードヘッダー（`.dashboard-header`）
- **幅**: 親要素の100%（明示的な幅指定なし）
- **パディング**: `padding-bottom: 16px`
- **マージン**: `margin-bottom: 32px`

#### 2. 統計カードグリッド（`.stats-grid`）
- **幅**: `width: 100%`
- **グリッド**: `grid-template-columns: repeat(4, minmax(0, 1fr))`（PC版：4列）
- **ギャップ**: `gap: 20px`
- **各統計カード（`.stat-card`）**: グリッドアイテム（幅は自動計算）
  - **パディング**: `padding: 24px`

**レスポンシブ**:
- 1200px以下: `grid-template-columns: repeat(2, minmax(0, 1fr))`（2列）
- 768px以下: `grid-template-columns: 1fr`（1列）

#### 3. クイックリンクセクション（`.quick-links-section`）
- **幅**: 親要素の100%（明示的な幅指定なし）
- **マージン**: `margin-bottom: 32px`

**クイックリンクグリッド（`.quick-links`）**:
- **幅**: `width: 100%`
- **グリッド**: `grid-template-columns: repeat(5, minmax(0, 1fr))`（PC版：5列）
- **ギャップ**: `gap: 16px`
- **各クイックリンク（`.quick-link`）**: グリッドアイテム（幅は自動計算）
  - **パディング**: `padding: 24px`

**レスポンシブ**:
- 1200px以下: `grid-template-columns: repeat(2, minmax(0, 1fr))`（2列）
- 768px以下: `grid-template-columns: 1fr`（1列）

#### 4. ダッシュボードグリッド（`.dashboard-grid`）
- **幅**: `width: 100%`
- **グリッド**: `grid-template-columns: repeat(2, minmax(0, 1fr))`（PC版：2列）
- **ギャップ**: `gap: 24px`
- **各ダッシュボードセクション（`.dashboard-section`）**: グリッドアイテム（幅は自動計算）
  - **パディング**: `padding: 24px`（PC版）、`padding: 16px`（768px以下）

**レスポンシブ**:
- 1200px以下: `grid-template-columns: 1fr`（1列）

#### 5. お知らせモーダル（`.notice-modal`）
- **幅**: `width: min(720px, 92vw)`
- **パディング**: `padding: 32px`
- **最大高さ**: `max-height: 90vh`

**モーダル内のフォーム要素**:
- **入力フィールド**: `width: 100%`
- **テキストエリア**: `width: 100%`、`min-height: 160px`

#### 6. アクティビティアイコン（`.activity-icon`）
- **幅**: `width: 40px`
- **高さ**: `height: 40px`

---

## グローバル設定との比較

### グローバル設定（PC版）
- **メインコンテンツ**: フルスクリーンサイズ - 100px（左右パディング50px）

### 現在の管理ダッシュボード（PC版）
- **メインコンテンツ**: フルスクリーンサイズ（左右パディング24px）

**違い**: 
- グローバル設定では `calc(100% - 100px)` + 左右50pxパディング
- 管理ダッシュボードでは `100%` + 左右24pxパディング

---

## まとめ

### PC版の実際のコンテンツ幅
- **コンテナ幅**: 100%（フルスクリーン）
- **左右パディング**: 24pxずつ
- **実際のコンテンツ幅**: `calc(100% - 48px)`

### SP版（768px以下）の実際のコンテンツ幅
- **コンテナ幅**: 100%（フルスクリーン）
- **左右パディング**: 16pxずつ
- **実際のコンテンツ幅**: `calc(100% - 32px)`

### 各グリッド要素の幅
- **統計カード**: グリッドの1/4（PC版）、1/2（1200px以下）、1/1（768px以下）
- **クイックリンク**: グリッドの1/5（PC版）、1/2（1200px以下）、1/1（768px以下）
- **ダッシュボードセクション**: グリッドの1/2（PC版）、1/1（1200px以下）

