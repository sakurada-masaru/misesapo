# 従業員メールアドレス移行計画

## ⚠️ 現状の問題点

### 1. 個人のGmailアドレスを業務で使用している

**現状**:
- 従業員が個人のGmailアドレス（`@gmail.com`など）でログインしている
- AWS Cognitoで認証管理されているが、メールアドレス自体が個人のもの
- DynamoDBの`workers`テーブルに個人のメールアドレスが保存されている

**問題点**:
- ❌ **コンプライアンス上の問題**: データの所有権が不明確、適切なデータ管理ができない
- ❌ **セキュリティリスク**: 個人アカウントの乗っ取りリスク、データ漏洩のリスク
- ❌ **ブランディング**: プロフェッショナルな印象を与えない
- ❌ **業務の継続性**: 退職時にデータの引き継ぎが困難

### 2. データ漏洩のリスク

**リスク**:
- 個人のGmailアカウントがハッキングされた場合、業務データも漏洩
- 個人のメールと業務メールの混在により、誤送信のリスクが高い
- 退職時に業務データを削除できない

### 3. Firebase/Cognitoでの管理だけでは不十分

**現状**:
- Firebase Authentication（お客様用）とAWS Cognito（従業員用）で認証管理
- しかし、メールアドレス自体が個人のもの

**問題点**:
- 認証システムで管理されていても、メールアドレスが個人のものでは問題が解決しない
- データの所有権、コンプライアンス、セキュリティの問題は残る

---

## 🎯 改善目標

### 1. 企業用メールアドレス（`@misesapo.app`）への移行

**目標**:
- 全従業員が企業用メールアドレス（`@misesapo.app`）を使用
- Xサーバーでメールアドレスを作成（コスト効率が良い）
- AWS CognitoとDynamoDBのメールアドレスを更新

### 2. コンプライアンス対応

**目標**:
- データの所有権が明確
- 適切なデータ管理が可能
- 監査証跡の確保
- 退職時のデータ引き継ぎが可能

### 3. セキュリティの向上

**目標**:
- 企業のセキュリティポリシーを適用可能
- データの漏洩リスクを低減
- 業務の継続性を確保

---

## 📋 移行計画

### フェーズ1: 準備（1週間）

#### 1.1 Xサーバーでのメールアドレス作成

**手順**:
1. Xサーバーのサーバーパネルにログイン
2. 既存従業員のメールアドレスを作成
   - 例: `yamada.taro@misesapo.app`
   - 例: `suzuki.hanako@misesapo.app`
3. メールアドレスの命名規則を決定
   - 推奨: `姓.名@misesapo.app` または `名.姓@misesapo.app`

**必要な情報**:
- 既存従業員のリスト（名前、現在のメールアドレス）
- メールアドレスの命名規則

#### 1.2 移行スクリプトの準備

**必要なスクリプト**:
- 既存従業員のメールアドレス一覧を取得
- Xサーバーでメールアドレスを作成（手動またはAPI）
- AWS Cognitoのメールアドレスを更新
- DynamoDBの`workers`テーブルのメールアドレスを更新

#### 1.3 通知文の準備

**通知内容**:
- メールアドレスの変更について
- 新しいメールアドレスとパスワード
- ログイン方法の変更
- 移行日時

---

### フェーズ2: 既存従業員の移行（2-3週間）

#### 2.1 メールアドレスの作成

**手順**:
1. Xサーバーで各従業員のメールアドレスを作成
2. 初期パスワードを設定
3. メールアドレスとパスワードを記録

#### 2.2 AWS Cognitoの更新

**手順**:
1. 既存のCognitoユーザーのメールアドレスを更新
2. 必要に応じてパスワードをリセット
3. メールアドレスの検証を実行

**注意点**:
- Cognitoのメールアドレス変更は、ユーザーが次回ログイン時に確認が必要な場合がある
- 管理者が直接変更する場合は、検証をスキップできる設定が必要

#### 2.3 DynamoDBの更新

**手順**:
1. `workers`テーブルの`email`フィールドを更新
2. 必要に応じて`updated_at`フィールドを更新
3. 変更履歴を記録

#### 2.4 従業員への通知

**手順**:
1. 新しいメールアドレスとパスワードを通知
2. ログイン方法の変更を案内
3. 移行日時を通知

---

### フェーズ3: 新入社員のメールアドレス作成フロー（継続）

