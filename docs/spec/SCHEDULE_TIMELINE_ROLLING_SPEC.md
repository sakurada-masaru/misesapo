# 📌 Cursor 指示書（再構築・確定版）— スケジュールタイムライン

> これを貼ればOKな最終指示書。

---

## ⚠️ Cursorに一言足すべき注意（超重要）

- **Dock右側に渡す reportId は `schedule_id` ではない可能性が高い。**
- まず `selectedAppt` の実データ（`console.log`）で **`report_id` / `work_report_id`** があるか確認する。
- 無ければ **「報告未作成」** と表示すること。
- **Rolling8日（今日固定＋未来7日）** と **Karte Dock常設** は必須。
- Dockの reportId は **`report_id` 優先**。無い場合は「未作成」表示にする。
- **既存のモーダル/詳細表示は開かない。** クリックは **Dock更新に統一** する。

---

## 🎯 目的（最重要）

- 週表示を「**固定週**」ではなく **ローリング8日（今日＋7日）** に変更する
- 左端は常に「**今日**」カラムとして固定・強調する
- 日付は毎日 **右→左** に自動でスライドする
- 案件クリックで下部に **カルテDock** を常設表示する
- Dockは **左30% / 右70%**（既存業務報告UI）

---

## ① ローリング8日表示の実装

### A. 週配列を「今日基準」で再生成する

`AdminScheduleTimelinePage.jsx` で `weekDayIsos` / `weekDates` を作っている箇所を修正。

**置き換え：**

```js
import dayjs from "dayjs";

const base = dayjs().startOf("day");

const rollingDays = useMemo(() => {
  return Array.from({ length: 8 }, (_, i) =>
    base.add(i, "day").format("YYYY-MM-DD")
  );
}, []);
```

### B. 描画ループを rollingDays に変更

**すべて：**

- `weekDayIsos.map(...)`  
  **↓**  
- `rollingDays.map(...)`

---

## ② 当日カラムを固定する

### A. 左端ラッパーを追加

週グリッドの構造を以下に変更：

```jsx
<div className="rollingWeekGrid">
  {/* 今日固定 */}
  <div className="todayColumn">
    {renderDayColumn(rollingDays[0], true)}
  </div>

  {/* 未来スクロール */}
  <div className="futureColumns">
    {rollingDays.slice(1).map(d =>
      renderDayColumn(d, false)
    )}
  </div>
</div>
```

※ `renderDayColumn` は既存の1日描画ロジックを関数化する。

### B. CSS：固定化

```css
.admin-schedule-timeline-page .rollingWeekGrid {
  display: grid;
  grid-template-columns: auto 1fr;
}

.admin-schedule-timeline-page .todayColumn {
  position: sticky;
  left: 0;
  z-index: 20;
  background: #0b1020;
  border-right: 2px solid #3a6cff;
}

.admin-schedule-timeline-page .futureColumns {
  display: grid;
  grid-template-columns: repeat(7, minmax(220px, 1fr));
  overflow-x: auto;
}
```

---

## ③ 当日カラムを“誰でも分かる”表示にする

### A. ヘッダーを変更

当日ヘッダー部分を **「今日」＋「2/3（月）」** 形式にする。

```jsx
{isToday && (
  <div className="todayBadge">TODAY</div>
)}
```

### B. CSS強調

```css
.admin-schedule-timeline-page .todayColumn {
  box-shadow: inset -4px 0 0 #3a6cff;
}

.admin-schedule-timeline-page .todayBadge {
  background: #3a6cff;
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}
```

---

## ④ カルテDockを必ず表示させる

### A. reportId を正しく渡す（最重要）

Dock右側は必ず以下を使う：

```js
const reportId =
  selectedAppt?.report_id ??
  selectedAppt?.work_report_id ??
  null;
```

```jsx
{reportId ? (
  <OfficeWorkReportDetailPage reportId={reportId} embed />
) : (
  <div className="kdEmpty">業務報告未作成</div>
)}
```

### B. Dockを常設

「`selectedAppt &&`」で囲まず、**常に描画**する：

```jsx
<section className="karteDock">
  {/* ... */}
</section>
```

未選択時はプレースホルダ表示とする。

---

## ⑤ 既存モーダルを無効化

カードクリック時に：

- `openView(appt)` や `setActiveScheduleId` があれば **削除**
- **Dockに一本化**（クリック＝Dock更新のみ）

---

## ⑥ CSS：画面下が隠れない対策

```css
.admin-schedule-timeline-page {
  padding-bottom: 360px;
}
```

---

## ✅ これで実現される状態

完成すると：

| 左 | 中央 | 右 | 下 |
|---|------|-----|-----|
| 常に今日（青ライン＋TODAY） | 今日の案件 | 未来7日が流れる | 常にカルテ |

- **クリック：即同期**（Dockに反映）
- ＝ 「右端と左端を見る運用」が成立する。

---

## 🎯 最後に（超重要）

今回ズレた原因はこれ：

> Cursorに「**UI部品**」だけ作らせて  
> 「**時間設計（ローリング思想）**」を実装させていない

この指示書は、**思想 → コード** に変換した版。実装時はこの順で適用すること。

---

## 📎 一部ファイル期限切れについて

このチャットにアップ済みの **SCHEDULE_TIMELINE_ROLLING_SPEC.md** は使えているが、以前アップした別ファイルの一部が期限切れになっている可能性がある。

- Cursor が「**参照ファイルが見つからない**」「**コンポーネントが無い**」と言い出したら、**そのファイルだけ再アップすればOK。**
