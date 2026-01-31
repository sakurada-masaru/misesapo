# v2 をメイン UI とする方針

## 方針
- **メイン UI** は `src/misogi`（v2）とする。
- 新規画面・改修は v2 を優先する。
- 他のページ（静的 HTML 等）は段階的に v2 のディレクトリ・ファイルに統合していく。

## 本番

### URL（トップ＝Portal）
- **https://misesapo.co.jp/misogi/** または **https://misesapo.co.jp/misogi/#/**
- Portal は misogi のトップ（ジョブ選択の玄関）。`/portal` は `/` へリダイレクト。

### 本番運用する手順（Portal を本番で見せる）

1. **変更をコミットする**  
   必要なファイル（`src/misogi`、`.github/workflows/pages.yml`、CNAME 等）をコミットする。

2. **`main` にプッシュする**  
   GitHub Desktop の「Push origin」または `git push origin main`。

3. **GitHub Actions の実行を待つ**  
   - リポジトリの **Actions** タブを開く。  
   - 「Deploy to GitHub Pages」ワークフローが自動で走る。  
   - **build** → **deploy** が緑で完了するまで待つ（数分）。

4. **本番 URL を開く**  
   **https://misesapo.co.jp/misogi/** を開く。Portal が表示されれば本番運用できている。

### 前提条件
- リポジトリに **CNAME**（中身: `misesapo.co.jp`）があること。  
- GitHub の **Settings → Pages** で Source が **GitHub Actions** になっていること。  
- （API を使う場合）リポジトリの **Variables** で `VITE_API_BASE` を設定していると、本番用 API が使われる。

## ローカル開発
```bash
cd src/misogi
npm install
npm run dev
```
→ http://localhost:3333/misogi/

## 参照
- AGENTS.md「UI base (v2)」
- misogi/README.md
