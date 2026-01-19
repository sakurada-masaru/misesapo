# GitHubセキュリティ対策ガイド

**作成日**: 2025年12月10日  
**目的**: 公開リポジトリのセキュリティ問題を修正するための具体的な手順

---

## 🚨 発見されたセキュリティ問題

### 1. ハードコードされたパスワード（高リスク・最優先）

**場所**: `src/pages/admin/services/review.html`

```javascript
const DEV_PASSWORD = 'misesapo1234'; // 開発用パスワード
```

### 2. APIエンドポイントURLの公開（中リスク）

**場所**: `src/assets/js/cognito_auth.js`

```javascript
const apiBaseUrl = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
```

---

## 🛡️ 修正方法

### 修正1: ハードコードされたパスワードの削除（最優先）

#### Step 1: 設定ファイルの作成

**`src/assets/js/config.js`** を作成（新規ファイル）:

```javascript
// 設定ファイル（ビルド時に環境変数から注入）
// このファイルは.gitignoreに含めない（テンプレートとして管理）

window.APP_CONFIG = {
  // 開発者レビューページのパスワード
  // 本番環境では環境変数から取得
  REVIEW_PASSWORD: window.REVIEW_PASSWORD || '',
  
  // APIエンドポイントURL
  // 本番環境では環境変数から取得
  API_BASE_URL: window.API_BASE_URL || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'
};
```

#### Step 2: `review.html`の修正

**`src/pages/admin/services/review.html`** を修正:

```javascript
// 修正前
const DEV_PASSWORD = 'misesapo1234'; // 開発用パスワード

// 修正後
// config.jsを読み込む（HTMLの<head>に追加）
// <script src="/js/config.js"></script>

const DEV_PASSWORD = window.APP_CONFIG?.REVIEW_PASSWORD || '';
```

#### Step 3: ビルドスクリプトの修正

**`scripts/build.py`** に環境変数の注入機能を追加:

```python
# 環境変数から設定を読み込んで、config.jsに注入
import os

def inject_config():
    """環境変数から設定を読み込んでconfig.jsに注入"""
    config_js_path = PUBLIC / 'js' / 'config.js'
    
    # 環境変数から取得（デフォルト値は空文字）
    review_password = os.getenv('REVIEW_PASSWORD', '')
    api_base_url = os.getenv('API_BASE_URL', 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod')
    
    # config.jsの内容を生成
    config_content = f"""// 設定ファイル（ビルド時に環境変数から注入）
window.APP_CONFIG = {{
  REVIEW_PASSWORD: '{review_password}',
  API_BASE_URL: '{api_base_url}'
}};
"""
    
    # config.jsを書き込み
    config_js_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_js_path, 'w', encoding='utf-8') as f:
        f.write(config_content)
```

#### Step 4: `.env.example`の作成

**`.env.example`** を作成（新規ファイル）:

```bash
# 開発者レビューページのパスワード
REVIEW_PASSWORD=your-secure-password-here

# APIエンドポイントURL
API_BASE_URL=https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod
```

#### Step 5: `.gitignore`の確認

**`.gitignore`** に以下が含まれているか確認:

```gitignore
# Environment variables (機密情報を含む)
.env
```

#### Step 6: 環境変数の設定

**`.env`** ファイルを作成（ローカルのみ、Gitにコミットしない）:

```bash
# .envファイルを作成
cp .env.example .env

# .envファイルを編集して、実際のパスワードを設定
# REVIEW_PASSWORD=実際のパスワード
```

---

### 修正2: APIエンドポイントURLの環境変数化

#### Step 1: `cognito_auth.js`の修正

**`src/assets/js/cognito_auth.js`** を修正:

```javascript
// 修正前
const apiBaseUrl = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

// 修正後
// config.jsを読み込む（HTMLの<head>に追加）
// <script src="/js/config.js"></script>

const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
```

#### Step 2: 他のJSファイルも同様に修正

APIエンドポイントURLを使用している他のJSファイルも同様に修正:

- `src/assets/js/auth.js`
- `src/assets/js/admin-reports.js`
- その他のAPIを使用しているJSファイル

---

## 📋 実装手順（まとめ）

### 1. 設定ファイルの作成

```bash
# config.jsのテンプレートを作成
touch src/assets/js/config.js
```

### 2. ビルドスクリプトの修正

