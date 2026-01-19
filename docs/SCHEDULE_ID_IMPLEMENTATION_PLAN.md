# スケジュールID管理実装計画書

## 📊 AWS調査結果

### 1. 現在のAWS実装状況

#### Lambda関数（`lambda_function.py`）

**スケジュール作成 (`create_schedule`)**
- **場所**: `lambda_function.py:2520`
- **ID生成**: `uuid.uuid4()` (UUID形式)
- **エンドポイント**: `POST /schedules`
- **処理フロー**:
  1. リクエストボディを取得
  2. `schedule_id = str(uuid.uuid4())` でID生成
  3. 見積もり情報がある場合は見積もりも作成（`schedule_id` を紐付け）
  4. DynamoDBに保存
  5. `schedule_id` をレスポンスで返す

**スケジュール取得 (`get_schedules`)**
- **場所**: `lambda_function.py:2635`
- **エンドポイント**: `GET /schedules`
- **フィルタリング**: `status`, `date`, `assigned_to` でスキャン操作

**スケジュール詳細取得 (`get_schedule_detail`)**
- **場所**: `lambda_function.py:2684`
- **エンドポイント**: `GET /schedules/{schedule_id}`
- **処理**: `SCHEDULES_TABLE.get_item(Key={'id': schedule_id})`

**スケジュール更新 (`update_schedule`)**
- **場所**: `lambda_function.py:2716`
- **エンドポイント**: `PUT /schedules/{schedule_id}`
- **処理**: `SCHEDULES_TABLE.update_item(Key={'id': schedule_id}, ...)`

**スケジュール削除 (`delete_schedule`)**
- **場所**: `lambda_function.py:2794`
- **エンドポイント**: `DELETE /schedules/{schedule_id}`
- **処理**: `SCHEDULES_TABLE.delete_item(Key={'id': schedule_id})`

#### DynamoDBテーブル構造

**schedules テーブル**
- **パーティションキー**: `id` (String型)
- **ソートキー**: なし
- **GSI**:
  - `status-index`: `status` (HASH), `date` (RANGE)
  - `assigned_to-index`: `assigned_to` (HASH), `date` (RANGE)
  - `date-index`: `date` (HASH), `created_at` (RANGE)

**estimates テーブル**
- **パーティションキー**: `id` (String型)
- **GSI**: `schedule_id-index` (HASH: `schedule_id`)
- **関連**: `schedule_id` フィールドでスケジュールと紐付け

### 2. スケジュール作成ルート

#### ルート1: 管理画面 (`/admin/schedules/index.html`)
- **ファイル**: `src/assets/js/admin-schedules.js:743`
- **処理**: 
  - フロントエンドで `DataUtils.IdUtils.generateSchedule()` を呼び出し
  - 現在は `SCH-2025-1125-001` 形式を生成
  - **問題**: バックエンドで無視され、UUID形式で上書きされる

#### ルート2: 営業スケジュール新規作成 (`/sales/schedules/new.html`)
- **ファイル**: `src/pages/sales/schedules/new.html:1034`
- **処理**:
  - フル機能のスケジュール作成（見積もり含む）
  - `POST /schedules` に直接送信
  - **ID生成**: バックエンドに任せる（フロントエンドでは生成しない）
  - **ステータス**: `draft` (仮押さえ)

#### ルート3: 営業ダッシュボード簡易作成 (`/sales/dashboard.html`)
- **ファイル**: `src/pages/sales/dashboard.html:4871`
- **処理**:
  - リマインダー/簡易スケジュール作成
  - `POST /schedules` に直接送信
  - **ID生成**: バックエンドに任せる（フロントエンドでは生成しない）
  - **ステータス**: `scheduled`

### 3. データフロー

```
[管理画面] → generateSchedule() → POST /schedules → [Lambda] → UUID生成 → DynamoDB
[営業新規] → POST /schedules → [Lambda] → UUID生成 → DynamoDB
[営業簡易] → POST /schedules → [Lambda] → UUID生成 → DynamoDB
```

**問題点**: 管理画面で生成したIDが無視される

---

## ⚠️ リスク分析

### リスク1: 既存データとの互換性

**影響範囲**:
- 既存のUUID形式のスケジュールデータが存在する可能性
- `estimates` テーブルの `schedule_id` フィールド

**リスクレベル**: 🔴 高

**対策**:
1. 既存データの確認（本番環境のスキャン）
2. 移行スクリプトの作成
3. 段階的移行（新規データから新形式に移行）

### リスク2: フロントエンドでのID生成

**影響範囲**:
- `admin-schedules.js`: ID生成ロジック
- フロントエンドで生成したIDがバックエンドで無視される

**リスクレベル**: 🟡 中

