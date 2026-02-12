# ICS vs Service Master Analysis (Draft)

この分析は Google Calendar `basic.ics` の過去情報から抽出した作業メニューを、DynamoDB `service` マスタに照合して集計したものです。

前提/注意:
- ここでの `total_price_proxy` は `default_price` を1回発生ごとに加算したもの（原価ではなく金額の代理指標）
- 予定の本文は自由記述なので、照合は **ルール + 部分一致** の暫定
- 未マッチ作業は `docs/spec/ics_unmatched_tasks.csv` に上位200を出力

## Inputs
- ICS: `/Users/sakuradamasaru/Downloads/basic.ics`
- service export: `docs/spec/service_master_export.json`
- services loaded (jotai=yuko): 3
- events (total): 1629
- events (filtered): 659

## View 1: Frequency (most frequent matched services)
- cleaning_regular 定期清掃 (count=173, price=30000, duration=120)

## View 2: Cost Proxy (highest total_price_proxy)
- cleaning_regular 定期清掃 (total_price_proxy=5190000.0, price=30000, count=173)

## Unmatched (top 30)
- 害虫駆除 (count=55)
- 排気/換気口清掃（年1 10月） 1 (count=39)
- ゴミ回収（毎日） 1 (count=37)
- 粗大ゴミ回収 実費請求 1 (count=36)
- レンジフード清掃 (count=30)
- ホール床清掃 (count=30)
- ネズミ駆除 (count=29)
- エアコン清掃 (count=27)
- キッチン床清掃（半年 10月 5月） 1 (count=27)
- 厨房床洗浄 (count=26)
- 床清掃 (count=17)
- 気になったところ丸っと清掃する。 (count=16)
- エアコンフィルター清掃（毎月） (count=16)
- 害虫駆除（毎月） 1 (count=16)
- トイレ洗浄 (count=15)
- カーペット洗浄 (count=15)
- 上引 ロースター清掃 (count=15)
- 害虫駆除（毎月） (count=15)
- 厨房機器洗浄（ゴミの掻き出し） (count=14)
- ネズミ駆除（毎月） (count=14)
- 厨房床清掃 (count=14)
- ホール床清掃（半年 10月 5月） 1 (count=14)
- エアコン分解洗浄（年1 10月）（天カセ6台/ビルトイン1台） 7 (count=14)
- ごみ回収（毎日） (count=14)
- 粗大ごみ回収（実費請求） (count=14)
- アポイント形式：対面 (count=13)
- 換気扇洗浄 (count=13)
- エアコン分解洗浄（年1 10月）（天カセ） 6 (count=13)
- レンジフード（グリスフィルター） (count=12)
- 天井埃取り (count=12)

## Outputs
- CSV (matched): `docs/spec/ics_service_frequency_and_cost.csv`
- CSV (unmatched): `docs/spec/ics_unmatched_tasks.csv`
