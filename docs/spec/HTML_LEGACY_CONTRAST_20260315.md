# HTML Legacy Contrast (2026-03-15)

`src/misogi` は Vite + React 構成のため、実運用で必要な HTML はエントリ HTML が中心です。  
本ドキュメントは `src` 配下の `.html` を「現行運用」と「レガシー候補」で対比した一覧です。

## 1. 判定結果（`src/**.html`、`node_modules`除外）

- 総数: `229`
- 現行運用: `1`
- 生成物（ビルド成果）: `1`
- レガシー候補: `227`

## 2. 現行運用（React）

- `src/misogi/index.html`
  - Vite エントリ（`src/misogi/pages/main.jsx` を起点に React を起動）

## 3. 生成物（編集対象外）

- `src/misogi/dist/index.html`
  - `npm -C src/misogi run build` により生成される成果物

## 4. レガシー候補（カテゴリ別件数）

- `src/corporate/**.html`: `170`
- `src/customer/**.html`: `31`
- `src/partials/**.html`: `23`
- `src/layouts/**.html`: `2`
- `src/404.html`: `1`

## 5. `src/misogi` 内レガシーHTMLの退避（実施済み）

以下4件は React ルーター運用の現行導線では未使用だったため、`archive/legacy_html` へ退避済み。

- `archive/legacy_html/src/misogi/pages/jobs/sales/entrance/index.html`
- `archive/legacy_html/src/misogi/pages/jobs/sales/entrance/detail.html`
- `archive/legacy_html/src/misogi/pages/jobs/sales/entrance/new.html`
- `archive/legacy_html/src/misogi/pages/jobs/sales/entrance/[id].html`

## 6. `src/pages` レガシーHTMLの退避（実施済み）

- `src/pages` ディレクトリを `archive/legacy_html/src/pages` へ退避
- 件数: `119 files`（主に静的HTMLテンプレート）

## 7. 運用方針（推奨）

- React本体は `src/misogi` を継続
- レガシーHTMLは削除せず、段階的に `archive/legacy_html/` へ退避
- 新規実装は `.html` を増やさず React 側へ集約