**対策**:
1. フロントエンドでのID生成を削除
2. バックエンドから返されたIDを使用

### リスク3: 営業ダッシュボードからの作成

**影響範囲**:
- `/sales/schedules/new.html`: フル機能作成
- `/sales/dashboard.html`: 簡易作成

**リスクレベル**: 🟢 低（既にバックエンドに任せている）

**対策**:
1. 既存の実装を確認（問題なし）
2. テストで動作確認

### リスク4: estimatesテーブルの整合性

**影響範囲**:
- `estimates` テーブルの `schedule_id` フィールド
- `schedule_id-index` GSI

**リスクレベル**: 🔴 高

**対策**:
1. 既存の `schedule_id` を新形式に更新
2. GSIの整合性確認

### リスク5: ID生成の競合

**影響範囲**:
- 同時に複数のスケジュールが作成された場合
- 同じ日付で同じ連番が生成される可能性

**リスクレベル**: 🟡 中

**対策**:
1. DynamoDBの条件付き書き込みを使用
2. リトライロジックの実装

### リスク6: パフォーマンス

**影響範囲**:
- `get_max_sequence_for_date()` のスキャン操作
- 大量データがある場合のパフォーマンス低下

**リスクレベル**: 🟡 中

**対策**:
1. 日付でフィルタリングしてスキャン範囲を限定
2. 必要に応じてカウンターテーブルを検討

---

## 🎯 実装計画

### フェーズ1: バックエンド実装（高優先度）

#### ステップ1.1: ID生成関数の実装

**ファイル**: `lambda_function.py`

```python
def generate_schedule_id(date_str):
    """
    スケジュールIDを生成: SCH-YYYYMMDD-NNN
    日付ごとに連番をリセット
    """
    from datetime import datetime
    
    # 日付をYYYYMMDD形式に変換
    if isinstance(date_str, str) and date_str:
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            date_prefix = date_obj.strftime('%Y%m%d')
        except:
            # 日付が無効な場合は現在日付を使用
            date_prefix = datetime.now().strftime('%Y%m%d')
    else:
        date_prefix = datetime.now().strftime('%Y%m%d')
    
    # その日の最大連番を取得
    max_seq = get_max_sequence_for_date(SCHEDULES_TABLE, date_prefix)
    next_seq = max_seq + 1
    
    # 3桁の連番にゼロパディング
    seq_str = str(next_seq).zfill(3)
    
    return f"SCH-{date_prefix}-{seq_str}"

def get_max_sequence_for_date(table, date_prefix):
    """
    指定日付の最大連番を取得
    """
    prefix = f"SCH-{date_prefix}-"
    
    # その日付のIDを持つスケジュールをスキャン
    # 日付でフィルタリングしてスキャン範囲を限定
    try:
        response = table.scan(
            FilterExpression=Attr('id').begins_with(prefix),
            ProjectionExpression='id'
        )
        
        max_seq = 0
        for item in response.get('Items', []):
            schedule_id = item.get('id', '')
            # SCH-YYYYMMDD-NNN から NNN を抽出
            if schedule_id.startswith(prefix):
                seq_str = schedule_id[len(prefix):]
                try:
                    seq = int(seq_str)
                    if seq > max_seq:
                        max_seq = seq
                except:
                    pass
        
        # ページネーション対応
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                FilterExpression=Attr('id').begins_with(prefix),
                ProjectionExpression='id',
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            for item in response.get('Items', []):
                schedule_id = item.get('id', '')
                if schedule_id.startswith(prefix):
                    seq_str = schedule_id[len(prefix):]
                    try:
                        seq = int(seq_str)
                        if seq > max_seq:
                            max_seq = seq
                    except:
                        pass
        
        return max_seq
    except Exception as e:
        print(f"Error getting max sequence: {str(e)}")
        return 0
```

#### ステップ1.2: create_schedule関数の修正

**変更点**:
1. UUID生成を `generate_schedule_id()` に変更
2. 条件付き書き込みによる競合対策を追加
3. リトライロジックの実装

