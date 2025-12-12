#!/bin/bash
# EC2インスタンス上で実行するスクリプト
# S3からダウンロードして実行するか、EC2上で直接実行

# S3からスクリプトをダウンロード（IAMロールが設定されている場合）
if command -v aws &> /dev/null; then
    aws s3 cp s3://misesapo-data/export_schedules_on_ec2.sh /tmp/export_schedules.sh 2>/dev/null
    if [ -f /tmp/export_schedules.sh ]; then
        chmod +x /tmp/export_schedules.sh
        /tmp/export_schedules.sh > /tmp/schedules_export.json
        echo "データをエクスポートしました: /tmp/schedules_export.json"
        
        # S3にアップロード（オプション）
        aws s3 cp /tmp/schedules_export.json s3://misesapo-data/schedules_export.json 2>/dev/null && echo "S3にアップロードしました"
    fi
fi

# または、直接MySQLからエクスポート
if [ -f /var/www/html/.env ]; then
    source <(grep DB_ /var/www/html/.env | sed 's/^/export /')
elif [ -f ~/.env ]; then
    source <(grep DB_ ~/.env | sed 's/^/export /')
fi

DB_HOST=${DB_HOST:-localhost}
DB_DATABASE=${DB_DATABASE:-misesapo}
DB_USERNAME=${DB_USERNAME:-root}
DB_PASSWORD=${DB_PASSWORD:-}

mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" << EOF | python3 -c "
import sys, json, csv
reader = csv.DictReader(sys.stdin, delimiter='\t')
schedules = [row for row in reader]
print(json.dumps(schedules, indent=2, ensure_ascii=False, default=str))
" > /tmp/schedules_export.json
SELECT 
    id,
    store_id,
    store_name,
    scheduled_date,
    scheduled_time,
    worker_id,
    worker_name,
    status,
    notes,
    created_at,
    updated_at
FROM service_jobs
WHERE scheduled_date >= CURDATE()
ORDER BY scheduled_date, scheduled_time
LIMIT 1000;
EOF

echo "データをエクスポートしました: /tmp/schedules_export.json"
cat /tmp/schedules_export.json












