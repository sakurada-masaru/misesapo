# YOTEI 全刷新 実行計画（即時）

## 目的
- 旧 `/schedules` 非依存で、`/yotei` だけで案件作成可能にする。
- UIは現行 `AdminScheduleTimelinePage.jsx` を維持し、I/Oのみ新APIへ差し替える。

## 役割分担
- Codex（私）
  - API/DBスキーマ実装
  - 競合判定・409仕様固定
  - フロントI/O切替と互換処理
- 5.2
  - AWS反映（DynamoDB作成、Lambdaデプロイ、APIGWルート反映）
  - 本番/stg疎通確認
- 5.3
  - 画面検証（作成/更新/取消/重複エラー表示）
  - 回帰確認（既存画面崩れ）
- アンチグラビティ
  - 実データ投入（顧客・従業員・初期予定）
  - 運用テストシナリオ（夜勤/朝勤、重複ケース）

## 最優先AC（Phase1）
1. `POST /yotei` が作成できる（availability依存なし）
2. 重複時は `409` + `error=yotei_conflict` + `conflicts[]`
3. `DELETE /yotei/{id}` は `torikeshi` 論理取消
4. 管理画面I/Oは `/yotei` のみ

## 今日やる順序
1. API仕様固定（完了）
2. Lambda `yotei` CRUD + conflict判定（完了）
3. 管理画面 `/yotei` 切替（完了）
4. torikeshi正規化（完了）
5. AWS反映（5.2担当）
6. 受入テスト5本（5.3担当）
7. 初期データ投入（アンチグラビティ担当）

## 反映手順（5.2）
1. `./scripts/aws/setup_yotei_tables.sh`
2. `./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py`
3. API疎通:
   - `GET /yotei`
   - `POST /yotei`
   - 重複 `POST /yotei` -> `409`

## 検証手順（5.3）
1. 管理画面から新規作成
2. 同一worker重複で保存 -> エラー表示
3. 取消操作 -> `torikeshi`
4. 再作成 -> 成功