```python
def create_schedule(event, headers):
    """
    スケジュールを作成（見積もりも同時に作成可能）
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # スケジュールIDを生成（新形式: SCH-YYYYMMDD-NNN）
        date_str = body_json.get('date', '')
        schedule_id = generate_schedule_id(date_str)
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 条件付き書き込みで重複を防止（最大5回リトライ）
        max_retries = 5
        retry_count = 0
        schedule_created = False
        
        while retry_count < max_retries and not schedule_created:
            try:
                # 既に存在するIDかチェック
                response = SCHEDULES_TABLE.get_item(Key={'id': schedule_id})
                if 'Item' in response:
                    # IDが存在する場合は連番をインクリメントして再生成
                    schedule_id = generate_schedule_id(date_str)
                    retry_count += 1
                    continue
                
                # 見積もり情報が含まれている場合は、見積もりも同時に作成
                estimate_id = None
                estimate_data = body_json.get('estimate')
                if estimate_data and estimate_data.get('items') and len(estimate_data.get('items', [])) > 0:
                    # 見積もりIDを生成（UUID形式のまま）
                    estimate_id = str(uuid.uuid4())
                    
                    # 見積もり合計を計算
                    estimate_total = estimate_data.get('total', 0)
                    if estimate_total == 0:
                        estimate_total = sum(item.get('price', 0) for item in estimate_data.get('items', []))
                    
                    # 見積もりアイテムを作成
                    estimate_item = {
                        'id': estimate_id,
                        'created_at': now,
                        'updated_at': now,
                        'store_id': body_json.get('client_id'),
                        'store_name': body_json.get('store_name', ''),
                        'items': estimate_data.get('items', []),
                        'total': estimate_total,
                        'notes': estimate_data.get('notes', ''),
                        'status': 'pending',
                        'created_by': body_json.get('created_by', 'sales'),
                        'schedule_id': schedule_id  # 新形式のIDを紐付け
                    }
                    
                    # 見積もりを保存
                    ESTIMATES_TABLE.put_item(Item=estimate_item)
                
                # DynamoDBに保存するアイテムを作成
                schedule_item = {
                    'id': schedule_id,  # 新形式のID
                    'created_at': now,
                    'updated_at': now,
                    'date': body_json.get('date', ''),
                    'time_slot': body_json.get('time_slot', ''),
                    'order_type': body_json.get('order_type', 'regular'),
                    'client_id': body_json.get('client_id'),
                    'client_name': body_json.get('client_name', ''),
                    'store_name': body_json.get('store_name', ''),
                    'address': body_json.get('address', ''),
                    'phone': body_json.get('phone', ''),
                    'email': body_json.get('email', ''),
                    'cleaning_items': body_json.get('cleaning_items', []),
                    'notes': body_json.get('notes', ''),
                    'status': body_json.get('status', 'draft'),
                }
                
                # 見積もりIDを紐付け（存在する場合）
                if estimate_id:
                    schedule_item['estimate_id'] = estimate_id
                
                # GSIキーとなる属性は、値が存在する場合のみ追加
                assigned_to = body_json.get('assigned_to')
                if assigned_to:
                    schedule_item['assigned_to'] = assigned_to
                
                created_by = body_json.get('created_by')
                if created_by:
                    schedule_item['created_by'] = created_by
                
                # 条件付き書き込み（IDが存在しない場合のみ）
                SCHEDULES_TABLE.put_item(
                    Item=schedule_item,
                    ConditionExpression='attribute_not_exists(id)'
                )
                
                schedule_created = True
                
            except SCHEDULES_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
                # 競合が発生した場合は再試行
                schedule_id = generate_schedule_id(date_str)
                retry_count += 1
                if retry_count >= max_retries:
                    raise Exception('スケジュールIDの生成に失敗しました（最大リトライ回数に達しました）')
            except Exception as e:
                raise e
        
        response_body = {
            'status': 'success',
            'message': 'スケジュールを作成しました',
            'schedule_id': schedule_id
        }
        
        # 見積もりも作成した場合は、見積もりIDも返す
        if estimate_id:
            response_body['estimate_id'] = estimate_id
            response_body['message'] = 'スケジュールと見積もりを作成しました'
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response_body, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating schedule: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'スケジュールの作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }
```

#### ステップ1.3: テスト

1. 単体テスト: ID生成関数のテスト
2. 統合テスト: スケジュール作成APIのテスト
3. 競合テスト: 同時作成時の競合対策テスト

---

### フェーズ2: フロントエンド修正（中優先度）

#### ステップ2.1: 管理画面の修正

**ファイル**: `src/assets/js/admin-schedules.js`

**変更点**:
1. ID生成を削除
2. バックエンドから返されたIDを使用

```javascript
// 変更前
if (isNew) {
  data.id = DataUtils.IdUtils.generateSchedule();
  data.created_at = new Date().toISOString();
} else {
  data.id = id;
}

// 変更後
if (isNew) {
  // ID生成はバックエンドに任せる
  // data.id = DataUtils.IdUtils.generateSchedule(); // 削除
  data.created_at = new Date().toISOString();
} else {
  data.id = id;
}

// レスポンス処理の修正
const responseData = await response.json();
const savedSchedule = responseData.schedule || { 
  ...data, 
  id: responseData.schedule_id || responseData.id || id  // バックエンドから返されたIDを使用
};
```

#### ステップ2.2: 営業ダッシュボードの確認

