# ID 9999削除問題の修正

## 問題の状況

- ✅ DynamoDBからは削除済み（直接スキャンで0件）
- ❌ APIからはまだ返されている（全ユーザー取得APIで22名中に含まれる）

## 原因

Lambda関数が古いコードを実行している可能性があります。DynamoDBからは削除済みですが、APIからは古いデータが返されています。

## 対応

### 1. 一時的な対応（完了）

`lambda_function.py`の`get_workers`関数に、ID 9999を明示的に除外するフィルタを追加しました：

```python
# ID 9999を除外（削除済みだがAPIに残っている可能性があるため）
workers = [w for w in workers if str(w.get('id', '')).strip() != '9999']
```

これにより、APIからID 9999が返されなくなります。

### 2. 根本的な対応（推奨）

Lambda関数をデプロイして、最新コードを反映してください。

**デプロイ手順**:
1. AWS Lambdaコンソールを開く: https://console.aws.amazon.com/lambda/
2. リージョン: `ap-northeast-1` を選択
3. Lambda関数を選択（例: `misesapo-api` など）
4. 「コード」タブを開く
5. ローカルの `lambda_function.py` の内容をすべてコピー
6. Lambda関数のコードエディタに貼り付け
7. 「Deploy」ボタンをクリック
8. デプロイ完了を待つ（数秒〜数十秒）

**デプロイ後の確認**:
```bash
python3 scripts/check_data_consistency.py
```

## 確認方法

デプロイ後、以下で確認してください：

```bash
# APIからID 9999が返されないことを確認
python3 -c "
import json
import urllib.request
import time

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'
url = f'{API_BASE}/workers?t={int(time.time() * 1000)}'

with urllib.request.urlopen(url) as response:
    data = json.loads(response.read().decode())
    workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
    ids = [str(w.get('id', '')).strip() for w in workers]
    
    if '9999' in ids:
        print('⚠️  ID 9999がまだ返されています')
    else:
        print('✓ ID 9999は返されていません')
        print(f'総ユーザー数: {len(workers)}名')
"
```