#### 3.1 新入社員登録時のフロー

**手順**:
1. 管理者が`/admin/users/index.html`で新入社員を登録
2. **メールアドレスは`@misesapo.app`のみを受け付ける**（バリデーション追加）
3. Xサーバーでメールアドレスを作成（手動または自動化）
4. AWS Cognitoにユーザーを作成（新しいメールアドレスで）
5. DynamoDBの`workers`テーブルに保存

#### 3.2 バリデーションの追加

**実装**:
- メールアドレスの入力時に、`@misesapo.app`で終わることを確認
- 個人のGmailアドレス（`@gmail.com`など）は拒否
- エラーメッセージを表示

---

### フェーズ4: モニタリングと改善（継続）

#### 4.1 移行状況の確認

**確認項目**:
- 全従業員が企業用メールアドレスを使用しているか
- 個人のGmailアドレスが残っていないか
- ログインエラーが発生していないか

#### 4.2 改善点の洗い出し

**確認項目**:
- メールアドレスの命名規則が適切か
- 移行プロセスがスムーズか
- 従業員からのフィードバック

---

## 🔧 実装が必要な変更

### 1. フロントエンド（`src/pages/admin/users/index.html`）

#### メールアドレスのバリデーション追加

```javascript
// メールアドレスのバリデーション
function validateEmail(email) {
  // @misesapo.appで終わることを確認
  if (!email.endsWith('@misesapo.app')) {
    return {
      valid: false,
      message: 'メールアドレスは@misesapo.appで終わる必要があります。'
    };
  }
  
  // 個人のGmailアドレスを拒否
  if (email.includes('@gmail.com') || 
      email.includes('@yahoo.co.jp') || 
      email.includes('@outlook.com')) {
    return {
      valid: false,
      message: '個人のメールアドレスは使用できません。企業用メールアドレス（@misesapo.app）を使用してください。'
    };
  }
  
  return { valid: true };
}

// フォーム送信時のバリデーション
userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('user-email').value;
  const validation = validateEmail(email);
  
  if (!validation.valid) {
    alert(validation.message);
    return;
  }
  
  // 既存の処理...
});
```

#### メールアドレスのプレースホルダー更新

```html
<input type="email" id="user-email" name="email" required placeholder="yamada.taro@misesapo.app">
```

---

### 2. バックエンド（`lambda_function.py`）

#### メールアドレスのバリデーション追加

```python
def validate_worker_email(email):
    """従業員のメールアドレスをバリデーション"""
    if not email:
        return {'valid': False, 'message': 'メールアドレスは必須です。'}
    
    # @misesapo.appで終わることを確認
    if not email.endswith('@misesapo.app'):
        return {
            'valid': False,
            'message': 'メールアドレスは@misesapo.appで終わる必要があります。'
        }
    
    # 個人のメールアドレスを拒否
    personal_domains = ['@gmail.com', '@yahoo.co.jp', '@outlook.com', '@hotmail.com']
    if any(email.endswith(domain) for domain in personal_domains):
        return {
            'valid': False,
            'message': '個人のメールアドレスは使用できません。企業用メールアドレス（@misesapo.app）を使用してください。'
        }
    
    return {'valid': True}

def create_worker(event, headers):
    """従業員を作成"""
    # ... 既存の処理 ...
    
    email = body_json.get('email', '')
    validation = validate_worker_email(email)
    if not validation['valid']:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': validation['message']})
        }
    
    # ... 既存の処理 ...
```

---

### 3. 移行スクリプト（`scripts/migrate_worker_emails.py`）

#### 既存従業員のメールアドレスを更新

