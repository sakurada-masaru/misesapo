# 管理ダッシュボード パフォーマンス最適化

## 🔍 現状の問題点

現在の実装では、管理ダッシュボードで以下の全データを取得しています：

```javascript
// 全データを取得（データ量が多いと遅くなる）
const [storesRes, schedulesRes, workersRes, reportsRes] = await Promise.all([
  fetch(`${API_BASE}/stores`),      // 全店舗データ
  fetch(`${API_BASE}/schedules`),   // 全スケジュールデータ（2000件以上）
  fetch(`${API_BASE}/workers`),     // 全作業員データ
  fetch(`${API_BASE}/reports`)      // 全レポートデータ（2000件以上）
]);
```

**問題点：**
- データが増えると、APIレスポンスが大きくなり、転送時間が長くなる
- フロントエンドで全データをメモリに保持する必要がある
- 実際に使用するのは一部のデータのみ（今日のスケジュール5件、最近のアクティビティ5件など）

## ✅ 最適化案

### 案1: フロントエンド側で最適化（即座に実装可能）

**メリット：**
- バックエンドの変更が不要
- 即座に実装可能

**実装内容：**
- 必要なデータのみを取得するように変更
- クエリパラメータでフィルタリング（例: `?date=2025-01-15&limit=5`）

**制限事項：**
- バックエンドAPIがクエリパラメータに対応している必要がある
- 複数のAPIリクエストが必要（統計データ、今日のスケジュール、最近のアクティビティなど）

### 案2: バックエンド側で最適化（推奨）

**メリット：**
- 1回のAPIリクエストで必要なデータのみを取得
- データ転送量が大幅に削減
- パフォーマンスが向上

**実装内容：**
- Lambda関数に `/admin/dashboard/data` エンドポイントを追加
- このエンドポイントで必要なデータのみを返す：
  ```json
  {
    "stats": {
      "total_customers": 195,
      "total_workers": 4,
      "today_schedules": 5,
      "month_schedules": 120,
      "draft_schedules": 3,
      "pending_estimates": 2
    },
    "today_schedules": [
      {
        "id": "123",
        "scheduled_time": "10:00",
        "store_id": "ST0001",
        "store_name": "店舗名",
        "worker_id": "W001",
        "worker_name": "作業員名",
        "status": "scheduled"
      }
      // 最大5件
    ],
    "recent_activities": [
      {
        "type": "schedule_draft",
        "text": "仮押さえ申請",
        "meta": "店舗名",
        "date": "2025-01-15T10:00:00Z",
        "color": "orange"
      }
      // 最大10件
    ],
    "stores_map": {
      "ST0001": { "id": "ST0001", "name": "店舗名" },
      "ST0002": { "id": "ST0002", "name": "店舗名2" }
      // 必要な店舗情報のみ
    },
    "workers_map": {
      "W001": { "id": "W001", "name": "作業員名" },
      "W002": { "id": "W002", "name": "作業員名2" }
      // 必要な作業員情報のみ
    }
  }
  ```

## 🚀 実装手順

### Step 1: Lambda関数の実装

`lambda_function.py` に以下の関数を追加：

```python
def get_dashboard_data(headers):
    """
    管理ダッシュボードの最適化データを取得
    """
    try:
        # S3からデータを読み込む
        # または DynamoDBから必要なデータのみを取得
        
        # 統計データ
        stats = {
            'total_customers': 0,
            'total_workers': 0,
            'today_schedules': 0,
            'month_schedules': 0,
            'draft_schedules': 0,
            'pending_estimates': 0
        }
        
        # 今日のスケジュール（最大5件）
        today_schedules = []
        
        # 最近のアクティビティ（最大10件）
        recent_activities = []
        
        # 必要な店舗・作業員情報のみ
        stores_map = {}
        workers_map = {}
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'stats': stats,
                'today_schedules': today_schedules,
                'recent_activities': recent_activities,
                'stores_map': stores_map,
                'workers_map': workers_map
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting dashboard data: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ダッシュボードデータの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }
```

### Step 2: API Gatewayの設定

1. `/admin/dashboard/data` リソースを作成
2. GETメソッドを追加
3. Lambda関数に統合
4. CORSを有効化
5. APIをデプロイ

### Step 3: フロントエンドの実装

`src/pages/admin/dashboard.html` を修正：

```javascript
async function loadDashboard() {
  try {
    // 最適化エンドポイントから必要なデータのみを取得
    const res = await fetch(`${API_BASE}/admin/dashboard/data`);
    const data = await res.json();
    
    // 統計データを表示
    document.getElementById('stat-customers').textContent = data.stats.total_customers;
    document.getElementById('stat-workers').textContent = data.stats.total_workers;
    document.getElementById('stat-today').textContent = data.stats.today_schedules;
    document.getElementById('stat-month').textContent = data.stats.month_schedules;
    
    // アラート
    if (data.stats.draft_schedules > 0) {
      document.getElementById('draft-alert').style.display = 'flex';
      document.getElementById('draft-count').textContent = data.stats.draft_schedules;
    }
    
    if (data.stats.pending_estimates > 0) {
      document.getElementById('estimate-alert').style.display = 'flex';
      document.getElementById('estimate-count').textContent = data.stats.pending_estimates;
    }
    
    // 今日のスケジュール
    renderTodaySchedules(data.today_schedules, data.stores_map, data.workers_map);
    
    // 最近のアクティビティ
    renderRecentActivity(data.recent_activities);
    
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}
```

## 📊 期待される効果

### データ転送量の削減

| 項目 | 現在 | 最適化後 | 削減率 |
|------|------|----------|--------|
| スケジュール | 全件（2000件以上） | 今日の5件のみ | 99%以上 |
| レポート | 全件（2000件以上） | 最近の10件のみ | 99%以上 |
| 店舗 | 全件（195件） | 必要な件数のみ | 90%以上 |
| 作業員 | 全件（4件） | 必要な件数のみ | 50%以上 |

### パフォーマンス向上

- **APIレスポンス時間**: 2-3秒 → 0.5秒以下
- **ページ読み込み時間**: 3-5秒 → 1秒以下
- **メモリ使用量**: 大幅に削減

## 🔄 段階的な実装

1. **Phase 1**: フロントエンド側で最適化（即座に実装可能）
   - クエリパラメータでフィルタリング
   - 必要なデータのみを取得

2. **Phase 2**: バックエンド側で最適化（推奨）
   - Lambda関数に最適化エンドポイントを追加
   - API Gatewayに設定
   - フロントエンドを更新

## 📝 注意事項

- バックエンドAPIがクエリパラメータに対応している必要がある
- データの整合性を保つため、適切なフィルタリングロジックを実装する
- キャッシュを活用することで、さらにパフォーマンスを向上できる

