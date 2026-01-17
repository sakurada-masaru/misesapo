# 営業 予定作成 ライン対象スケジュール仕様（最小）

## 目的
営業が予定を作成すると、当日、現場の cleaning entrance に「ライン開始」ボタンが表示される状態を成立させる。

## 対象
- 画面: 営業エントランス / 予定
- データ: schedules

## 入力項目（必須）
- 日付
- サービス: cleaning
- 店舗
- 担当者

## 保存
- schedules に新規作成する
- line 対象として扱われる

## schedules.status の作成値
- status は scheduled に固定
- report.status と混在させない

## 作成成功時の画面挙動
- 予定オーバーレイを閉じる
- 作成成功の toast を表示する

## 予定の重複作成
- 同一キーの予定は 409 でブロック
- 同一キーの定義は store_id, scheduled_date, worker_id, service

## テスト
- 正常系: 201 で id が返る
- 重複: 409 でブロックされる

## ライン対象の条件
- service が cleaning
- scheduled_date が当日
- worker_id が担当者に一致
- status は line 対象で扱う値

## API I O
- POST /schedules
- Body 最小例
  - store_id
  - store_name
  - scheduled_date
  - service_id または service_name cleaning
  - worker_id
  - status

## 画面要件
- MISOGI UI の思想は変更しない
- 既存 予定 オーバーレイの中に最小フォームを置く
- 自由記述は追加しない

## 禁止
- Ticket B 仕様と状態機械の変更
- 現場入力の追加
- 自由記述項目の追加
