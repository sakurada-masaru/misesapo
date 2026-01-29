# 業務報告 状態遷移図（実装準拠）

`universal_work_reports.py` の状態マシンに基づく。Worker = 作業者、事務 = 管理者（Admin）。

---

## 状態一覧

| 状態 | 値 | 説明 |
|------|-----|------|
| 下書き | draft | 編集可能。Worker が提出すると submitted へ。 |
| 提出済 | submitted | 事務の操作待ち。受付／承認／差戻しが可能。 |
| 受付済 | triaged | 事務が「受付」した状態。承認／差戻しが可能。 |
| 承認済 | approved | 確定。編集・遷移不可（state_locked）。PDF 出力可。 |
| 差戻し | rejected | Worker が修正して再提出する想定。Worker が PUT で draft に戻せる。 |
| アーカイブ | archived | 終了扱い。編集・遷移不可（state_locked）。 |
| 取消 | canceled | 編集・遷移不可（state_locked）。 |

---

## 遷移図（テキスト）

```
                    ┌─────────────┐
                    │   draft     │ 下書き
                    └──────┬──────┘
                           │
              Worker 提出   │  (PATCH/PUT → submitted)
                           ▼
                    ┌─────────────┐
                    │  submitted  │ 提出済
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │ 事務 受付        │ 事務 承認        │ 事務 差戻し
         │ to=triaged       │ to=approved     │ to=rejected (reason必須)
         ▼                 ▼                 ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │   triaged   │   │  approved   │   │  rejected    │
  │   受付済     │   │  承認済      │   │  差戻し      │
  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
         │                 │                 │
         │ 事務 承認        │ 事務 アーカイブ   │ Worker PUT
         │ 差戻し          │ to=archived     │ (編集して state=draft)
         ▼                 ▼                 ▼
  ┌─────────────┐   ┌─────────────┐         │
  │  approved   │   │  archived   │         │
  │  rejected   │   │  アーカイブ  │         │
  └─────────────┘   └─────────────┘         │
                                              │
                    ┌─────────────┐           │
                    │   draft     │◀──────────┘
                    └─────────────┘
```

---

## 遷移ルール（実装どおり）

| 誰 | 操作 | 遷移 |
|----|------|------|
| **Worker** | 提出 | draft → **submitted**（のみ許可） |
| **Worker** | PUT で保存（既存が rejected のとき） | rejected → **draft**（修正して再提出する流れ） |
| **事務** | 受付 | submitted → **triaged**（submitted からのみ） |
| **事務** | 承認 | submitted または triaged → **approved** |
| **事務** | 差戻し（理由必須） | submitted または triaged → **rejected** |
| **事務** | アーカイブ | ※ to=archived は BE で許可。運用上は approved からが想定。FE には現状ボタンなし。 |

**出られない状態（state_locked）**: approved / archived / canceled → いずれの遷移も不可。

---

## 画面・API との対応

| 画面・入口 | URL / API | 主な操作 |
|------------|-----------|----------|
| 事務：業務報告一覧・詳細 | https://misesapo.co.jp/office/work-reports/ | 一覧表示、行クリックで詳細、受付／承認／差戻し、PDF（approved + CLEANING_PDF） |
| API 一覧 | GET /admin/work-reports | 一覧取得 |
| API 状態更新 | PATCH /admin/work-reports/{id}/state | to=triaged \| approved \| rejected \| archived、rejected 時は reason 必須 |
| Worker：報告入力・提出 | /work-report（Worker 向け） | PUT で下書き保存、PATCH で submitted に提出、差戻し後に PUT で draft に戻して修正 |

---

※ 詳細な 409 reason は `P6_REQUEST_P6_UNIFIED.md` および `universal_work_reports.py` の `_admin_409` を参照。
