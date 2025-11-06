# GitHub Pages設定ガイド

## 問題: README.mdが表示されている場合

GitHub PagesでREADME.mdが表示されている場合、以下のいずれかの問題が考えられます：

1. **GitHub Pagesの設定が「Deploy from a branch」になっている**
2. **GitHub Actionsのワークフローがまだ実行されていない**
3. **GitHub Actionsのワークフローがエラーになっている**

## 解決方法

### ステップ1: GitHub Pagesの設定を確認・変更

1. GitHubリポジトリにアクセス: https://github.com/sakurada-masaru/misesapo
2. 「Settings」タブをクリック
3. 左サイドバーの「Pages」をクリック
4. 「Source」セクションを確認：
   - **「GitHub Actions」を選択**（重要！）
   - 「Deploy from a branch」が選択されている場合は、「GitHub Actions」に変更
5. 「Save」をクリック

### ステップ2: GitHub Actionsの実行を確認

1. リポジトリの「Actions」タブをクリック
2. 「Deploy to GitHub Pages」ワークフローを確認
3. 最新の実行が「緑色のチェックマーク」になっているか確認
4. まだ実行されていない場合は、手動で実行：
   - 「Actions」タブ → 「Deploy to GitHub Pages」を選択
   - 右側の「Run workflow」をクリック
   - 「Run workflow」ボタンをクリック

### ステップ3: デプロイの確認

ワークフローが正常に完了すると、以下のURLでサイトにアクセスできます：

```
https://sakurada-masaru.github.io/misesapo/
```

初回のデプロイは数分かかる場合があります（通常2-5分）。

## トラブルシューティング

### GitHub Actionsがエラーになっている場合

1. 「Actions」タブでエラーを確認
2. エラーログを確認
3. よくあるエラー：
   - **Python のバージョンエラー**: ワークフローで `python-version: '3.11'` を指定していますが、最新のPythonバージョンを使用してください
   - **ビルドエラー**: `scripts/build.py` が正常に動作するかローカルで確認してください

### まだREADME.mdが表示される場合

1. ブラウザのキャッシュをクリア（Ctrl+Shift+R または Cmd+Shift+R）
2. GitHub Pagesの設定を再確認
3. GitHub Actionsのワークフローが正常に完了しているか確認
4. デプロイURLが正しいか確認: `https://sakurada-masaru.github.io/misesapo/`

## 正しい設定状態

### GitHub Pages設定
- Source: **GitHub Actions**
- ブランチ: （GitHub Actionsが自動管理）

### GitHub Actionsワークフロー
- ワークフロー名: `Deploy to GitHub Pages`
- ステータス: ✅ 成功（緑色のチェックマーク）
- 最終実行: 最新のコミット日時

## 確認方法

### 1. ワークフローが正常に動作しているか
```
リポジトリ → Actions → Deploy to GitHub Pages → 最新の実行 → ✅ 緑色
```

### 2. サイトが正しく表示されているか
```
https://sakurada-masaru.github.io/misesapo/
```
このURLで「定期清掃サービス | ミセサポ」のトップページが表示されるはずです。

### 3. ビルドが正常に完了しているか
```
Actions → 最新の実行 → build ジョブ → Build static files
```
このステップで `public/` ディレクトリが生成されているはずです。

---

**最終更新**: 2025年3月


