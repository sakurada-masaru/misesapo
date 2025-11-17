# 固定発注ボタン セットアップガイド

## 📋 概要

画面右下に固定表示される円形の発注ボタンと、周囲を回転するテキストを組み合わせたショートコードです。

## 📁 ファイル構成

```
lightning-child/
├── templates/
│   └── fixed-order-button.php          # 固定発注ボタンのテンプレート
├── assets/
│   └── css/
│       └── fixed-order-button.css      # 固定発注ボタンのスタイル
└── functions.php                        # ショートコードとアセット読み込み（更新済み）
```

## 🚀 セットアップ手順

### ステップ1: ファイルのアップロード

#### 1-1. テンプレートファイルのアップロード

1. **ローカルファイル**: `wordpress-templates/fixed-order-button.php`
2. **アップロード先**: `/lightning-child/templates/fixed-order-button.php`
3. フォルダが存在しない場合は作成してください

#### 1-2. CSSファイルのアップロード

1. **ローカルファイル**: `public/css/fixed-order-button.css`
2. **アップロード先**: `/lightning-child/assets/css/fixed-order-button.css`

### ステップ2: functions.php の更新

`docs/LIGHTNING_CHILD_FUNCTIONS_PHP.md` の内容を `functions.php` に追加してください。

**追加される内容:**
- CSS読み込み: `misesapo-fixed-order-button-css`
- ショートコード: `[misesapo_fixed_order_button]`

### ステップ3: Elementorでの使用

#### 方法1: ショートコードウィジェットを使用（推奨）

1. Elementorでページを編集
2. **ウィジェット** → **ショートコード** をドラッグ&ドロップ
3. ショートコード欄に `[misesapo_fixed_order_button]` を入力
4. **更新** をクリック

#### 方法2: HTMLウィジェットを使用

1. Elementorでページを編集
2. **ウィジェット** → **HTML** をドラッグ&ドロップ
3. 以下のコードを入力：

```html
[misesapo_fixed_order_button]
```

4. **更新** をクリック

## 🎯 基本的な使用方法

### デフォルト設定で表示

```
[misesapo_fixed_order_button]
```

**デフォルト設定:**
- リンク先: `/service`
- ボタンテキスト: 「発注はこちらから」
- 回転テキスト: 「Welcome to Misesapo! To place an order, click here. For any questions, please contact us!」
- 位置: 右下（bottom: 50px, right: 50px）

## 🔧 カスタマイズ（ショートコード属性）

### リンク先を変更

```
[misesapo_fixed_order_button url="/cart"]
```

### ボタンテキストを変更

```
[misesapo_fixed_order_button text="お問い合わせ"]
```

改行を含める場合：
```
[misesapo_fixed_order_button text="お問い合わせ<br>はこちら"]
```

### 回転テキストを変更

```
[misesapo_fixed_order_button rotating_text="ミセサポへようこそ！発注はこちらから。"]
```

### 位置を変更

```
[misesapo_fixed_order_button bottom="30px" right="30px"]
```

### 複数の属性を組み合わせる

```
[misesapo_fixed_order_button url="/contact" text="お問い合わせ" bottom="40px" right="40px"]
```

## 📝 使用例

### 例1: カートページへのリンク

```
[misesapo_fixed_order_button url="/cart" text="カートを見る"]
```

### 例2: お問い合わせページへのリンク

```
[misesapo_fixed_order_button url="/contact" text="お問い合わせ" rotating_text="お気軽にお問い合わせください！"]
```

### 例3: スマホで見やすい位置に配置

```
[misesapo_fixed_order_button bottom="20px" right="20px"]
```

## 🎨 デザインの特徴

- **円形ボタン**: 150px × 150px（スマホでは120px × 120px）
- **背景色**: ピンク（#FF008C）
- **白い枠線**: 3px
- **回転テキスト**: 20秒で1回転
- **ホバーエフェクト**: 1.1倍に拡大
- **固定表示**: スクロールしても右下に固定

## 📱 レスポンシブ対応

- **デスクトップ**: 150px × 150px
- **タブレット**: 135px × 135px
- **スマホ**: 120px × 120px

## 🐛 トラブルシューティング

### ボタンが表示されない

1. **ファイルが正しくアップロードされているか確認**
   - `templates/fixed-order-button.php`
   - `assets/css/fixed-order-button.css`

2. **functions.php が正しく更新されているか確認**
   - CSSの読み込みコードがあるか
   - ショートコードが登録されているか

3. **z-indexの競合を確認**
   - 他の要素がボタンの上に表示されていないか確認
   - z-index: 10000 が適用されているか確認

### 回転テキストが表示されない

1. **SVGが正しく生成されているか確認**
   - ブラウザの開発者ツールでHTMLを確認
   - SVG要素が存在するか確認

2. **CSSアニメーションが有効か確認**
   - `@keyframes rotate-text` が定義されているか確認

### 位置が正しくない

1. **ショートコード属性を確認**
   - `bottom` と `right` の値が正しいか確認
   - 単位（px）が指定されているか確認

## 📚 関連ドキュメント

- `LIGHTNING_CHILD_FUNCTIONS_PHP.md` - functions.phpの設定
- `LIGHTNING_CHILD_SETUP_GUIDE.md` - 全体的なセットアップガイド