`scripts/build.py`に環境変数の注入機能を追加

### 3. 環境変数の設定

```bash
# .env.exampleを作成
cp .env.example .env

# .envファイルを編集
# REVIEW_PASSWORD=実際のパスワード
```

### 4. コードの修正

- `src/pages/admin/services/review.html`のパスワードを修正
- `src/assets/js/cognito_auth.js`のAPIエンドポイントURLを修正
- その他のJSファイルも同様に修正

### 5. ビルドとテスト

```bash
# 環境変数を設定
export REVIEW_PASSWORD=your-secure-password

# ビルドを実行
python3 scripts/build.py

# 開発サーバーを起動
python3 scripts/dev_server.py

# ブラウザで確認
# http://localhost:5173/admin/services/review.html
```

---

## 🔐 本番環境での設定

### GitHub Actionsでの環境変数設定

**`.github/workflows/pages.yml`** に環境変数を追加:

```yaml
env:
  REVIEW_PASSWORD: ${{ secrets.REVIEW_PASSWORD }}
  API_BASE_URL: ${{ secrets.API_BASE_URL }}
```

### GitHub Secretsの設定

1. GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」
2. 「New repository secret」をクリック
3. 以下のシークレットを追加:
   - `REVIEW_PASSWORD`: 実際のパスワード
   - `API_BASE_URL`: APIエンドポイントURL（必要に応じて）

---

## ✅ チェックリスト

### 修正前の確認

- [ ] ハードコードされたパスワードを特定
- [ ] APIエンドポイントURLを特定
- [ ] 影響範囲を確認

### 修正の実施

- [ ] `src/assets/js/config.js`を作成
- [ ] `scripts/build.py`を修正
- [ ] `.env.example`を作成
- [ ] `.gitignore`を確認
- [ ] `src/pages/admin/services/review.html`を修正
- [ ] `src/assets/js/cognito_auth.js`を修正
- [ ] その他のJSファイルを修正

### テスト

- [ ] ローカルでビルドが成功する
- [ ] 開発サーバーで動作確認
- [ ] パスワード認証が動作する
- [ ] APIエンドポイントが正しく動作する

### デプロイ

- [ ] GitHub Secretsを設定
- [ ] GitHub Actionsのワークフローを更新
- [ ] 本番環境で動作確認

---

## 🎯 優先順位

### 最優先（即座に対応）

1. **ハードコードされたパスワードの削除**
   - セキュリティリスクが高い
   - 修正が比較的簡単

### 中優先（1週間以内）

2. **APIエンドポイントURLの環境変数化**
   - セキュリティリスクは中程度
   - 複数のファイルを修正する必要がある

### 低優先（1ヶ月以内）

3. **パスワードのハッシュ化**
   - 開発サーバー用のため、優先度は低い
   - 本番環境では既に適切な認証システムを使用

---

## 📝 注意事項

### 1. パスワードの管理

- **開発環境**: `.env`ファイルで管理（Gitにコミットしない）
- **本番環境**: GitHub Secretsで管理
- **共有**: `.env.example`をテンプレートとして共有

### 2. 環境変数の取得方法

- **ビルド時**: `scripts/build.py`で環境変数を読み込んで注入
- **実行時**: `window.APP_CONFIG`から取得

### 3. 後方互換性

- 環境変数が設定されていない場合、デフォルト値を使用
- 既存のコードが動作するように、フォールバックを実装

---

## 🔄 修正後の状態

### 修正前

```javascript
// パスワードがコードに含まれている
const DEV_PASSWORD = 'misesapo1234';
```

### 修正後

```javascript
// 環境変数から取得
const DEV_PASSWORD = window.APP_CONFIG?.REVIEW_PASSWORD || '';
```

### メリット

- ✅ パスワードがコードに含まれない
- ✅ 環境ごとに異なるパスワードを使用可能
- ✅ セキュリティリスクが低減

---

## 📚 関連ドキュメント

- [SECURITY_RISK_ASSESSMENT.md](./SECURITY_RISK_ASSESSMENT.md) - セキュリティリスク評価
- [GITHUB_ACCESS_SETUP.md](./GITHUB_ACCESS_SETUP.md) - GitHubアクセス設定
- [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) - ローカル開発環境のセットアップ

---

**最終更新**: 2025年12月10日

