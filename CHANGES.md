# Changelog (変更履歴)

## Template
- **YYYY-MM-DD**: [変更概要] (by Codex/Jamie)
    - 変更したファイル: `path/to/file`
    - 詳細: ...

## Logs
- **2025-12-26**: Integrated Edit/Create workflow for Customer Karte. (by Jamie)
    - 変更したファイル: `src/pages/admin/customers/karte.html`, `src/assets/js/admin-karte.js`, `src/assets/js/admin-store-chart.js`
    - 詳細: `karte.html` に「編集する」リンクと空状態時の「カルテ登録」ボタンを追加。`admin-store-chart.js` に保存後の `karte.html` への自動リダイレクト処理を実装。
- **2025-12-26**: Fixed dynamic routing for chart.html and reports. (by Jamie)
    - 変更したファイル: `scripts/dev_server.py`
    - 詳細: `translate_path` メソッドを再構成し、`/admin/customers/stores/[id]/chart.html` や `/admin/reports/[id]/edit.html` などの動的パスを正しく解決できるように修正。404エラーを解消。
- **2025-12-26**: Formal Migration of Karte UI to Customer Management. (by Jamie)
    - 変更したファイル: `src/pages/admin/customers/karte.html`, `src/assets/js/admin-customers-v3.js`
    - 詳細: カルテ画面を `admin/users/` から `admin/customers/` へ移動。ボタンテキストやバックリンクを「顧客管理」に合わせて修正。
- **2025-12-26**: Deleted legacy Customer Karte file. (by Jamie)
    - 変更したファイル: `src/pages/admin/users/customers.html` (deleted)
    - 詳細: 新UI移行に伴い、不要となった古いファイルを削除。
- **2025-12-26**: Suppressed date-select warning when elements are absent. (by Codex)
    - 変更したファイル: `src/assets/js/script.js`, `public/js/script.js`
    - 詳細: Date selectが存在しないページでconsole.warnを出さずに処理をスキップ。
- **2025-12-26**: Removed leftover date-select debug log comments. (by Codex)
    - 変更したファイル: `src/assets/js/script.js`, `public/js/script.js`
    - 詳細: 日付選択のデバッグ用consoleログコメントを削除し、完全サイレント化。
- **2025-12-26**: Added single-page build helper. (by Codex)
    - 変更したファイル: `scripts/build_one.py`
    - 詳細: 指定した `src/pages` のHTMLだけ生成し、`src/assets` を同期する軽量ビルドを追加。
- **2025-12-26**: Added minimal build helper. (by Codex)
    - 変更したファイル: `scripts/build_min.py`, `README.md`
    - 詳細: 指定ページと指定アセットのみ生成する最小ビルドを追加。
