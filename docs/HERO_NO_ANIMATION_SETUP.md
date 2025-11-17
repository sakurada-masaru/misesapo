# ヒーローセクション（アニメーションなし）セットアップガイド

## 📋 概要

ヒーローセクションからアニメーションを除外したバージョンを作成しました。画像のスライドショーやズームアニメーション、スクロールヒントのアニメーションをすべて削除し、静的な表示のみになります。

## 📁 ファイル構成

```
lightning-child/
├── templates/
│   └── hero-section-no-animation.php    # アニメーションなしのヒーローセクション
├── assets/
│   └── css/
│       └── hero-section-no-animation.css # アニメーションなしのCSS
└── functions.php                          # ショートコードとアセット読み込み（更新済み）
```

## 🚀 セットアップ手順

### ステップ1: ファイルのアップロード

#### 1-1. テンプレートファイルのアップロード

1. **ローカルファイル**: `wordpress-templates/hero-section-no-animation.php`
2. **アップロード先**: `/lightning-child/templates/hero-section-no-animation.php`
3. フォルダが存在しない場合は作成してください

#### 1-2. CSSファイルのアップロード

1. **ローカルファイル**: `public/css/hero-section-no-animation.css`
2. **アップロード先**: `/lightning-child/assets/css/hero-section-no-animation.css`

### ステップ2: functions.php の更新

`docs/LIGHTNING_CHILD_FUNCTIONS_PHP.md` の内容を `functions.php` に追加してください。

**追加される内容:**
- CSS読み込み: `misesapo-hero-no-animation-css`
- ショートコード: `[misesapo_hero_no_animation]`

### ステップ3: Elementorでの使用

#### 方法1: ショートコードウィジェットを使用（推奨）

1. Elementorでページを編集
2. **ウィジェット** → **ショートコード** をドラッグ&ドロップ
3. ショートコード欄に `[misesapo_hero_no_animation]` を入力
4. **更新** をクリック

#### 方法2: HTMLウィジェットを使用

1. Elementorでページを編集
2. **ウィジェット** → **HTML** をドラッグ&ドロップ
3. 以下のコードを入力：

```html
[misesapo_hero_no_animation]
```

4. **更新** をクリック

## 🎯 違い

### 通常版（`[misesapo_hero]`）
- ✅ 3枚の画像がスライドショーで切り替わる
- ✅ ケンボーンズ効果（ズームイン）アニメーション
- ✅ スクロールヒントのアニメーション

### アニメーションなし版（`[misesapo_hero_no_animation]`）
- ✅ 最初の画像のみ表示（静的な表示）
- ✅ アニメーションなし
- ✅ スクロールヒントなし
- ✅ パフォーマンスが向上

## 📝 使用例

### 例1: 通常のヒーローセクション（アニメーションあり）

```
[misesapo_hero]
```

### 例2: アニメーションなしのヒーローセクション

```
[misesapo_hero_no_animation]
```

## 🔧 カスタマイズ

### 表示する画像を変更する

`templates/hero-section-no-animation.php` を編集して、表示する画像を変更できます：

```php
<!-- 現在: hero-image001.png -->
<img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image001.png')); ?>" 

<!-- 変更例: hero-image002.png を表示 -->
<img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image002.png')); ?>" 
```

## 🐛 トラブルシューティング

### 画像が表示されない

1. **ファイルが正しくアップロードされているか確認**
   - `templates/hero-section-no-animation.php`
   - `assets/css/hero-section-no-animation.css`

2. **functions.php が正しく更新されているか確認**
   - CSSの読み込みコードがあるか
   - ショートコードが登録されているか

3. **画像ファイルのパスを確認**
   - `assets/images/images-admin/hero-image001.png` が存在するか
   - ファイル名が正しいか

### 高さが正しく設定されない

1. **JavaScriptが正しく動作しているか確認**
   - ブラウザのコンソールでエラーがないか確認
   - マスク画像が読み込まれているか確認

2. **マスク画像のパスを確認**
   - `assets/images/images-admin/mask-hero001.png` が存在するか

## 📚 関連ドキュメント

- `LIGHTNING_CHILD_FUNCTIONS_PHP.md` - functions.phpの設定
- `HERO_CSS_FIX.md` - 通常版のヒーローセクションの修正ガイド

