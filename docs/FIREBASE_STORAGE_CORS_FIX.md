# Firebase Storage CORSエラー解決ガイド

## エラー内容

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' 
from origin 'https://sakurada-masaru.github.io' 
has been blocked by CORS policy
```

## 原因

Firebase StorageのCORS設定が適用されていない、または不適切な設定になっています。

## 解決手順

### 1. Firebase ConsoleでStorageを有効化

1. **Firebase Console** (https://console.firebase.google.com/) にアクセス
2. プロジェクト `misesapo-system` を選択
3. 左メニューから **「Storage」** をクリック
4. Storageが有効化されていない場合、「始める」または「Get started」ボタンをクリック
5. セキュリティルールを確認して「次へ」をクリック
6. ロケーションを選択（Firestoreと同じロケーション `asia-northeast1` を推奨）
7. 「完了」をクリック

### 2. バケット名を確認

Firebase Console → Storage → 設定 でバケット名を確認します。

通常は以下のいずれかです：
- `misesapo-system.firebasestorage.app`
- `misesapo-system.appspot.com`

### 3. CORS設定を適用

プロジェクトルートで以下のコマンドを実行：

```bash
# バケット名を確認してから実行（例）
gsutil cors set storage-cors.json gs://misesapo-system.firebasestorage.app

# または、デフォルトバケットの場合
gsutil cors set storage-cors.json gs://misesapo-system.appspot.com
```

### 4. CORS設定の確認

```bash
# 設定したバケット名を使用
gsutil cors get gs://misesapo-system.firebasestorage.app
```

正しく設定されていれば、以下のような内容が表示されます：

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

### 5. セキュリティルールの確認

Firebase Console → Storage → ルール で、以下のルールが適用されているか確認：

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /cleaning-manual-images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                     (request.auth.token.role == 'admin' || 
                      request.auth.token.role == 'staff' || 
                      request.auth.token.role == 'concierge' || 
                      request.auth.token.role == 'developer' || 
                      request.auth.token.role == 'master') &&
                     request.resource.size < 10 * 1024 * 1024 &&
                     request.resource.contentType.matches('image/.*');
    }
  }
}
```

ルールが適用されていない場合は、以下を実行：

```bash
firebase deploy --only storage:rules
```

### 6. ブラウザのキャッシュをクリア

CORS設定を適用した後、ブラウザのキャッシュをクリアしてください：

- **強制リロード**: `Cmd+Shift+R` (Mac) または `Ctrl+Shift+R` (Windows)
- または、開発者ツールで「Disable cache」を有効化

## トラブルシューティング

### CORSエラーが続く場合

1. **バケット名が正しいか確認**
   ```bash
   gcloud storage buckets list --project=misesapo-system
   ```

2. **認証トークンを確認**
   - ブラウザのコンソール（F12）で以下を実行:
   ```javascript
   firebase.auth().currentUser?.getIdToken().then(token => console.log('Token:', token))
   ```

3. **Firebase Storageのセキュリティルールを再デプロイ**
   ```bash
   firebase deploy --only storage:rules
   ```

4. **gsutilが正しくインストールされているか確認**
   ```bash
   gsutil version
   ```

5. **Google Cloudにログインしているか確認**
   ```bash
   gcloud auth list
   ```

## 参考

- [Firebase Storage CORS設定](https://firebase.google.com/docs/storage/web/download-files#cors_configuration)
- [gsutil cors コマンド](https://cloud.google.com/storage/docs/gsutil/commands/cors)

