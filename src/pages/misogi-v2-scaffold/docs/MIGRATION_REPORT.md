# MISOGI V2 ディレクトリ整理 レポート

## 変更点一覧

| 項目 | 内容 |
|------|------|
| **Jobs 配下** | `jobs/*/shared/` を削除。entrance のみ残す構成に統一。 |
| **Admin / Portal** | `admin/components/`, `portal/components/` を削除。 |
| **Router** | 手動マッピングを廃止し、`import.meta.glob('../jobs/*/entrance/Page.jsx')` で動的解決に変更。 |
| **URL** | `/entrance/:job` → `/jobs/:job/entrance` に変更。 |
| **リンク** | Portal・App 内の Job Entrance リンクを `/jobs/:job/entrance` に統一。 |

---

## 移動／削除したパス一覧

### 削除したファイル

- `src/jobs/sales/shared/index.js`
- `src/jobs/cleaning/shared/index.js`
- `src/jobs/office/shared/index.js`
- `src/jobs/dev/shared/index.js`
- `src/admin/components/index.js`
- `src/portal/components/index.js`

### 削除したディレクトリ（中身削除により空になったもの）

- `src/jobs/sales/shared/`
- `src/jobs/cleaning/shared/`
- `src/jobs/office/shared/`
- `src/jobs/dev/shared/`
- `src/admin/components/`
- `src/portal/components/`

### 移動

- なし（削除・修正のみ）

---

## 修正した import 一覧

### router.jsx

| 変更前 | 変更後 |
|--------|--------|
| `import SalesPage from '../jobs/sales/entrance/Page'` 等の手動 import 4件 | 削除。`import.meta.glob('../jobs/*/entrance/Page.jsx')` で動的解決。 |
| `Route path="/entrance/:job"` | `Route path="/jobs/:job/entrance"` |
| `const pages = { sales: SalesPage, ... }; const PageComponent = pages[job]` | `const Page = lazyPages[job]` + `React.lazy(pageModules[path])` + `Suspense` |

### portal/pages/Portal.jsx

| 変更前 | 変更後 |
|--------|--------|
| `navigate(\`/entrance/${job}\`)` | `navigate(\`/jobs/${job}/entrance\`)` |
| `to={\`/entrance/${key}\`}` | `to={\`/jobs/${key}/entrance\`}` |

### app/App.jsx

| 変更前 | 変更後 |
|--------|--------|
| `to="/entrance/sales"` | `to="/jobs/sales/entrance"` |
| `to="/entrance/cleaning"` | `to="/jobs/cleaning/entrance"` |

### app/README.md

| 変更前 | 変更後 |
|--------|--------|
| `/v2/entrance/:job` | `/v2/jobs/:job/entrance` |

---

## 正解ディレクトリ構成（作業後）

```
src/
├ app/
│   ├ App.jsx
│   └ router.jsx
│
├ portal/
│   └ pages/
│       └ Portal.jsx
│
├ jobs/
│   ├ sales/
│   │   └ entrance/
│   │       ├ Page.jsx
│   │       └ hotbar.config.js
│   ├ cleaning/
│   │   └ entrance/
│   │       ├ Page.jsx
│   │       └ hotbar.config.js
│   ├ office/
│   │   └ entrance/
│   │       ├ Page.jsx
│   │       └ hotbar.config.js
│   └ dev/
│       └ entrance/
│           ├ Page.jsx
│           └ hotbar.config.js
│
├ admin/
│   └ pages/
│       ├ Home.jsx
│       └ hr/
│           └ Attendance.jsx
│
├ shared/
│   ├ ui/
│   │   ├ Hotbar/
│   │   ├ Visualizer/
│   │   └ JobEntranceScreen.jsx
│   ├ styles/
│   ├ utils/
│   ├ auth/
│   └ api/
│
└ main.jsx
```

※ shared 配下は「正解」に ui（Hotbar / Visualizer）を明示。styles / utils / auth / api は既存のまま（アプリ動作に必要のため維持）。

---

## ビルド・起動確認

- `npm run build` … 成功
- ルート `/jobs/:job/entrance` で job から Page を動的解決
- 存在しない job は 404 表示