**確認項目**:
- `/sales/schedules/new.html`: 既にバックエンドに任せている（問題なし）
- `/sales/dashboard.html`: 既にバックエンドに任せている（問題なし）

**対応**: テストで動作確認のみ

---

### フェーズ3: 既存データ移行（低優先度・必要に応じて）

#### ステップ3.1: 既存データの確認

**スクリプト**: `scripts/check_existing_schedules.py`

```python
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb')
SCHEDULES_TABLE = dynamodb.Table('schedules')
ESTIMATES_TABLE = dynamodb.Table('estimates')

def check_existing_schedules():
    """
    既存のスケジュールデータを確認
    """
    response = SCHEDULES_TABLE.scan(ProjectionExpression='id')
    
    uuid_count = 0
    new_format_count = 0
    
    for item in response.get('Items', []):
        schedule_id = item.get('id', '')
        if schedule_id.startswith('SCH-'):
            new_format_count += 1
        else:
            uuid_count += 1
    
    print(f"UUID形式: {uuid_count}件")
    print(f"新形式 (SCH-): {new_format_count}件")
    
    return uuid_count, new_format_count

if __name__ == '__main__':
    check_existing_schedules()
```

#### ステップ3.2: 移行スクリプトの作成

**スクリプト**: `scripts/migrate_schedule_ids.py`

```python
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
SCHEDULES_TABLE = dynamodb.Table('schedules')
ESTIMATES_TABLE = dynamodb.Table('estimates')

def migrate_schedule_ids():
    """
    既存のUUID形式のスケジュールIDを新形式に移行
    """
    # 既存のスケジュールを取得
    response = SCHEDULES_TABLE.scan()
    
    migrated_count = 0
    error_count = 0
    
    for item in response.get('Items', []):
        old_id = item.get('id', '')
        
        # 既に新形式の場合はスキップ
        if old_id.startswith('SCH-'):
            continue
        
        try:
            # 新形式のIDを生成
            date_str = item.get('date', '')
            new_id = generate_schedule_id(date_str, SCHEDULES_TABLE)
            
            # 既存のIDを保持（レガシーIDとして）
            item['legacy_id'] = old_id
            
            # 新IDでアイテムを保存
            item['id'] = new_id
            SCHEDULES_TABLE.put_item(Item=item)
            
            # 旧IDのアイテムを削除
            SCHEDULES_TABLE.delete_item(Key={'id': old_id})
            
            # estimatesテーブルのschedule_idも更新
            estimates_response = ESTIMATES_TABLE.scan(
                FilterExpression=Attr('schedule_id').eq(old_id)
            )
            for estimate in estimates_response.get('Items', []):
                ESTIMATES_TABLE.update_item(
                    Key={'id': estimate['id']},
                    UpdateExpression='SET schedule_id = :new_id',
                    ExpressionAttributeValues={':new_id': new_id}
                )
            
            migrated_count += 1
            print(f"Migrated: {old_id} -> {new_id}")
            
        except Exception as e:
            error_count += 1
            print(f"Error migrating {old_id}: {str(e)}")
    
    print(f"\n移行完了: {migrated_count}件成功, {error_count}件失敗")

if __name__ == '__main__':
    migrate_schedule_ids()
```

---

### フェーズ4: ロールバック計画

#### ロールバック手順

1. **バックエンドのロールバック**
   - `create_schedule()` 関数をUUID形式に戻す
   - Lambda関数をデプロイ

2. **フロントエンドのロールバック**
   - `admin-schedules.js` の変更を元に戻す
   - ビルド・デプロイ

3. **データ整合性の確認**
   - 既存データの整合性を確認
   - 問題があれば移行スクリプトを実行

---

## 📋 チェックリスト

### 実装前
- [ ] 既存データの確認（本番環境）
- [ ] テスト環境での動作確認
- [ ] ロールバック計画の確認

### 実装中
- [ ] バックエンドID生成関数の実装
- [ ] `create_schedule()` 関数の修正
- [ ] フロントエンドの修正
- [ ] テストの実行

### 実装後
- [ ] 本番環境での動作確認
- [ ] モニタリング・ログ確認
- [ ] 既存データの移行（必要に応じて）

---

## 🎯 まとめ

**実装優先度**:
1. 🔴 高: バックエンドでのID生成一元化
2. 🟡 中: フロントエンドの修正
3. 🟢 低: 既存データの移行（必要に応じて）

**リスク対策**:
- ✅ 条件付き書き込みによる競合対策
- ✅ リトライロジックの実装
- ✅ 段階的な実装とテスト
- ✅ ロールバック計画の準備

**営業ダッシュボード対応**:
- ✅ 既にバックエンドに任せているため、追加対応不要

