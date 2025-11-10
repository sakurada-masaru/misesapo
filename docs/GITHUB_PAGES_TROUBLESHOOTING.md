# GitHub Pages トラブルシューティング

## 🔍 問題の確認方法

### 1. GitHub PagesのURLを確認

**URL**: https://sakurada-masaru.github.io/misesapo/

### 2. ブラウザのコンソールでエラーを確認

1. ブラウザの開発者ツールを開く（F12キー）
2. 「Console」タブを開く
3. エラーメッセージを確認

### 3. ネットワークタブでリソースの読み込みを確認

1. ブラウザの開発者ツールを開く（F12キー）
2. 「Network」タブを開く
3. ページを再読み込み
4. 404エラーや読み込み失敗しているリソースを確認

## 🐛 よくある問題と対処法

### 問題1: CSSが読み込まれない

**症状**: ページのスタイルが適用されていない

**確認方法**:
1. ブラウザのコンソールで404エラーを確認
2. NetworkタブでCSSファイルの読み込みを確認

**対処法**:
- `public/index.html`の`<base href="/misesapo/" />`が正しく設定されているか確認
- CSSファイルのパスが`/misesapo/css/style.css`になっているか確認
- GitHub Actionsのビルドが成功しているか確認

### 問題2: 画像が表示されない

**症状**: 画像が表示されない

**確認方法**:
1. ブラウザのコンソールで404エラーを確認
2. Networkタブで画像ファイルの読み込みを確認

**対処法**:
- 画像ファイルのパスが`/misesapo/images/...`になっているか確認
- `public/images/`ディレクトリに画像ファイルが存在するか確認

### 問題3: ページが真っ白

**症状**: ページが真っ白で何も表示されない

**確認方法**:
1. ブラウザのコンソールでエラーを確認
2. HTMLのソースを確認（右クリック > ページのソースを表示）

**対処法**:
- `public/index.html`が正しく生成されているか確認
- GitHub Actionsのビルドが成功しているか確認
- `<base href="/misesapo/" />`が正しく設定されているか確認

### 問題4: リンクが正しく動作しない

**症状**: リンクをクリックしても404エラーになる

**確認方法**:
1. リンクのURLを確認
2. ブラウザのコンソールで404エラーを確認

**対処法**:
- リンクのパスが`/misesapo/...`になっているか確認
- `<base href="/misesapo/" />`が正しく設定されているか確認

## 🔧 デバッグ手順

### ステップ1: GitHub Actionsのログを確認

1. https://github.com/sakurada-masaru/misesapo/actions にアクセス
2. 最新のワークフロー実行をクリック
3. `build`ジョブをクリック
4. `Build static files`ステップのログを確認
5. エラーがないか確認

### ステップ2: ビルド結果を確認

1. GitHub Actionsのログで、`Build completed. Files in public/:`の後にファイル一覧が表示されるか確認
2. `public/index.html`が生成されているか確認

### ステップ3: デプロイ結果を確認

1. GitHub Actionsのログで、`deploy`ジョブが成功しているか確認
2. GitHub PagesのURLにアクセスして、ページが表示されるか確認

### ステップ4: HTMLのソースを確認

1. GitHub PagesのURLにアクセス
2. 右クリック > 「ページのソースを表示」
3. `<base href="/misesapo/" />`が正しく設定されているか確認
4. CSSや画像のパスが`/misesapo/...`になっているか確認

## 📝 確認事項

### GitHub Pagesの設定

1. https://github.com/sakurada-masaru/misesapo/settings/pages にアクセス
2. 以下を確認:
   - GitHub Pagesが有効化されているか
   - ソースが「GitHub Actions」に設定されているか
   - カスタムドメインが設定されていないか（設定されている場合は、base_pathが異なる可能性があります）

### GitHub Actionsの設定

1. https://github.com/sakurada-masaru/misesapo/settings/actions にアクセス
2. 以下を確認:
   - GitHub Actionsが有効化されているか
   - ワークフローの権限が適切に設定されているか

## 🛠️ 対処方法

### 方法1: ビルドを再実行

1. GitHub Actionsのワークフローを手動で実行
2. または、新しいコミットをプッシュ

### 方法2: ローカルでビルドして確認

```bash
# GitHub Pages用のビルドを実行
GITHUB_REPOSITORY="sakurada-masaru/misesapo" python3 scripts/build.py

# ローカルサーバーで確認
cd public
python3 -m http.server 8080
```

### 方法3: ビルドスクリプトを確認

1. `scripts/build.py`の`get_base_path()`関数を確認
2. `GITHUB_REPOSITORY`環境変数が正しく設定されているか確認

## ✅ チェックリスト

- [ ] GitHub Pagesが有効化されている
- [ ] GitHub Actionsのビルドが成功している
- [ ] `public/index.html`が生成されている
- [ ] `<base href="/misesapo/" />`が正しく設定されている
- [ ] CSSファイルのパスが`/misesapo/css/style.css`になっている
- [ ] 画像ファイルのパスが`/misesapo/images/...`になっている
- [ ] ブラウザのコンソールでエラーがないか確認
- [ ] Networkタブでリソースの読み込みが成功しているか確認

## 📞 サポート

問題が解決しない場合は、以下を共有してください：

1. ブラウザのコンソールのエラーメッセージ
2. Networkタブで読み込み失敗しているリソース
3. GitHub Actionsのログ
4. 実際に表示されているページのURL

