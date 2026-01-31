# app/ の構成

- **router.jsx** … ルーティング定義（basename /misogi）
- **App.jsx** … アプリ骨格（共通ナビ・Router）

## 大前提（ナビゲーション）

- **Portal** = ジョブを選ぶシステムの玄関
- **エントランス** = 各部署の窓口
- **各部署のホットバーはエントランスになくてはならない**（ジョブ切替はエントランスから行う）

## ホットバー

**ジョブチェンジホットバー**（ハンバーガーメニュー）: Portal / 営業 / 清掃 / 事務 / 開発 / **管理**（→ 管理エントランス） / 管理 TOP / HR / 営業カルテ

**ホットバー4枠の定義（固定）**: 1=ターゲット / 2=ステータス / 3=プラン / 4=**報告**（属性は報告で統一。ラベルはジョブで変わるだけ）

URL（V2配下）:
- `/misogi/` または `/misogi/#/` → Misogi Portal（トップ・認証仮・業務開始意思表示・Job選択）
- `/misogi/#/portal` → `/` へリダイレクト（Portal と同じ）
- `/misogi/#/jobs/:job/entrance` → Job Entrance（sales|cleaning|office|dev）
- `/misogi/#/admin/entrance` → 管理エントランス
- `/misogi/#/admin` → 管理 TOP
- `/misogi/#/admin/hr/attendance` → HR Attendance（Placeholder）
