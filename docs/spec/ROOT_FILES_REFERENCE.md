# ルート直下のファイル参照一覧

ルート直下のファイルについて、「ビルド・CI・デプロイ・他スクリプトから参照されているか」を整理した一覧です。

---

## 使用しているファイル（参照あり）

| ファイル | 参照元・用途 |
|----------|----------------|
| **CNAME** | `scripts/build.py`（base_path 判定）、workflow で public にコピー。GitHub Pages カスタムドメイン用。 |
| **manifest.json** | `scripts/build.py` で public にコピー。PWA 用。 |
| **sw.js** | `scripts/build.py` で public にコピー。Service Worker。 |
| **lambda_function.py** | Lambda 本体。`scripts/deploy_lambda.sh` でデプロイ、多数の docs で言及。 |
| **misogi_flags.py** | `scripts/deploy_lambda.sh` で lambda_package に同梱。 |
| **misogi_schemas.py** | `scripts/deploy_lambda.sh` で lambda_package に同梱。lambda から参照。 |
| **universal_work_reports.py** | `scripts/deploy_lambda.sh` で lambda_package に同梱。lambda_function.py から import。 |
| **requirements.txt** | Lambda 用依存。`scripts/create_google_calendar_layer.sh` 等・docs で言及。 |
| **Dockerfile** | Cloud Run 用。README、`.github/workflows/deploy.yml` で言及。 |
| **.gcloudignore** | gcloud デプロイ時の除外設定。 |
| **AGENTS.md** | プロジェクトルール。Cursor/Codex で参照。 |
| **README.md** | メインのプロジェクト説明。 |
| **.gitignore** | Git の除外設定。 |
| **.cursorrules** | Cursor のプロジェクトルール。 |

---

## 参照されていないファイル（使用していない可能性）

ビルド・CI・デプロイ・他スクリプトから参照されていません。手動運用・ドキュメント用・過去の名残の可能性があります。

| ファイル | 備考 |
|----------|------|
| **apigw_force_patch_s3_upload.py** | API Gateway 用パッチ。どのスクリプト・CI からも参照なし。 |
| **apigw_patch_all_aliases.sh** | 同上。 |
| **apigw_patch_s3_upload_alias.py** | 同上。 |
| **check_apigw_alias.sh** | API Gateway エイリアス確認。参照なし。 |
| **CHANGES.md** | 変更履歴。人間用。 |
| **DEPLOY_HANDOFF.md** | デプロイ引き継ぎ。`docs/DOCUMENTATION_INDEX.md` からリンクのみ。 |
| **HANDOVER.md** | 引き継ぎドキュメント。人間用。 |
| **MISESAPO_CHARTER.md** | チャーター。人間用。 |
| **PRODUCT_DEFINITION.md** | 製品定義。人間用。 |
| **jsconfig.json** | JS プロジェクト設定（IDE 用）。どのスクリプト・CI からも参照なし。 |
| **package.json** / **package-lock.json**（ルート） | 依存 `{}` のみ。workflow は `src/misogi` の package を利用。ルートの npm は未使用の可能性。 |

---

## 誤ってできた可能性のあるファイル

| ファイル | 備考 |
|----------|------|
| **--order-by LastEventTime --descending** | AWS CLI のオプション文字列がファイル名になっている。削除してよい可能性が高い。 |
| **.zip** | 中身が zip の可能性。ルートの `*.zip` は .gitignore 対象。 |

---

## .gitignore で無視されているもの（一覧のみ）

- `public/`（ビルド出力）
- `*.zip`（lambda_deploy.zip 等）
- `lambda_package/`
- `__pycache__/`、`.DS_Store` 等

---

## 運用上の注意

- **参照なし**のファイルは、必要に応じて `docs/` へ退避・アーカイブするか、削除を検討してください。
- **--order-by LastEventTime --descending** は誤作成の可能性が高いため、不要なら削除して問題ありません。
