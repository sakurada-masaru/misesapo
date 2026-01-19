# ローカル開発環境のセットアップガイド

**作成日**: 2025年12月10日  
**目的**: GitHubからコードをダウンロードした後、ローカルで表示・開発するための手順

---

## 🎯 問題の原因

**なぜ表示できないのか？**

1. **`public/`ディレクトリが存在しない**
   - `public/`ディレクトリは`.gitignore`で除外されているため、GitHubには含まれていません
   - `public/`ディレクトリは`src/pages/`からビルドして生成する必要があります

2. **ビルドが必要**
   - `src/pages/`のHTMLファイルを`public/`にビルドする必要があります
   - ビルドスクリプト（`scripts/build.py`）を実行する必要があります

3. **開発サーバーを起動する必要がある**
   - HTMLファイルを直接開くだけでは、一部の機能が動作しません
   - 開発サーバーを起動して、ブラウザでアクセスする必要があります

---

## 📋 セットアップ手順

### Step 1: リポジトリをクローン（またはダウンロード）

```bash
# Git Cloneの場合
git clone https://github.com/sakurada-masaru/misesapo.git
cd misesapo

# ZIPダウンロードの場合
# 1. https://github.com/sakurada-masaru/misesapo にアクセス
# 2. 「Code」→「Download ZIP」をクリック
# 3. ZIPファイルを解凍
# 4. ターミナルで解凍したフォルダに移動
cd misesapo-main
```

### Step 2: Pythonの確認

```bash
# Python 3がインストールされているか確認
python3 --version

# Python 3.7以上が必要です
# インストールされていない場合は、https://www.python.org/downloads/ からインストール
```

### Step 3: ビルドの実行

```bash
# ビルドスクリプトを実行
python3 scripts/build.py
```

**何が起こるか？**
- `src/pages/`のHTMLファイルが`public/`に生成されます
- `src/assets/`のファイルが`public/`にコピーされます
- `public/`ディレクトリが作成されます（存在しない場合）

**エラーが出た場合**:
- Python 3がインストールされているか確認
- `scripts/build.py`が実行可能か確認（`chmod +x scripts/build.py`）

### Step 4: 開発サーバーの起動

#### 方法1: 開発用サーバー（推奨）

```bash
# 開発サーバーを起動
python3 scripts/dev_server.py
```

**表示されるメッセージ**:
```
============================================================
🚀 開発サーバーを起動しました
============================================================
📱 ローカルアクセス: http://localhost:5173
============================================================
```

**ブラウザでアクセス**:
- `http://localhost:5173` を開く
- トップページが表示されます

#### 方法2: Python簡易サーバー

```bash
# 簡易サーバーを起動
python3 -m http.server 5173 --directory public
```

**ブラウザでアクセス**:
- `http://localhost:5173` を開く

#### 方法3: Node.js（npx serve）

```bash
# Node.jsがインストールされている場合
npx serve public
```

**ブラウザでアクセス**:
- 表示されたURL（例: `http://localhost:3000`）を開く

---

## 🔧 トラブルシューティング

### 問題1: `public/`ディレクトリが存在しない

**症状**: ビルドを実行しても`public/`ディレクトリが作成されない

**解決方法**:
```bash
# 手動でpublicディレクトリを作成
mkdir -p public

# 再度ビルドを実行
python3 scripts/build.py
```

### 問題2: ビルドエラーが発生する

**症状**: `python3 scripts/build.py`を実行するとエラーが出る

**解決方法**:
```bash
# Python 3がインストールされているか確認
python3 --version

# スクリプトが実行可能か確認
chmod +x scripts/build.py

# 再度ビルドを実行
python3 scripts/build.py
```

### 問題3: ページが表示されない

**症状**: 開発サーバーを起動しても、ページが表示されない

**解決方法**:
1. ビルドが完了しているか確認
   ```bash
   ls public/index.html
   ```

2. 開発サーバーが起動しているか確認
   - ターミナルに「🚀 開発サーバーを起動しました」と表示されているか確認

3. 正しいURLにアクセスしているか確認
   - `http://localhost:5173` にアクセス
   - `file://`で開いていないか確認（直接HTMLファイルを開くのはNG）

### 問題4: CSSやJavaScriptが読み込まれない

**症状**: ページは表示されるが、スタイルが適用されない、またはJavaScriptが動作しない

**解決方法**:
1. ビルドが完了しているか確認
   ```bash
   ls public/css/
   ls public/js/
   ```

2. 開発サーバー経由でアクセスしているか確認
   - 直接HTMLファイルを開くのではなく、開発サーバー経由でアクセス

3. ブラウザのコンソールでエラーを確認
   - F12キーで開発者ツールを開く
   - Consoleタブでエラーを確認

---

## 📝 よくある質問

### Q1: 毎回ビルドする必要があるの？

**A**: `src/pages/`を編集した場合は、ビルドを再実行する必要があります。

```bash
# 編集後、再度ビルド
python3 scripts/build.py
```

**自動ビルド**:
- 開発サーバー（`python3 scripts/dev_server.py`）を使用している場合、一部の機能で自動ビルドが実行されます

### Q2: `public/`ディレクトリを直接編集してもいいの？

**A**: **推奨しません**。

- `public/`ディレクトリは自動生成されるため、直接編集しても上書きされます
- `src/pages/`を編集してから、ビルドを実行してください

### Q3: どのファイルを編集すればいいの？

**A**: 以下のファイルを編集してください：

- **HTML**: `src/pages/` ディレクトリ内
- **CSS**: `src/assets/css/` ディレクトリ内
- **JavaScript**: `src/assets/js/` ディレクトリ内
- **共通部品**: `src/partials/` ディレクトリ内

編集後、`python3 scripts/build.py`でビルドします。

### Q4: 開発サーバーを停止する方法は？

**A**: ターミナルで `Ctrl + C` を押します。

---

## 🎯 クイックスタート（まとめ）

```bash
# 1. リポジトリをクローン（またはダウンロード）
git clone https://github.com/sakurada-masaru/misesapo.git
cd misesapo

# 2. ビルドを実行
python3 scripts/build.py

# 3. 開発サーバーを起動
python3 scripts/dev_server.py

# 4. ブラウザで http://localhost:5173 を開く
```

---

## 📚 関連ドキュメント

- [README.md](../README.md) - プロジェクトの概要
- [GITHUB_ACCESS_SETUP.md](./GITHUB_ACCESS_SETUP.md) - GitHubアクセス設定
- [GITHUB_CURSOR_WORKFLOW.md](./GITHUB_CURSOR_WORKFLOW.md) - GitHubとCursorの活用方法

---

## 💡 ヒント

### 開発の流れ

1. **編集**: `src/pages/` のファイルを編集
2. **ビルド**: `python3 scripts/build.py` を実行
3. **確認**: 開発サーバーで `http://localhost:5173` にアクセス
4. **コミット**: 変更をGitにコミット・プッシュ

### 効率的な開発

- 開発サーバー（`python3 scripts/dev_server.py`）を使用すると、一部の機能で自動ビルドが実行されます
- エディタでファイルを編集しながら、ブラウザで確認できます

---

**最終更新**: 2025年12月10日

