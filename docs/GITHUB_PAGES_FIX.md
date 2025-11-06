# GitHub PagesでREADME.mdが表示される問題の解決方法

## 問題
GitHub Pagesにアクセスすると「MisesapoRenewal — デザインモックアップ開発ガイド」というREADME.mdの内容が表示されてしまう。

## 原因
GitHub Pagesの設定が「Deploy from a branch」になっていて、リポジトリのルートディレクトリが表示されている可能性があります。

## 解決方法

### ステップ1: GitHub Pagesの設定を変更

1. **GitHubリポジトリにアクセス**
   - https://github.com/sakurada-masaru/misesapo

2. **Settingsタブをクリック**
   - リポジトリの右上の「Settings」タブをクリック

3. **Pagesセクションを開く**
   - 左サイドバーの「Pages」をクリック

4. **Sourceを変更**
   - 「Source」セクションで「Deploy from a branch」が選択されている場合：
     - 「None」を選択して保存
     - 再度「Pages」を開く
     - 「Source」で「**GitHub Actions**」を選択
   - 既に「GitHub Actions」が選択されている場合は、そのまま

5. **保存**
   - 「Save」ボタンをクリック（表示されている場合）

### ステップ2: GitHub Actionsのワークフローを実行

1. **Actionsタブをクリック**
   - リポジトリの「Actions」タブをクリック

2. **ワークフローを確認**
   - 左サイドバーで「Deploy to GitHub Pages」を選択
   - 最新の実行を確認

3. **手動で実行（必要に応じて）**
   - まだ実行されていない、またはエラーになっている場合：
     - 右側の「Run workflow」をクリック
     - 「Run workflow」ボタンをクリック

4. **実行の完了を待つ**
   - 通常2-5分で完了します
   - 「緑色のチェックマーク」が表示されたら成功です

### ステップ3: サイトにアクセス

ワークフローが正常に完了すると、以下のURLでサイトにアクセスできます：

```
https://sakurada-masaru.github.io/misesapo/
```

**注意**: 初回のデプロイは数分かかる場合があります。また、ブラウザのキャッシュをクリアするために、Ctrl+Shift+R（Windows/Linux）または Cmd+Shift+R（Mac）を押してください。

## 確認ポイント

### ✅ 正しい設定
- GitHub PagesのSource: **GitHub Actions**
- GitHub Actionsのワークフロー: **✅ 緑色のチェックマーク**
- サイトURL: `https://sakurada-masaru.github.io/misesapo/` でトップページが表示される

### ❌ 間違った設定
- GitHub PagesのSource: **Deploy from a branch**
- この場合、README.mdが表示されてしまいます

## トラブルシューティング

### まだREADME.mdが表示される場合

1. **ブラウザのキャッシュをクリア**
   - Ctrl+Shift+R（Windows/Linux）または Cmd+Shift+R（Mac）

2. **GitHub Pagesの設定を再確認**
   - Settings → Pages → Source が「GitHub Actions」になっているか

3. **GitHub Actionsのワークフローを再実行**
   - Actions → Deploy to GitHub Pages → Run workflow

4. **デプロイが完了しているか確認**
   - Actionsタブで最新の実行が「✅ 成功」になっているか
   - 完了まで数分待つ

### GitHub Actionsがエラーになっている場合

1. **Actionsタブでエラーを確認**
   - エラーログを確認

2. **よくあるエラー**:
   - **Pythonバージョンエラー**: ワークフローで `python-version: '3.11'` を指定していますが、最新のPythonバージョンを使用してください
   - **ビルドエラー**: `scripts/build.py` が正常に動作するかローカルで確認してください

3. **ローカルでビルドを確認**
   ```bash
   cd "/Users/sakuradamasaru/Downloads/MisesapoRenewal-main 5"
   python3 scripts/build.py
   ls -la public/index.html
   ```
   `public/index.html` が生成されていれば、ビルドは正常です。

## まとめ

GitHub PagesでREADME.mdが表示される問題は、**GitHub Pagesの設定を「GitHub Actions」に変更する**ことで解決できます。

1. Settings → Pages → Source を「GitHub Actions」に変更
2. GitHub Actionsのワークフローが正常に実行されるのを待つ
3. サイトURLにアクセスして確認

---

**最終更新**: 2025年3月


