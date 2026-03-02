# コーポレートページ用モジュール

`src/corporate/pages/` 以下のどの階層のページからも、ここにある HTML を共通パーツとして読み込めます。

**読み込み方法**: `@include` は使わず、**JavaScript で取得して差し込む方式**です。

---

## normal-header-hamburger（ハンバーガーヘッダー）

### ファイル配置

| 役割 | パス |
|------|------|
| ヘッダーHTML（ソース） | `src/corporate/pages/module/normal-header-hamburger.html` |
| ビルド後の配信用 | ビルドで `public/module/normal-header-hamburger.html` にコピーされる |
| CSS | `public/css/normal-header-hamburger.css` |
| JS（取得・差し込み・初期化） | `public/js/normal-header-hamburger.js` |

### ページに書く内容

**1. head 内（CSS）**

```html
<link rel="stylesheet" href="/css/header.css">
<link rel="stylesheet" href="/css/normal-header-hamburger.css">
```

**2. body の先頭（プレースホルダー）**

```html
<body>
    <div id="normal-header-mount" data-src="module/normal-header-hamburger.html"></div>

    <main>
        ...
```

- `data-src` は配信時の URL 相対パス（`<base>` と組み合わせて解決されます）。
- 同じ書き方で、`area-info.html` や `lp/fan-belt.html` など階層が違うページでもそのまま使えます。

**3. body 末尾（JS）**

```html
    <script src="/js/header.js"></script>
    <script src="/js/normal-header-hamburger.js"></script>
</body>
```

### 動作の流れ

1. ビルド（`python scripts/build.py`）で `src/corporate/pages/module/*.html` が `public/module/` にコピーされる。
2. 表示時、`normal-header-hamburger.js` が `#normal-header-mount` と `data-src` を参照。
3. `data-src` の URL を fetch し、取得した HTML をプレースホルダー内に差し込む。
4. 差し込んだヘッダー内のリンク・画像に GitHub Pages 用のパス解決を適用。
5. ハンバーガーメニュー（開閉）の初期化を行う。

### ビルド

```bash
python scripts/build.py
```

実行すると、`public/module/normal-header-hamburger.html` が生成され、配信時に JS から読み出せます。
