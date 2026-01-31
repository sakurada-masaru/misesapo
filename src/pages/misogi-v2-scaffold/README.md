# MISOGI V2 Scaffold

## Start
npm install
npm run dev

Open:
http://localhost:5173/v2/

## レイアウト方針
ルート直下（`package.json` / `vite.config.js` / `index.html` / `package-lock.json` 等）にファイルが増えると散らかる。  
**新規追加はサブフォルダへ**: 設定は `config/`（env テンプレは `config/.env.example`）、スクリプトは `scripts/`、ドキュメントは `docs/` に置き、ルートを増やさない。
