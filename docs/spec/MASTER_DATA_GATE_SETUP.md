# Master Data Gate Setup (torihikisaki/yagou/tenpo/souko)

## 目的
データ本体は後で投入する前提で、先に「器（API/UI/ID規約）」と「道（投入手順）」を固定する。

## 固定仕様
- ドメイン: `torihikisaki -> yagou -> tenpo -> souko`
- 状態: `jotai = yuko | torikeshi`
- 削除: 物理削除なし（DELETE = torikeshi）
- 名前: 全テーブル `name`

## API（前提）
- `GET/POST /master/torihikisaki`
- `GET/PUT/DELETE /master/torihikisaki/{torihikisaki_id}`
- `GET/POST /master/yagou`
- `GET/PUT/DELETE /master/yagou/{yagou_id}`
- `GET/POST /master/tenpo`
- `GET/PUT/DELETE /master/tenpo/{tenpo_id}`
- `GET/POST /master/souko`
- `GET/PUT/DELETE /master/souko/{souko_id}`

## UI（実装済み）
- `/admin/master/torihikisaki`
- `/admin/master/yagou`
- `/admin/master/tenpo`
- `/admin/master/souko`

## テンプレート
- `docs/spec/templates/torihikisaki_template.csv`
- `docs/spec/templates/yagou_template.csv`
- `docs/spec/templates/tenpo_template.csv`
- `docs/spec/templates/souko_template.csv`

## 最小投入順
1. `torihikisaki`
2. `yagou`
3. `tenpo`
4. `souko`

## 重要
- `yotei.tenpo_id` と `master/tenpo.tenpo_id` を一致させること。
- 一致しないと `/admin/yotei` で店舗名が表示されない。
