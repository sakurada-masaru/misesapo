# スケジュールID管理方針提案書

## 📋 現状分析

### 1. 現在の実装状況

#### バックエンド（Lambda）
- **ID生成方法**: `uuid.uuid4()` を使用（UUID形式）
- **生成箇所**: `lambda_function.py:2537` の `create_schedule()` 関数
- **形式**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (例: `550e8400-e29b-41d4-a716-446655440000`)

#### フロントエンド
- **ID生成方法**: `DataUtils.IdUtils.generateSchedule()` を使用
- **現在の形式**: `SCH-2025-1125-001` (日付+連番形式)
- **生成箇所**: `src/assets/js/admin-schedules.js:743`

#### DynamoDBテーブル設計
- **パーティションキー**: `id` (String型)
- **GSI**: `status-index`, `assigned_to-index`, `date-index`
- **関連テーブル**: `estimates` テーブルに `schedule_id` フィールドで紐付け

### 2. 問題点

1. **ID生成の不整合**
   - バックエンド: UUID形式
   - フロントエンド: `SCH-` 形式
   - フロントエンドで生成したIDがバックエンドで無視される

2. **既存データとの互換性**
   - 既存のUUID形式のスケジュールデータが存在する可能性
   - 新形式への移行時にデータ不整合が発生するリスク

3. **ID管理の一元化不足**
   - フロントエンドとバックエンドで別々にID生成
   - 競合の可能性（同時作成時の重複）

4. **可読性の問題**
   - UUID形式は人間が読みにくい
   - ドキュメントでは `SCH-001` や `SCH-2025-1125-001` 形式を推奨

### 3. 影響範囲

#### バックエンド（Lambda）
- `create_schedule()`: ID生成ロジック
- `get_schedule_detail()`: IDで検索
- `update_schedule()`: IDで検索・更新
- `delete_schedule()`: IDで削除
- `get_estimates()`: `schedule_id` でフィルタリング

#### フロントエンド
- `admin-schedules.js`: ID生成、表示、編集、削除
- `data_utils.js`: ID正規化、比較
- スケジュール一覧表示、詳細表示、編集フォーム

#### データベース
- `schedules` テーブル: パーティションキー
- `estimates` テーブル: `schedule_id` フィールド（GSIあり）

---

## 🎯 推奨されるID管理方針

### 方針1: バックエンド一元管理 + 日付ベース連番形式（推奨）

#### 概要
- **ID形式**: `SCH-YYYYMMDD-NNN` (例: `SCH-20251225-001`)
- **生成場所**: バックエンド（Lambda）のみ
- **連番管理**: DynamoDBの条件付き書き込みを使用

#### メリット
1. ✅ **一元管理**: バックエンドでID生成を統一
2. ✅ **可読性**: 日付が含まれるため、作成日が分かる
3. ✅ **競合対策**: DynamoDBの条件付き書き込みで重複を防止
4. ✅ **スケーラビリティ**: 日付ごとに連番をリセットするため、長期的に管理しやすい
5. ✅ **検索効率**: 日付ベースのため、日付範囲での検索が容易

#### 実装方法

##### 1. バックエンド（Lambda）でのID生成

```python
def generate_schedule_id(date_str):
    """
    スケジュールIDを生成: SCH-YYYYMMDD-NNN
    日付ごとに連番をリセット
    """
    from datetime import datetime
    
    # 日付をYYYYMMDD形式に変換
    if isinstance(date_str, str):
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
```

##### 2. 条件付き書き込みによる競合対策

```python
def create_schedule(event, headers):
    """
    スケジュールを作成（ID生成含む）
    """
    # ... 既存のコード ...
    
    # スケジュールIDを生成
    date_str = body_json.get('date', '')
    schedule_id = generate_schedule_id(date_str)
    
    # 条件付き書き込みで重複を防止
    max_retries = 5
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # 既に存在するIDかチェック
            response = SCHEDULES_TABLE.get_item(Key={'id': schedule_id})
            if 'Item' in response:
                # IDが存在する場合は連番をインクリメント
                schedule_id = generate_schedule_id(date_str)
                retry_count += 1
                continue
            
            # スケジュールアイテムを作成
            schedule_item = {
                'id': schedule_id,
                # ... その他のフィールド ...
            }
            
            # 条件付き書き込み（IDが存在しない場合のみ）
            SCHEDULES_TABLE.put_item(
                Item=schedule_item,
                ConditionExpression='attribute_not_exists(id)'
            )
            
            # 成功
            break
            
        except SCHEDULES_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
            # 競合が発生した場合は再試行
            schedule_id = generate_schedule_id(date_str)
            retry_count += 1
            if retry_count >= max_retries:
                raise Exception('スケジュールIDの生成に失敗しました（最大リトライ回数に達しました）')
        except Exception as e:
            raise e
```

##### 3. フロントエンドの修正

```javascript
// admin-schedules.js
// ID生成を削除（バックエンドに任せる）
if (isNew) {
  // data.id = DataUtils.IdUtils.generateSchedule(); // 削除
  data.created_at = new Date().toISOString();
} else {
  data.id = id;
}
```

