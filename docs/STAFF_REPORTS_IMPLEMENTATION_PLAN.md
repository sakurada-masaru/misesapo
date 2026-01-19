# 作業レポート機能の実装計画

## 📋 概要

参考画像と要件を基に、作業レポート機能のAWS実装計画を具体化します。

## 🎯 要件整理

### 画像サイズ
- **仕様**: スマホ画面で水平方向に2枚配置できる程度
- **推奨サイズ**: 各画像 幅: 約45-48% (最大800px)、高さ: 自動（アスペクト比維持）
- **最適化**: クライアント側でリサイズ（最大幅800px、JPEG品質80%）

### 認証システム
- **現在**: Google Firebase Authentication
- **ロール**: Custom Claimsで管理（customer, staff, admin等）
- **トークン**: Firebase ID TokenをAPI Gatewayに送信

### 閲覧権限
- **ユーザー（customer）**: 自分の店舗のレポートのみ閲覧可能
- **清掃員（staff）**: 自分が作成したレポートのみ閲覧可能
- **管理者（admin）**: すべてのレポートを閲覧可能

---

## 📊 レポートデータ構造

### DynamoDBテーブル設計

**テーブル名**: `staff-reports`

**パーティションキー**: `report_id` (String, UUID)
**ソートキー**: `created_at` (String, ISO 8601)

**GSI（グローバルセカンダリインデックス）**:
1. **`staff_id-created_at-index`**
   - パーティションキー: `staff_id` (String, Firebase UID)
   - ソートキー: `created_at` (String)
   - 用途: 清掃員が自分のレポート一覧を取得

2. **`store_id-created_at-index`**
   - パーティションキー: `store_id` (String, 店舗ID)
   - ソートキー: `created_at` (String)
   - 用途: 店舗ごとのレポート一覧を取得

3. **`status-created_at-index`**
   - パーティションキー: `status` (String, "draft" | "published" | "archived")
   - ソートキー: `created_at` (String)
   - 用途: ステータス別のレポート取得（将来: 承認待ちレポートの管理）

**アイテム構造**:
```json
{
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-03-20T10:30:00Z",
  "updated_at": "2025-03-20T10:35:00Z",
  "created_by": "admin-uid-12345",
  "created_by_name": "管理者 太郎",
  "created_by_email": "admin@example.com",
  "staff_id": null,
  "staff_name": null,
  "staff_email": null,
  "store_id": "store-001",
  "store_name": "Darts Bar A's 神楽坂店",
  "cleaning_date": "2025-03-20",
  "cleaning_start_time": "08:00",
  "cleaning_end_time": "11:30",
  "status": "published",
  "work_items": [
    {
      "item_id": "grease-trap",
      "item_name": "グリストラップ",
      "details": {
        "type": "床置き型",
        "count": 2,
        "manifest": false,
        "notes": "少し流れが悪い"
      },
      "work_content": "グリストラップ清掃を行いました。作業時間に余裕がありましたので、こびりついた汚れを集中的に落としていきます。",
      "work_memo": "特に奥の方が汚れがひどかったように見えました。次回以降、まずは右奥から集中的に落としていきたいと思います。",
      "photos": {
        "before": [
          "s3://bucket/reports/550e8400/grease-trap-before-1.jpg",
          "s3://bucket/reports/550e8400/grease-trap-before-2.jpg"
        ],
        "after": [
          "s3://bucket/reports/550e8400/grease-trap-after-1.jpg",
          "s3://bucket/reports/550e8400/grease-trap-after-2.jpg"
        ]
      }
    },
    {
      "item_id": "range-hood",
      "item_name": "レンジフード清掃",
      "details": {
        "type": "グリスフィルター"
      },
      "work_content": "レンジフード清掃を行いました。",
      "work_memo": "特に奥の方が汚れがひどかったように見えました。",
      "photos": {
        "before": ["s3://bucket/reports/550e8400/range-hood-before-1.jpg"],
        "after": ["s3://bucket/reports/550e8400/range-hood-after-1.jpg"]
      }
    }
  ],
  "location": {
    "latitude": 35.7023,
    "longitude": 139.7378,
    "address": "東京都新宿区神楽坂1-2-3"
  },
  "satisfaction": {
    "rating": null,
    "comment": null,
    "commented_at": null,
    "commented_by": null
  },
  "ttl": 1735689600  // 5年後のタイムスタンプ（自動削除用）
}
```

