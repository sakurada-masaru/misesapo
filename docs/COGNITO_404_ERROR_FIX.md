# Cognitoスクリプト404エラーの修正

## エラーメッセージ

```
signin.html:157  GET https://sakurada-masaru.github.io/misesapo/assets/js/cognito_config.js net::ERR_ABORTED 404 (Not Found)
signin.html:158  GET https://sakurada-masaru.github.io/misesapo/assets/js/cognito_auth.js net::ERR_ABORTED 404 (Not Found)
```

## 問題の原因

### 1. パスの不一致
- **ソースコード**: `/assets/js/cognito_config.js`
- **ビルド後の実際のパス**: `/js/cognito_config.js`
- **理由**: ビルド時に `src/assets/js/` が `public/js/` にコピーされるため

### 2. ブラウザキャッシュまたはGitHub Pagesのデプロイ遅延
- 古いバージョンのHTMLがキャッシュされている
- GitHub Pagesに最新のコミットがデプロイされていない

## 修正内容

### 修正したファイル
1. `/src/pages/staff/signin.html`
2. `/src/pages/staff/mypage.html`

### 修正前
```html
<script src="/assets/js/cognito_config.js"></script>
<script src="/assets/js/cognito_auth.js"></script>
```

### 修正後
```html
<script src="/js/cognito_config.js"></script>
<script src="/js/cognito_auth.js"></script>
```

## 確認結果

### ビルド後のファイル
- ✅ `/public/staff/signin.html` の157, 158行目: パスは正しく `/js/` になっている
- ✅ `/public/staff/mypage.html`: パスは正しく `/js/` になっている

### ファイルの存在確認
- ✅ `/public/js/cognito_config.js` - 存在する（204バイト）
- ✅ `/public/js/cognito_auth.js` - 存在する（7612バイト）
- ❌ `/public/assets/js/cognito_config.js` - 存在しない（正しい）

## 解決方法

### 1. ブラウザキャッシュのクリア（最重要）
1. **ハードリロード**: 
   - Windows/Linux: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`
2. **開発者ツールを使用**:
   - 開発者ツールを開く（F12）
   - ネットワークタブを開く
   - 「キャッシュを無効にして再読み込み」をチェック
   - ページを再読み込み

### 2. GitHub Pagesのデプロイ確認
- GitHubリポジトリの「Actions」タブで、最新のコミットがデプロイされているか確認
- デプロイに時間がかかる場合がある（数分〜数十分）

### 3. 実際のURL確認
エラーメッセージの行番号157, 158は `/staff/signin.html` のものです。

- **`/signin.html`** - お客様用ログインページ（Firebase認証、Cognitoスクリプトなし）
- **`/staff/signin.html`** - 従業員用ログインページ（Cognito認証、157, 158行目にCognitoスクリプト）

実際にアクセスしているURLを確認してください。

## 注意点

エラーメッセージでは `signin.html:157` と表示されていますが、これは `/staff/signin.html` の行番号です。ブラウザの開発者ツールの表示の問題かもしれません。

## 次のステップ

1. ブラウザのキャッシュをクリア
2. ハードリロード（Ctrl+Shift+R または Cmd+Shift+R）
3. エラーが解消されない場合は、GitHub Pagesのデプロイ状況を確認

