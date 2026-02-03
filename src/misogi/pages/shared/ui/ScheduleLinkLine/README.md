# ScheduleLinkLine

カード内で「2点＋実線＋-7dラベル」により、**同一案件の工程連結**を可視化するコンポーネント。

## 3点セット（説明ゼロで伝えるコツ）

線だけだと「何の線？」になるため、必ず次の3点をセットにする：

1. **-7d（または 7日前）ラベル** … 線の中央
2. **両端に日付** … 例: 2/5 と 2/12
3. **役割名** … 事前連絡 / 清掃当日（上下 or 左右）

これで「一週間前」が視覚で伝わる。

## レイアウト

- **縦型（SP・640px以下）**: 縦スクロールUIと相性◎  
  ● 事前連絡  2/5(木) 期限  [未連絡]  
  │───────────────  -7d  
  ● 清掃当日  2/12(木) 09:00  [予定]

- **横型（PC）**: カード幅があるとき  
  [ 2/5 事前連絡 ] ●──────── -7d ────────● [ 2/12 清掃 09:00 ]

## 使用例

```jsx
import ScheduleLinkLine from '../shared/ui/ScheduleLinkLine/ScheduleLinkLine';

<ScheduleLinkLine
  contactDueISO={schedule.contact_due_at.slice(0, 10)}
  workISO={schedule.work_start_at.slice(0, 10)}
  contactStatusLabel="未連絡"
  workStatusLabel="予定"
  workTime="09:00"
  contactDone={false}
  within48h={false}
/>
```

## Props

| Prop | 型 | 既定 | 説明 |
|------|-----|------|------|
| contactDueISO | string | - | 事前連絡期限 "YYYY-MM-DD" |
| workISO | string | - | 清掃当日 "YYYY-MM-DD" |
| contactLabel | string | "事前連絡" | 左/上ラベル |
| workLabel | string | "清掃当日" | 右/下ラベル |
| contactStatusLabel | string | - | ノード横 [未連絡] 等 |
| workStatusLabel | string | - | ノード横 [予定] 等 |
| workTime | string | - | 清掃時刻 "09:00" 等 |
| contactDone | boolean | true | false で中央「要連絡」・●を空丸に |
| within48h | boolean | false | true で線・バッジに ⚠ |
