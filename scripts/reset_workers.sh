#!/bin/bash

# workersテーブルをリセットして、新しいIDで20名の従業員を登録するスクリプト

TABLE_NAME="workers"

echo "=== Step 1: 既存のworkersデータを削除 ==="

# 既存のIDを取得して削除
for id in $(aws dynamodb scan --table-name $TABLE_NAME --projection-expression "id" --query "Items[].id.S" --output text); do
  echo "Deleting: $id"
  aws dynamodb delete-item --table-name $TABLE_NAME --key "{\"id\": {\"S\": \"$id\"}}"
done

echo ""
echo "=== Step 2: 新しい従業員を登録 ==="

# 現在時刻
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 従業員データを登録する関数
register_worker() {
  local id=$1
  local name=$2
  local email=$3
  local department=$4
  local role=$5
  local role_code=$6
  
  echo "Registering: $id - $name ($email)"
  
  aws dynamodb put-item --table-name $TABLE_NAME --item "{
    \"id\": {\"S\": \"$id\"},
    \"name\": {\"S\": \"$name\"},
    \"email\": {\"S\": \"$email\"},
    \"department\": {\"S\": \"$department\"},
    \"role\": {\"S\": \"$role\"},
    \"role_code\": {\"S\": \"$role_code\"},
    \"status\": {\"S\": \"active\"},
    \"phone\": {\"S\": \"\"},
    \"scheduled_start_time\": {\"S\": \"09:00\"},
    \"scheduled_end_time\": {\"S\": \"18:00\"},
    \"scheduled_work_hours\": {\"N\": \"8\"},
    \"created_at\": {\"S\": \"$TIMESTAMP\"},
    \"updated_at\": {\"S\": \"$TIMESTAMP\"}
  }"
}

# 20名の従業員を登録
# role_code: 1=admin, 2=sales, 3=cleaner, 4=office, 5=developer

register_worker "W001" "遠藤虹輝" "endo@misesapo.co.jp" "現場清掃" "cleaner" "3"
register_worker "W002" "梅岡アレサンドレユウジ" "umeoka@misesapo.co.jp" "営業" "sales" "2"
register_worker "W003" "中島郁哉" "nakajima@misesapo.co.jp" "現場清掃" "cleaner" "3"
register_worker "W004" "板橋隆二" "itabashi@misesapo.co.jp" "現場清掃" "cleaner" "3"
register_worker "W005" "吉井奎吾" "yoshii@misesapo.co.jp" "現場清掃" "cleaner" "3"
register_worker "W006" "佐々木一真" "sasaki@misesapo.co.jp" "現場清掃" "cleaner" "3"
register_worker "W007" "大野幹太" "ono@misesapo.co.jp" "現場清掃" "cleaner" "3"
register_worker "W008" "平鋭未" "taira@misesapo.co.jp" "営業" "sales" "2"
register_worker "W009" "沖智弘" "oki@misesapo.co.jp" "営業" "sales" "2"
register_worker "W010" "北野康平" "okitano@misesapo.co.jp" "現場清掃" "cleaner" "3"
register_worker "W011" "熊谷円" "kumagai@misesapo.co.jp" "営業事務" "office" "4"
register_worker "W012" "増田優香" "masuda@misesapo.co.jp" "営業事務" "office" "4"
register_worker "W013" "生井剛" "namai@misesapo.co.jp" "営業" "sales" "2"
register_worker "W014" "太田真也" "ota@misesapo.co.jp" "開発" "developer" "5"
register_worker "W015" "桜田傑" "sakurada@misesapo.co.jp" "開発" "developer" "5"
register_worker "W016" "正田和輝" "frappe.manma@gmail.com" "運営" "admin" "1"
register_worker "W017" "岡本涼子" "okamoto@misesapo.co.jp" "営業事務" "office" "4"
register_worker "W018" "山村明広" "yamamura@misesapo.co.jp" "開発" "developer" "5"
register_worker "W019" "夏目倫之助" "natsume@misesapo.co.jp" "開発" "developer" "5"
register_worker "W020" "竹内那海" "takeuchi@misesapo.co.jp" "開発" "developer" "5"

echo ""
echo "=== 完了！ ==="
echo "登録された従業員数: $(aws dynamodb scan --table-name $TABLE_NAME --select COUNT --query 'Count')"