---

## 🗂️ S3バケット構造

**バケット名**: `misesapo-cleaning-reports` (新規作成) または既存バケットのサブディレクトリ

**構造**:
```
misesapo-cleaning-reports/
├── reports/
│   └── {report_id}/
│       ├── {item_id}-before-{index}.jpg
│       └── {item_id}-after-{index}.jpg
└── thumbnails/  (オプション: サムネイル生成)
    └── {report_id}/
        ├── {item_id}-before-{index}-thumb.jpg
        └── {item_id}-after-{index}-thumb.jpg
```

**S3設定**:
- **ライフサイクルポリシー**: 5年後に自動削除
- **バージョニング**: 無効（コスト削減）
- **暗号化**: AES-256（サーバー側暗号化）
- **CORS設定**: 許可されたオリジンのみ

---

## 🔐 認証・認可の実装

### Firebase ID Tokenの検証

**Lambda関数での実装**:
```python
import json
import requests
from jose import jwt
from jose.exceptions import JWTError

def verify_firebase_token(id_token):
    """
    Firebase ID Tokenを検証し、ユーザー情報を取得
    """
    try:
        # Firebase公開鍵を取得（キャッシュ推奨）
        # https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
        
        # JWTを検証
        decoded_token = jwt.decode(
            id_token,
            firebase_public_keys,
            algorithms=['RS256'],
            audience=firebase_project_id
        )
        
        return {
            'uid': decoded_token['user_id'],
            'email': decoded_token.get('email'),
            'role': decoded_token.get('role', 'customer'),  # Custom Claims
            'verified': True
        }
    except JWTError as e:
        return {'verified': False, 'error': str(e)}
```

### アクセス制御ロジック

```python
def check_report_access(user_info, report_item):
    """
    レポートへのアクセス権限をチェック
    """
    role = user_info.get('role')
    user_id = user_info.get('uid')
    
    if role == 'admin':
        return True  # 管理者は全レポート閲覧・編集可能
    
    if role == 'staff':
        # 将来実装: 清掃員は自分のレポートのみ閲覧可能
        return report_item.get('staff_id') == user_id
    
    if role == 'customer':
        # 将来実装: ユーザーは自分の店舗のレポートのみ閲覧可能
        # （店舗とユーザーの関連テーブルが必要）
        # return report_item['store_id'] in user_stores
        return True  # 暫定: 全レポート閲覧可能
    
    return False

def check_report_edit_permission(user_info, report_item):
    """
    レポートの編集権限をチェック
    """
    role = user_info.get('role')
    
    # 暫定: 管理者のみ編集可能
    if role == 'admin':
        return True
    
    return False
```

---

## 🚀 API設計

### 1. レポート作成（管理者向け）

**エンドポイント**: `POST /staff/reports`

**権限**: 管理者のみ

**リクエストヘッダー**:
```
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```

**リクエストボディ**:
```json
{
  "store_id": "store-001",
  "store_name": "Darts Bar A's 神楽坂店",
  "cleaning_date": "2025-03-20",
  "cleaning_start_time": "08:00",
  "cleaning_end_time": "11:30",
  "work_items": [
    {
      "item_id": "grease-trap",
      "item_name": "グリストラップ",
      "details": {...},
      "work_content": "...",
      "work_memo": "...",
      "photos": {
        "before": ["base64_encoded_image_1", "base64_encoded_image_2"],
        "after": ["base64_encoded_image_3", "base64_encoded_image_4"]
      }
    }
  ],
  "location": {
    "latitude": 35.7023,
    "longitude": 139.7378
  }
}
```

**レスポンス**:
```json
{
  "status": "success",
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "レポートを作成しました"
}
```

### 2. レポート一覧取得

**エンドポイント**: `GET /staff/reports`

