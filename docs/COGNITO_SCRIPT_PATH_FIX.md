# Cognitoスクリプトパス修正の確認

## 問題

エラーメッセージ：
```
signin.html:157  GET https://sakurada-masaru.github.io/misesapo/assets/js/cognito_config.js net::ERR_ABORTED 404 (Not Found)
signin.html:158  GET https://sakurada-masaru.github.io/misesapo/assets/js/cognito_auth.js net::ERR_ABORTED 404 (Not Found)
```

## 原因

1. **パスの不一致**
   - ソースコード: `/assets/js/cognito_config.js`
   - ビルド後の実際のパス: `/js/cognito_config.js`
   - ビルド時に `src/assets/js/` が `public/js/` にコピーされるため

2. **ブラウザキャッシュ**
   - 古いバージョンのHTMLがキャッシュされている可能性
   - GitHub Pagesにデプロイされたファイルが古い可能性

## 修正内容

### 修正したファイル
- `/src/pages/staff/signin.html`
- `/src/pages/staff/mypage.html`

### 修正内容
```diff
- <script src="/assets/js/cognito_config.js"></script>
- <script src="/assets/js/cognito_auth.js"></script>
+ <script src="/js/cognito_config.js"></script>
+ <script src="/js/cognito_auth.js"></script>
```

## 確認結果

### ビルド後のファイル
- ✅ `/public/staff/signin.html` - パスは正しく `/js/` になっている
- ✅ `/public/staff/mypage.html` - パスは正しく `/js/` になっている

### ファイルの存在確認
- ✅ `/public/js/cognito_config.js` - 存在する
- ✅ `/public/js/cognito_auth.js` - 存在する

## 解決方法

### 1. ブラウザキャッシュのクリア
- ハードリロード: `Ctrl+Shift+R` (Windows/Linux) または `Cmd+Shift+R` (Mac)
- 開発者ツールで「キャッシュを無効にして再読み込み」

### 2. GitHub Pagesの確認
- GitHub Pagesに最新のコミットがデプロイされているか確認
- デプロイに時間がかかる場合がある（数分〜数十分）

### 3. 実際のURL確認
- `/signin.html` にアクセスしている場合、Cognitoスクリプトは読み込まれないはず
- `/staff/signin.html` にアクセスしている場合、Cognitoスクリプトが読み込まれる

## 注意点

エラーメッセージの行番号157, 158は `/staff/signin.html` のものですが、エラーメッセージでは `signin.html` と表示されています。これは、ブラウザの開発者ツールの表示の問題かもしれません。

実際にアクセスしているURLを確認してください：
- `/signin.html` - お客様用ログインページ（Firebase認証）
- `/staff/signin.html` - 従業員用ログインページ（Cognito認証）