```python
import boto3
import json
from botocore.exceptions import ClientError

# DynamoDBとCognitoのクライアント
dynamodb = boto3.resource('dynamodb')
cognito_client = boto3.client('cognito-idp', region_name='ap-northeast-1')

WORKERS_TABLE = dynamodb.Table('workers')
USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'

def migrate_worker_email(worker_id, old_email, new_email):
    """従業員のメールアドレスを移行"""
    try:
        # 1. DynamoDBのメールアドレスを更新
        WORKERS_TABLE.update_item(
            Key={'id': worker_id},
            UpdateExpression='SET email = :email, updated_at = :updated_at',
            ExpressionAttributeValues={
                ':email': new_email,
                ':updated_at': datetime.utcnow().isoformat() + 'Z'
            }
        )
        
        # 2. Cognitoのメールアドレスを更新
        # Cognito Subを取得
        worker = WORKERS_TABLE.get_item(Key={'id': worker_id})['Item']
        cognito_sub = worker.get('cognito_sub')
        
        if cognito_sub:
            cognito_client.admin_update_user_attributes(
                UserPoolId=USER_POOL_ID,
                Username=cognito_sub,
                UserAttributes=[
                    {'Name': 'email', 'Value': new_email},
                    {'Name': 'email_verified', 'Value': 'true'}
                ]
            )
        
        return {'success': True, 'worker_id': worker_id}
    except Exception as e:
        return {'success': False, 'worker_id': worker_id, 'error': str(e)}

def main():
    """メイン処理"""
    # 既存従業員のリストを取得
    response = WORKERS_TABLE.scan()
    workers = response.get('Items', [])
    
    # 移行マッピング（old_email -> new_email）
    migration_map = {
        'old_email@gmail.com': 'new_email@misesapo.app',
        # ... 他のマッピング ...
    }
    
    results = []
    for worker in workers:
        old_email = worker.get('email', '')
        if old_email in migration_map:
            new_email = migration_map[old_email]
            result = migrate_worker_email(worker['id'], old_email, new_email)
            results.append(result)
    
    # 結果を出力
    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
```

---

## 📊 移行チェックリスト

### 準備フェーズ

- [ ] 既存従業員のリストを作成（名前、現在のメールアドレス）
- [ ] メールアドレスの命名規則を決定
- [ ] Xサーバーでメールアドレスを作成
- [ ] 移行スクリプトを準備
- [ ] 通知文を準備

### 移行フェーズ

- [ ] 各従業員のメールアドレスをXサーバーで作成
- [ ] AWS Cognitoのメールアドレスを更新
- [ ] DynamoDBの`workers`テーブルのメールアドレスを更新
- [ ] 従業員に新しいメールアドレスとパスワードを通知
- [ ] ログイン動作を確認

### 新入社員フロー

- [ ] フロントエンドにメールアドレスのバリデーションを追加
- [ ] バックエンドにメールアドレスのバリデーションを追加
- [ ] プレースホルダーを更新
- [ ] エラーメッセージを追加

### モニタリング

- [ ] 全従業員が企業用メールアドレスを使用しているか確認
- [ ] 個人のGmailアドレスが残っていないか確認
- [ ] ログインエラーが発生していないか確認
- [ ] 従業員からのフィードバックを収集

---

## 💡 推奨事項

### 1. 段階的な移行

**推奨**:
- 一度に全従業員を移行するのではなく、段階的に移行
- まず管理者から移行し、その後一般従業員へ
- 各フェーズで動作確認を行う

### 2. 十分な通知期間

**推奨**:
- 移行の2週間前に通知
- 移行日時を明確に伝える
- サポート体制を整える

### 3. バックアップ

**推奨**:
- 移行前に既存データのバックアップを取得
- 移行後も一定期間は旧メールアドレスを保持（転送設定）

### 4. テスト環境での検証

**推奨**:
- 本番環境での移行前に、テスト環境で検証
- 移行スクリプトの動作確認
- ログイン動作の確認

---

## 📝 まとめ

### 現状の問題点

1. ❌ 個人のGmailアドレスを業務で使用している
2. ❌ データ漏洩のリスク
3. ❌ コンプライアンス上の問題
4. ❌ Firebase/Cognitoでの管理だけでは不十分

### 改善目標

1. ✅ 企業用メールアドレス（`@misesapo.app`）への移行
2. ✅ コンプライアンス対応
3. ✅ セキュリティの向上

### 移行計画

1. **フェーズ1**: 準備（1週間）
2. **フェーズ2**: 既存従業員の移行（2-3週間）
3. **フェーズ3**: 新入社員のメールアドレス作成フロー（継続）
4. **フェーズ4**: モニタリングと改善（継続）

### 実装が必要な変更

1. フロントエンド: メールアドレスのバリデーション追加
2. バックエンド: メールアドレスのバリデーション追加
3. 移行スクリプト: 既存従業員のメールアドレスを更新

**結論**: 個人のGmailアドレスから企業用メールアドレス（`@misesapo.app`）への移行は、コンプライアンス、セキュリティ、ブランディングの観点から必須です。段階的な移行計画を立て、確実に実行することが重要です。