**権限**: 
- 管理者: 全レポート取得可能
- ユーザー: 全レポート閲覧可能（暫定、将来は自分の店舗のみ）

**クエリパラメータ**:
- `limit`: 取得件数（デフォルト: 20）
- `last_key`: ページネーション用（前回のレスポンスの`last_key`を使用）
- `store_id`: 店舗IDでフィルタ（管理者のみ）
- `staff_id`: 清掃員IDでフィルタ（管理者のみ）
- `status`: ステータスでフィルタ（管理者のみ）

**レスポンス**:
```json
{
  "items": [
    {
      "report_id": "...",
      "store_name": "...",
      "cleaning_date": "...",
      "status": "submitted",
      "created_at": "..."
    }
  ],
  "last_key": "...",
  "count": 20
}
```

### 3. レポート詳細取得

**エンドポイント**: `GET /staff/reports/{report_id}`

**レスポンス**: レポートの完全なデータ（写真URL含む）

### 4. 写真アップロード（個別）

**エンドポイント**: `POST /staff/reports/photos`

**リクエスト**: マルチパートフォームデータ
- `report_id`: レポートID
- `item_id`: 清掃項目ID
- `category`: "before" | "after"
- `file`: 画像ファイル

**レスポンス**:
```json
{
  "photo_url": "https://s3.amazonaws.com/bucket/reports/.../photo.jpg",
  "thumbnail_url": "https://s3.amazonaws.com/bucket/reports/.../photo-thumb.jpg"
}
```

### 5. レポート編集（管理者向け）

**エンドポイント**: `PUT /staff/reports/{report_id}`

**権限**: 管理者のみ

**リクエスト**: レポート作成と同じ構造（部分更新も可能）

### 6. 満足度・コメント送信（将来実装）

**エンドポイント**: `PUT /staff/reports/{report_id}/satisfaction`

**リクエスト**:
```json
{
  "rating": 5,
  "comment": "とてもきれいになりました。ありがとうございます。"
}
```

---

## 📱 クライアント側実装

### 画像の最適化

```javascript
function optimizeImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
```

### オフライン対応

```javascript
// Service Workerでバックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncPendingReports());
  }
});

async function syncPendingReports() {
  const pendingReports = await getPendingReportsFromIndexedDB();
  
  for (const report of pendingReports) {
    try {
      await submitReport(report);
      await removePendingReport(report.id);
    } catch (error) {
      console.error('Failed to sync report:', error);
    }
  }
}
```

---

## 🔧 Lambda関数の実装

### 既存の`lambda_function.py`に追加

