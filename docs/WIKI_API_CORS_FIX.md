# Wiki API CORSエラー修正

## 問題

WIKIページで以下のCORSエラーが発生していました：

```
Access to fetch at 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/wiki' 
from origin 'https://sakurada-masaru.github.io' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 原因

API Gatewayで`/wiki`エンドポイントのOPTIONSメソッド（CORS preflightリクエスト用）が設定されていませんでした。

## 解決方法

### 1. API Gateway設定スクリプトの作成

`scripts/setup_wiki_api.sh`を作成し、以下の設定を実施：

- `/wiki`リソースの作成
- GET、POST、PUTメソッドの設定
- OPTIONSメソッドの設定（CORS用）
- Lambda統合の設定
- Lambda関数への実行権限付与
- CORSヘッダーの設定

### 2. 設定内容

#### リソース
- `/wiki`: Wikiデータの読み書き

#### HTTPメソッド
- **GET**: Wikiデータの取得
- **POST**: Wikiデータの作成
- **PUT**: Wikiデータの更新
- **OPTIONS**: CORS preflightリクエスト

#### CORSヘッダー
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token`
- `Access-Control-Allow-Methods: GET,PUT,POST,DELETE,OPTIONS`

### 3. 実行結果

スクリプトを実行し、以下の設定が完了しました：

```
✅ /wikiリソースの作成
✅ GET、POST、PUTメソッドの設定
✅ OPTIONSメソッドの設定
✅ Lambda統合の設定
✅ Lambda関数への実行権限付与
✅ CORSヘッダーの設定
✅ APIのデプロイ
```

## 確認方法

1. ブラウザの開発者ツールでNetworkタブを開く
2. WIKIページにアクセス
3. `/wiki`エンドポイントへのリクエストが成功することを確認
4. OPTIONSリクエストが200ステータスで返ることを確認

## 関連ファイル

- `scripts/setup_wiki_api.sh`: API Gateway設定スクリプト
- `lambda_function.py`: Lambda関数（`get_wiki_data`, `save_wiki_data`）
- `src/assets/js/aws-wiki-api.js`: フロントエンドAPIクライアント

## 参考

- [出退勤システムのCORS修正](./CORS_ERROR_ANALYSIS.md)
- [Attendance API設定](./ATTENDANCE_SYSTEM_IMPLEMENTATION.md)

