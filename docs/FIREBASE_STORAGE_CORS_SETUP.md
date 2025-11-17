# Firebase Storage CORS設定ガイド

Firebase Storageへの画像アップロード時にCORSエラーが発生する場合、以下の手順でCORS設定を適用してください。

## 前提条件

1. Google Cloud SDK（gsutil）がインストールされていること
2. Firebaseプロジェクトにアクセス権限があること

## 手順

### 1. Google Cloud SDKのインストール（未インストールの場合）

```bash
# macOSの場合
brew install google-cloud-sdk

# または公式インストーラーを使用
# https://cloud.google.com/sdk/docs/install
```

### 2. Google Cloudにログイン

```bash
gcloud auth login
```

### 3. プロジェクトを設定

```bash
gcloud config set project misesapo-system
```

### 4. CORS設定ファイルの確認

プロジェクトルートの `storage-cors.json` ファイルを確認してください。

### 4-1. Firebase Storageが有効化されているか確認

Firebase ConsoleでStorageが有効化されていない場合、先に有効化する必要があります：

1. **Firebase Console** (https://console.firebase.google.com/) にアクセス
2. プロジェクト `misesapo-system` を選択
3. 左メニューから **「Storage」** をクリック
4. 「始める」または「Get started」ボタンをクリック
5. セキュリティルールを確認して「次へ」をクリック
6. ロケーションを選択（Firestoreと同じロケーション `asia-northeast1` を推奨）
7. 「完了」をクリック

### 4-2. バケット名を確認

```bash
# 利用可能なバケットを一覧表示
gcloud storage buckets list
```

または、Firebase Console → Storage → 設定 でバケット名を確認できます。

### 5. CORS設定を適用

```bash
# バケット名を確認してから実行（例）
gsutil cors set storage-cors.json gs://misesapo-system.firebasestorage.app

# または、デフォルトバケットの場合
gsutil cors set storage-cors.json gs://misesapo-system.appspot.com
```

**注意**: バケット名は実際に作成されたバケット名を使用してください。上記のコマンドで「バケットが存在しません」というエラーが出る場合は、Firebase ConsoleでStorageを有効化してください。

### 6. CORS設定の確認

```bash
# 設定したバケット名を使用
gsutil cors get gs://misesapo-system.firebasestorage.app
```

## トラブルシューティング

### CORSエラーが続く場合

1. **ブラウザのキャッシュをクリア**
   - 強制リロード: `Cmd+Shift+R` (Mac) または `Ctrl+Shift+R` (Windows)

2. **認証トークンを確認**
   - ブラウザのコンソール（F12）で以下を実行:
   ```javascript
   firebase.auth().currentUser?.getIdToken().then(token => console.log('Token:', token))
   ```

3. **セキュリティルールを確認**
   - Firebase Console → Storage → ルール
   - `storage.rules` ファイルの内容が正しくデプロイされているか確認

4. **Firebase Storageのセキュリティルールを再デプロイ**
   ```bash
   firebase deploy --only storage:rules
   ```

## 参考

- [Firebase Storage CORS設定](https://firebase.google.com/docs/storage/web/download-files#cors_configuration)
- [gsutil cors コマンド](https://cloud.google.com/storage/docs/gsutil/commands/cors)