```python
# レポート関連の関数を追加

def create_report(event, headers):
    """
    レポートを作成
    """
    # Firebase ID Tokenを検証
    id_token = event.get('headers', {}).get('Authorization', '').replace('Bearer ', '')
    user_info = verify_firebase_token(id_token)
    
    if not user_info.get('verified'):
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    # リクエストボディを取得
    body = json.loads(event.get('body', '{}'))
    
    # レポートIDを生成
    report_id = str(uuid.uuid4())
    
    # 写真をS3にアップロード
    photo_urls = {}
    for item in body.get('work_items', []):
        item_id = item['item_id']
        photo_urls[item_id] = {
            'before': [],
            'after': []
        }
        
        # 作業前の写真
        for idx, base64_image in enumerate(item['photos']['before']):
            photo_key = f"reports/{report_id}/{item_id}-before-{idx+1}.jpg"
            photo_url = upload_photo_to_s3(base64_image, photo_key)
            photo_urls[item_id]['before'].append(photo_url)
        
        # 作業後の写真
        for idx, base64_image in enumerate(item['photos']['after']):
            photo_key = f"reports/{report_id}/{item_id}-after-{idx+1}.jpg"
            photo_url = upload_photo_to_s3(base64_image, photo_key)
            photo_urls[item_id]['after'].append(photo_url)
    
    # DynamoDBに保存
    report_item = {
        'report_id': report_id,
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
        'staff_id': user_info['uid'],
        'staff_name': body.get('staff_name', ''),
        'staff_email': user_info.get('email', ''),
        'store_id': body['store_id'],
        'store_name': body['store_name'],
        'cleaning_date': body['cleaning_date'],
        'cleaning_start_time': body.get('cleaning_start_time'),
        'cleaning_end_time': body.get('cleaning_end_time'),
        'status': 'submitted',
        'work_items': body['work_items'],
        'location': body.get('location'),
        'satisfaction': {
            'rating': None,
            'comment': None,
            'commented_at': None,
            'commented_by': None
        },
        'ttl': int((datetime.utcnow() + timedelta(days=1825)).timestamp())  # 5年後
    }
    
    # 写真URLをwork_itemsに反映
    for item in report_item['work_items']:
        item_id = item['item_id']
        item['photos'] = photo_urls[item_id]
    
    REPORTS_TABLE.put_item(Item=report_item)
    
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'status': 'success',
            'report_id': report_id,
            'message': 'レポートを作成しました'
        })
    }

def get_reports(event, headers):
    """
    レポート一覧を取得
    """
    # Firebase ID Tokenを検証
    id_token = event.get('headers', {}).get('Authorization', '').replace('Bearer ', '')
    user_info = verify_firebase_token(id_token)
    
    if not user_info.get('verified'):
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    # クエリパラメータを取得
    query_params = event.get('queryStringParameters') or {}
    limit = int(query_params.get('limit', 20))
    last_key = query_params.get('last_key')
    
    role = user_info.get('role')
    user_id = user_info.get('uid')
    
    # ロールに応じてクエリを変更
    if role == 'admin':
        # 管理者は全レポートを取得
        if query_params.get('store_id'):
            # 店舗IDでフィルタ
            response = REPORTS_TABLE.query(
                IndexName='store_id-created_at-index',
                KeyConditionExpression=Key('store_id').eq(query_params['store_id']),
                ScanIndexForward=False,
                Limit=limit
            )
        else:
            # 全レポートをスキャン（効率化のため、statusでフィルタ推奨）
            response = REPORTS_TABLE.scan(Limit=limit)
    
    elif role == 'staff':
        # 清掃員は自分のレポートのみ
        response = REPORTS_TABLE.query(
            IndexName='staff_id-created_at-index',
            KeyConditionExpression=Key('staff_id').eq(user_id),
            ScanIndexForward=False,
            Limit=limit
        )
    
    elif role == 'customer':
        # ユーザーは自分の店舗のレポートのみ
        # （店舗とユーザーの関連テーブルが必要）
        store_ids = get_user_stores(user_id)  # 実装が必要
        # 複数店舗のレポートを取得する場合は、各店舗ごとにクエリ
    
    items = response.get('Items', [])
    
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'items': items,
            'last_key': response.get('LastEvaluatedKey'),
            'count': len(items)
        })
    }
```

---

## 📋 実装チェックリスト

### Phase 1: 基本機能（1-2週間）

#### AWS設定
- [ ] DynamoDBテーブル `staff-reports` の作成
- [ ] GSI（3つ）の作成
- [ ] S3バケット `misesapo-cleaning-reports` の作成
- [ ] S3ライフサイクルポリシーの設定
- [ ] Lambda関数にレポート機能を追加
- [ ] API Gatewayにエンドポイントを追加
- [ ] CORS設定

#### 認証・認可
- [ ] Firebase ID Token検証関数の実装
- [ ] アクセス制御ロジックの実装
- [ ] ロールベースの権限チェック

#### クライアント側
- [ ] レポート作成フォームの改善
- [ ] 画像最適化機能の実装
- [ ] 写真アップロード機能の実装
- [ ] レポート一覧ページの作成
- [ ] レポート詳細ページの作成（参考画像ベース）

### Phase 2: オフライン対応（1週間）

- [ ] Service Workerの実装
- [ ] IndexedDBでのデータ保存
- [ ] Background Sync APIの実装
- [ ] 同期状態の可視化

### Phase 3: 高度な機能（1-2週間）

- [ ] 満足度・コメント機能
- [ ] レポート検索・フィルタリング
- [ ] 写真のサムネイル生成（Lambda + ImageMagick）
- [ ] レポートのエクスポート機能（PDF生成）

