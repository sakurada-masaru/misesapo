# GitHub Personal Access Token (PAT) 設定ガイド

GitHubへのプッシュ時に認証情報の問題が発生した場合の対処方法です。

## 問題の症状

以下のようなエラーが発生する場合があります：

```
could not read Username for 'https://github.com': Device not configured
```

または

```
Keychain から資格情報を取得しようとしても項目が見つからない
```

## 解決方法：PAT（Personal Access Token）の設定

### 1. GitHubでPATを作成

1. GitHubにログイン
2. 右上のプロフィール画像をクリック → **Settings**
3. 左サイドバーの最下部 → **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. **Generate new token** → **Generate new token (classic)**
6. 以下の設定を入力：
   - **Note**: `misesapo-repo-access`（任意の名前）
   - **Expiration**: 希望の有効期限（例: 90 days, 1 year）
   - **Select scopes**: 以下の権限にチェック
     - ✅ `repo`（リポジトリへのフルアクセス）
7. **Generate token** をクリック
8. **重要**: 表示されたトークンをコピー（この画面を閉じると二度と表示されません）

### 2. PATをキーチェーンに保存（macOS）

#### 方法A: コマンドラインで設定（推奨）

```bash
# リポジトリのディレクトリに移動
cd /Users/sakuradamasaru/Desktop/misesapo-main

# リモートURLを確認（HTTPSであることを確認）
git remote -v

# キーチェーンにPATを保存
# ユーザー名: あなたのGitHubユーザー名
# パスワード: 先ほどコピーしたPAT
git credential-osxkeychain store
```

実行すると、以下の入力を求められます：
```
protocol=https
host=github.com
username=sakurada-masaru
password=<ここにPATを貼り付け>
```

入力後、空行でEnterを押して終了します。

#### 方法B: 初回プッシュ時に自動保存

初回プッシュ時に認証情報を求められた場合：

```bash
cd /Users/sakuradamasaru/Desktop/misesapo-main
git push origin main
```

プロンプトが表示されたら：
- **Username**: あなたのGitHubユーザー名（例: `sakurada-masaru`）
- **Password**: PAT（通常のパスワードではなく、作成したPAT）

これでキーチェーンに自動保存されます。

### 3. 設定の確認

```bash
# 認証情報ヘルパーの確認
git config --list | grep credential

# リモートURLの確認
git remote -v

# テストプッシュ（小さな変更で試す）
git status
# 変更があればコミットしてから
git push origin main
```

### 4. キーチェーンから認証情報を確認・削除（必要に応じて）

#### キーチェーンアクセスで確認

1. **キーチェーンアクセス**アプリを開く
2. **ログイン** → **パスワード**を選択
3. `github.com` で検索
4. 該当項目をダブルクリックして内容を確認

#### 古い認証情報を削除

```bash
# キーチェーンから削除
git credential-osxkeychain erase
```

実行後、以下を入力：
```
protocol=https
host=github.com
```

空行でEnterを押して終了。

### 5. トラブルシューティング

#### PATが無効になった場合

1. GitHub → Settings → Developer settings → Personal access tokens
2. 該当するトークンを確認（無効化されている場合は再作成）
3. 新しいPATで上記の手順を再実行

#### 認証情報が保存されない場合

```bash
# 認証情報ヘルパーを再設定
git config --global credential.helper osxkeychain

# 確認
git config --list | grep credential
```

#### HTTPS接続の問題

```bash
# SSL検証を一時的に無効化（非推奨、開発環境のみ）
GIT_SSL_NO_VERIFY=1 git push origin main

# ただし、通常は不要です。SSL証明書の問題がある場合は別途対応が必要です。
```

## セキュリティ上の注意

- **PATはパスワードと同じように扱う**: 他人に共有しない、公開しない
- **必要最小限の権限**: `repo` スコープのみを付与（必要に応じて）
- **定期的な更新**: 有効期限を設定し、定期的に更新する
- **無効化**: 不要になったPATはGitHubの設定画面から無効化する

## 参考リンク

- [GitHub公式: Creating a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Git公式: Credential Storage](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage)

