# v2 をメイン UI とする方針

## 方針
- **メイン UI** は `src/misogi`（v2）とする。
- 新規画面・改修は v2 を優先する。
- 他のページ（静的 HTML 等）は段階的に v2 のディレクトリ・ファイルに統合していく。

## 本番
- **URL（トップ＝Portal）**: https://misesapo.co.jp/v2/ または https://misesapo.co.jp/v2/#/
- **Portal**: misogi のトップページ（ジョブ選択の玄関）。`/` で表示。`/portal` は `/` へリダイレクト。
- デプロイ: `main` にプッシュすると GitHub Actions で v2 をビルドし `public/v2/` に出力して GitHub Pages にデプロイする。

## ローカル開発
```bash
cd src/misogi
npm install
npm run dev
```
→ http://localhost:3333/v2/

## 参照
- AGENTS.md「UI base (v2)」
- misogi/README.md