---

## 💰 コスト見積もり

### 月額コスト（500ユーザー、1日20レポート/ユーザー想定）

- **DynamoDB**: $20-40（オンデマンド課金、10,000レポート/日）
- **S3**: $15-30（写真保存、100GB想定、$0.023/GB）
- **S3 Transfer**: $5-10（データ転送）
- **Lambda**: $5-10（100万リクエスト/月）
- **API Gateway**: $10-20（100万リクエスト/月）
- **合計**: 約$55-110/月

---

## ✅ 要件確定事項

### 1. レポートの承認フロー
- **現状**: 管理者承認が必要
- **運用**: 管理者がレポートを作成してユーザーに返す
- **将来**: 清掃員単位でレポートを作成できるようにする（段階的実装）

### 2. 写真の枚数制限
- **制限**: なし（無制限）
- **将来**: 3Dカメラ映像等も使用予定（実装予定中）

### 3. レポートの編集
- **編集**: 可能
- **権限**: 暫定では管理者のみが編集可能

### 4. 店舗とユーザーの関連
- **現状**: 保留（顧客情報が確定していない）
- **実装**: 後日対応

### 5. 通知機能
- **現状**: 今後の判断とする
- **実装**: 後日対応

---

## 🎯 実装方針の変更

### Phase 1: 管理者向けレポート作成機能（優先）

**現状の要件**:
- 管理者がレポートを作成
- 管理者がレポートを編集
- ユーザーはレポートを閲覧のみ

**実装内容**:
1. 管理者向けレポート作成ページ
2. 管理者向けレポート編集ページ
3. ユーザー向けレポート閲覧ページ（参考画像ベース）
4. レポート一覧ページ（管理者・ユーザー共通）

### Phase 2: 清掃員向けレポート作成機能（将来）

- 清掃員がレポートを作成
- 管理者が承認
- 承認後にユーザーに公開

---

## 📋 更新された実装チェックリスト

### Phase 1: 管理者向け機能（1-2週間）

#### AWS設定
- [ ] DynamoDBテーブル `staff-reports` の作成
- [ ] GSI（3つ）の作成
- [ ] S3バケット `misesapo-cleaning-reports` の作成
- [ ] S3ライフサイクルポリシーの設定
- [ ] Lambda関数にレポート機能を追加
- [ ] API Gatewayにエンドポイントを追加
- [ ] CORS設定

#### 認証・認可
- [ ] Firebase ID Token検証関数の実装
- [ ] 管理者権限チェック（role === 'admin'）
- [ ] 編集権限チェック（管理者のみ）

#### クライアント側（管理者向け）
- [ ] 管理者向けレポート作成ページ
  - [ ] 店舗選択
  - [ ] 清掃日時の入力
  - [ ] 清掃項目の選択・追加
  - [ ] 写真アップロード（枚数制限なし）
  - [ ] 作業内容・メモの入力
  - [ ] 位置情報の取得（オプション）
- [ ] 管理者向けレポート編集ページ
- [ ] 管理者向けレポート一覧ページ

#### クライアント側（ユーザー向け）
- [ ] ユーザー向けレポート閲覧ページ（参考画像ベース）
  - [ ] レポート詳細表示
  - [ ] 清掃項目のタブ表示
  - [ ] 作業前・作業後の写真表示（2列グリッド）
  - [ ] 満足度調査・コメント機能（将来実装）
- [ ] ユーザー向けレポート一覧ページ

### Phase 2: 清掃員向け機能（将来）

- [ ] 清掃員向けレポート作成ページ
- [ ] 承認フローの実装
- [ ] 承認待ちレポートの管理

### Phase 3: オフライン対応（将来）

- [ ] Service Workerの実装
- [ ] IndexedDBでのデータ保存
- [ ] Background Sync APIの実装

---

## 📚 参考資料

- [DynamoDB ベストプラクティス](https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/best-practices.html)
- [Firebase Authentication REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Service Worker API](https://developer.mozilla.org/ja/docs/Web/API/Service_Worker_API)

