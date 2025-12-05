# EC2からスケジュールデータを取得する方法

## 現在の状況

- EC2インスタンス: `i-0db77d6fe8de2e5d1` (52.192.10.204)
- キーペア: `misesapo` (存在確認済み)
- SSHキーファイル: 見つかりません

## データ取得の方法

### 方法1: EC2にSSH接続して手動でエクスポート（推奨）

1. **SSHキーを確認**
   - キーペア名: `misesapo`
   - このキーペアの秘密鍵ファイル（`.pem`）を探してください
   - 通常は `~/.ssh/misesapo.pem` または `~/.ssh/misesapo-key.pem` にあります

2. **EC2に接続**
   ```bash
   ssh -i ~/.ssh/misesapo.pem ec2-user@52.192.10.204
   ```

3. **EC2上でデータをエクスポート**
   ```bash
   # EC2上で実行
   mysql -u root -p misesapo << EOF > /tmp/schedules_export.json
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
   ORDER BY scheduled_date, scheduled_time;
   EOF
   
   # JSON形式に変換（EC2上にPython3がある場合）
   python3 -c "
   import sys, json, csv
   reader = csv.DictReader(sys.stdin, delimiter='\t')
   schedules = [row for row in reader]
   print(json.dumps(schedules, indent=2, ensure_ascii=False, default=str))
   " < /tmp/schedules_export.json > /tmp/schedules.json
   ```

4. **データをダウンロード**
   ```bash
   # ローカルマシンで実行
   scp -i ~/.ssh/misesapo.pem ec2-user@52.192.10.204:/tmp/schedules.json ./schedules_export.json
   ```

5. **DynamoDBにインポート**
   ```bash
   python3 scripts/fetch_schedules_simple.py schedules_export.json
   ```

### 方法2: データベース接続情報を提供

以下の情報を提供していただければ、別の方法でデータを取得できます：

- データベース名
- ユーザー名
- パスワード
- テーブル名

### 方法3: エクスポートスクリプトをS3にアップロード

1. **スクリプトをS3にアップロード**（完了済み）
   ```bash
   aws s3 cp scripts/export_schedules_on_ec2.sh s3://misesapo-data/export_schedules_on_ec2.sh
   ```

2. **EC2上でスクリプトをダウンロードして実行**
   ```bash
   # EC2上で実行
   aws s3 cp s3://misesapo-data/export_schedules_on_ec2.sh /tmp/export_schedules.sh
   chmod +x /tmp/export_schedules.sh
   /tmp/export_schedules.sh > /tmp/schedules.json
   ```

3. **データをダウンロードしてインポート**
   ```bash
   # ローカルマシンで実行
   scp -i ~/.ssh/misesapo.pem ec2-user@52.192.10.204:/tmp/schedules.json ./
   python3 scripts/fetch_schedules_simple.py schedules.json
   ```

## 次のステップ

SSHキーファイル（`misesapo.pem`）の場所を教えていただければ、自動でデータを取得してインポートします。