##### 4. 既存データの移行（オプション）

既存のUUID形式のスケジュールデータがある場合、移行スクリプトを作成：

```python
def migrate_schedule_ids():
    """
    既存のUUID形式のスケジュールIDを新形式に移行
    """
    # 既存のスケジュールを取得
    response = SCHEDULES_TABLE.scan()
    
    for item in response.get('Items', []):
        old_id = item.get('id', '')
        
        # UUID形式かチェック
        if not old_id.startswith('SCH-'):
            # 新形式のIDを生成
            date_str = item.get('date', '')
            new_id = generate_schedule_id(date_str)
            
            # 既存のIDを保持（レガシーIDとして）
            item['legacy_id'] = old_id
            
            # 新IDでアイテムを保存
            item['id'] = new_id
            SCHEDULES_TABLE.put_item(Item=item)
            
            # 旧IDのアイテムを削除
            SCHEDULES_TABLE.delete_item(Key={'id': old_id})
            
            # estimatesテーブルのschedule_idも更新
            # ... estimatesテーブルの更新処理 ...
```

---

### 方針2: バックエンド一元管理 + グローバル連番形式

#### 概要
- **ID形式**: `SCH-NNNNN` (例: `SCH-00001`)
- **生成場所**: バックエンド（Lambda）のみ
- **連番管理**: DynamoDBの条件付き書き込み + カウンターテーブル

#### メリット
1. ✅ **シンプル**: 形式が単純で分かりやすい
2. ✅ **一元管理**: バックエンドでID生成を統一
3. ✅ **競合対策**: カウンターテーブルで連番を管理

#### デメリット
1. ❌ **日付情報なし**: IDから作成日が分からない
2. ❌ **カウンターテーブル必要**: 追加のテーブル管理が必要

---

### 方針3: ハイブリッド形式（既存データとの互換性重視）

#### 概要
- **新規作成**: `SCH-YYYYMMDD-NNN` 形式
- **既存データ**: UUID形式をそのまま保持
- **ID検証**: 両形式に対応

#### メリット
1. ✅ **既存データとの互換性**: 移行不要
2. ✅ **段階的移行**: 新規データから新形式に移行

#### デメリット
1. ❌ **形式の混在**: システム内で2つの形式が混在
2. ❌ **検索の複雑化**: ID検証ロジックが複雑になる

---

## 🏆 最終推奨: 方針1（日付ベース連番形式）

### 理由

1. **可読性**: 日付が含まれるため、IDから作成日が分かる
2. **スケーラビリティ**: 日付ごとに連番をリセットするため、長期的に管理しやすい
3. **検索効率**: 日付ベースのため、日付範囲での検索が容易
4. **一元管理**: バックエンドでID生成を統一し、競合を防止
5. **ドキュメント準拠**: `SCH-2025-1125-001` 形式に準拠

### 実装ステップ

#### フェーズ1: バックエンド実装
1. `generate_schedule_id()` 関数を実装
2. `create_schedule()` 関数を修正（ID生成をバックエンドに移行）
3. 条件付き書き込みによる競合対策を実装
4. テスト環境で動作確認

#### フェーズ2: フロントエンド修正
1. フロントエンドでのID生成を削除
2. バックエンドから返されたIDを使用
3. ID表示・検証ロジックを確認

#### フェーズ3: 既存データ移行（必要に応じて）
1. 既存のUUID形式データを確認
2. 移行スクリプトを作成・実行
3. 移行後のデータ整合性を確認

#### フェーズ4: 本番環境への適用
1. 本番環境で動作確認
2. モニタリング・ログ確認
3. 問題があればロールバック

---

## ⚠️ 注意事項

1. **既存データの確認**: 本番環境に既存のスケジュールデータがある場合、移行計画を立てる
2. **estimatesテーブル**: `schedule_id` フィールドも更新が必要
3. **GSI**: `schedule_id-index` が存在するため、ID形式変更の影響を確認
4. **API互換性**: 既存のAPIクライアントがID形式に依存していないか確認
5. **ログ・モニタリング**: ID生成の失敗や競合を監視

---

## 📊 パフォーマンス考慮事項

1. **スキャン操作**: `get_max_sequence_for_date()` はスキャン操作を使用するため、大量データがある場合はパフォーマンスに注意
2. **最適化案**: 
   - 日付ごとのカウンターテーブルを作成
   - または、GSIを使用して日付でフィルタリング

---

## 🔄 ロールバック計画

万が一問題が発生した場合のロールバック手順：

1. バックエンドのID生成ロジックをUUID形式に戻す
2. フロントエンドの修正を元に戻す
3. 既存データの整合性を確認

---

## 📝 まとめ

**推奨方針**: 方針1（日付ベース連番形式 `SCH-YYYYMMDD-NNN`）

**実装優先度**:
1. 高: バックエンドでのID生成一元化
2. 中: フロントエンドの修正
3. 低: 既存データの移行（必要に応じて）

**リスク**: 低（段階的な実装により、リスクを最小化）

