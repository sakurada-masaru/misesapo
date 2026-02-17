# コーポレートページ用モジュール

`src/corporate/pages/` 以下のどの階層のページからも、ここにある HTML を共通パーツとして読み込めます。

## normal-header-hamburger（ハンバーガーヘッダー）

### ファイル配置

```
src/corporate/pages/
└── module/
    └── normal-header-hamburger.html   ← ヘッダーHTML
```

※ CSS は `public/css/normal-header-hamburger.css`、JS は `public/js/normal-header-hamburger.js` を参照します。

### 読み込み形式（相対パス）

どのページ（`area-info.html` / `lp/fan-belt.html` / `event/2026_yakiniku.html` など）からも **同じ1行** で読み出します。

```html
@include('module.normal-header-hamburger')
```

- ドット（`.`）がフォルダの区切りになります。
- `module.normal-header-hamburger` → `module/normal-header-hamburger.html` として、ビルド時に `src/corporate/pages/module/normal-header-hamburger.html` が解決されます（`scripts/build.py` の `resolve_include` で `CORPORATE_PAGES_DIR` を参照）。

### ページに書く内容

ヘッダーを出すページでは、次の3つを追加してください。

**1. head 内（CSS）**

```html
<link rel="stylesheet" href="/css/header.css">
<link rel="stylesheet" href="/css/normal-header-hamburger.css">
```

**2. body の先頭（HTML）**

```html
<body>
    @include('module.normal-header-hamburger')

    <main>
        ...
```

**3. body 末尾（JS）**

```html
    <script src="/js/header.js"></script>
    <script src="/js/normal-header-hamburger.js"></script>
</body>
```

### ビルド

```bash
python scripts/build.py
```

実行後、`@include('module.normal-header-hamburger')` が `normal-header-hamburger.html` の内容に置き換わり、出力 HTML に埋め込まれます。
