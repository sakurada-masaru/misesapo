# インデックスページ引き継ぎ事項

## 最終更新日
2025年1月

## ファイル構成

### ソースファイル
- **パス**: `src/pages/index.html`
- **レイアウト**: `@layout('layouts.base')` を使用
- **メタデータ**: 
  - `data/meta/index_title.json` からタイトルを読み込み
  - `data/meta/index_body_class.json` からbodyクラスを読み込み

### ビルド後のファイル
- **パス**: `public/index.html`
- **ビルドコマンド**: `python3 scripts/build.py`

## 現在の実装状態

### 1. ヘッダー
- **権限**: Public（ゲスト用）
- **実装**: `base.html`の`@include('partials.header')`により自動的に含まれる
- **ヘッダーID**: `header-guest`
- **機能**:
  - ロゴ（`/images/logo_144x144.png`）
  - ナビゲーション（JavaScriptで動的生成）
  - ログイン/新規登録ボタン
  - ハンバーガーメニュー（SP版）

### 2. ヒーローセクション

#### 構造
- **フルスクリーン表示**: `width: 100vw; height: 100vh; min-height: 100vh;`
- **画像**: PC版3枚、SP版3枚（合計6枚）
- **アニメーション**: フェードイン・フェードアウト（12秒サイクル）

#### 画像ファイル
**PC版（横長）**:
- `/images-admin/hero-slide-01.png`
- `/images-admin/hero-slide-02.png`
- `/images-admin/hero-slide-03.png`

**SP版（縦長）**:
- `/images-admin/hero-slide-01-sp.png`
- `/images-admin/hero-slide-02-sp.png`
- `/images-admin/hero-slide-03-sp.png`

#### アニメーション仕様
- **サイクル時間**: 12秒
- **1枚目**: 0-4秒表示（最初から表示）
- **2枚目**: 4-8秒表示
- **3枚目**: 8-12秒表示
- **フェード時間**: 2%でフェードイン、33%でフェードアウト

#### UI要素

1. **スクロールヒント**（左側50px幅）
   - 位置: 画面左下
   - テキスト: "SCROLL DOWN"（縦書き）
   - アニメーション: 上下にフェードイン・フェードアウト

2. **キャッチコピー**（左側、縦書き、ピンク背景）
   - 位置: 画面左下（スクロールヒントの上）
   - 背景色: `#FF679C`
   - テキスト:
     - サブタイトル: "清掃も設備もまとめて管理！"
     - メインタイトル: "店舗の清掃は『ミセサポ』へ！！"

3. **コピーライト**（右側、縦書き）
   - 位置: 画面右中央
   - テキスト: "©2024 Misesapo."

### 3. CSS設定

#### フルスクリーン表示の基本設定
```css
html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow-x: hidden;
}

#main {
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 100%;
}
```

#### レスポンシブ対応
- **ブレークポイント**: `max-width: 767px`
- **SP版**:
  - スクロールヒント: 幅40px、フォントサイズ12px
  - キャッチコピー: 左20px、下80px、パディング調整
  - コピーライト: 画面右下に配置

### 4. JavaScript
- 現在は空の`DOMContentLoaded`イベントリスナーのみ
- 必要に応じて機能を追加可能

## 重要な注意事項

### 1. ビルドプロセス
- **変更後は必ずビルドを実行**: `python3 scripts/build.py`
- ソースファイル（`src/pages/index.html`）を編集し、ビルド後に`public/index.html`が生成される

### 2. 画像パス
- 画像は`/images-admin/`ディレクトリに配置
- パスは絶対パス（`/`から始まる）で記述
- GitHub Pagesでの動作を考慮

### 3. フルスクリーン表示
- `html, body`に`margin: 0; padding: 0;`を設定済み
- 横スクロール防止のため`overflow-x: hidden;`を設定
- ヒーローセクションは`100vw`と`100vh`を使用してフルスクリーン表示

### 4. ヘッダーとの関係
- ヘッダーは`base.html`で自動的に含まれる
- ヘッダーのスタイルは`src/assets/styles.css`で定義
- ヒーローセクションの上にヘッダーが表示される

### 5. レスポンシブ対応
- PC版とSP版で画像を切り替え（`.sp-none`と`.pc-none`クラス）
- メディアクエリで`max-width: 767px`をブレークポイントとして使用

## 今後の拡張予定

### 未実装の機能
- ヒーローセクション以外のコンテンツセクション（現在はヒーローのみ）
- スクロール連動アニメーション（他のページで実装済みの機能）
- その他のセクション（「こんなお悩みありませんか」「ミセサポとは」など）

### 参考実装
- `src/pages/lp.html`: 元のランディングページの構造（参考用）
- `src/pages/recruit.html`: スクロール連動アニメーションの実装例

## トラブルシューティング

### 画像が表示されない場合
1. 画像ファイルが`public/images-admin/`に存在するか確認
2. ビルドを実行して`public/index.html`を再生成
3. ブラウザのキャッシュをクリア（`Cmd + Shift + R`）

### フルスクリーン表示にならない場合
1. `html, body`のスタイルが他のCSSで上書きされていないか確認
2. `#main`のスタイルが正しく適用されているか確認
3. ビルド後の`public/index.html`を確認

### ヘッダーが表示されない場合
1. `base.html`の`@include('partials.header')`が正しく動作しているか確認
2. `src/partials/header.html`が存在するか確認
3. ビルドを実行して再生成

## 関連ファイル

### テンプレートファイル
- `src/layouts/base.html`: ベースレイアウト
- `src/partials/header.html`: ヘッダーパーシャル

### スタイルファイル
- `src/assets/styles.css`: 共通スタイル
- `src/pages/index.html`: ページ固有のスタイル（`<style>`タグ内）

### メタデータ
- `src/data/meta/index_title.json`: ページタイトル
- `src/data/meta/index_body_class.json`: bodyクラス

### ビルドスクリプト
- `scripts/build.py`: ビルドスクリプト

## 開発サーバー

### ローカル開発
```bash
python3 scripts/dev_server.py
```
- ポート: 5173
- URL: `http://localhost:5173`

### ビルド
```bash
python3 scripts/build.py
```

## その他

### ブラウザ対応
- モダンブラウザ対応（Chrome, Firefox, Safari, Edge）
- レスポンシブデザイン対応（PC/SP）

### アクセシビリティ
- スキップリンク実装済み
- 適切な`alt`属性設定
- セマンティックHTML使用

---

**注意**: このドキュメントは現在の実装状態を反映しています。今後の変更に応じて更新してください。


