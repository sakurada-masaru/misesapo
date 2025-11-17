# エックスサーバー ファイルマネージャー操作ガイド

## 準備完了したファイル

以下のファイルを準備しました：
- `wordpress-templates/hero-section.php` - ヒーローセクション
- `wordpress-templates/problem-section.php` - お悩みセクション

## エックスサーバー ファイルマネージャーでの操作手順

### ステップ1: ファイルマネージャーにログイン

1. **エックスサーバーのサーバーパネルにログイン**
2. **「ファイルマネージャー」をクリック**
3. **対象ドメインを選択**（misesapo.site）
4. **「ファイルマネージャーを開く」をクリック**

### ステップ2: テーマフォルダに移動

1. **`public_html` をクリック**
2. **`corporate` をクリック**
3. **`wp-content` をクリック**
4. **`themes` をクリック**
5. **`cocoon-child-master` をクリック**

現在のパス: `/public_html/corporate/wp-content/themes/cocoon-child-master/`

### ステップ3: フォルダを作成

#### 3-1. `assets` フォルダを作成

1. **「新規作成」ボタンをクリック**
2. **「フォルダを作成」を選択**
3. **フォルダ名に `assets` と入力**
4. **「作成」をクリック**

#### 3-2. `assets` フォルダ内にサブフォルダを作成

1. **`assets` フォルダを開く**
2. **「新規作成」→「フォルダを作成」**
3. **以下のフォルダを順番に作成**:
   - `css`
   - `js`
   - `images`

#### 3-3. `templates` フォルダを作成

1. **`cocoon-child-master` フォルダに戻る**
2. **「新規作成」→「フォルダを作成」**
3. **フォルダ名に `templates` と入力**
4. **「作成」をクリック**

### ステップ4: テンプレートファイルをアップロード

#### 4-1. `hero-section.php` をアップロード

1. **`templates` フォルダを開く**
2. **「アップロード」ボタンをクリック**
3. **「ファイルを選択」をクリック**
4. **ローカルの `wordpress-templates/hero-section.php` を選択**
5. **「アップロード」をクリック**

#### 4-2. `problem-section.php` をアップロード

1. **同じ `templates` フォルダ内で**
2. **「アップロード」ボタンをクリック**
3. **ローカルの `wordpress-templates/problem-section.php` を選択**
4. **「アップロード」をクリック**

### ステップ5: CSS/JS/画像ファイルをアップロード

#### 5-1. CSSファイルをアップロード

1. **`assets/css/` フォルダを開く**
2. **「アップロード」ボタンをクリック**
3. **以下のファイルをアップロード**:
   - ローカルの `public/css/style.css`
   - ローカルの `public/css/swiper-bundle.min.css`

**注意**: 複数ファイルを一度にアップロードする場合は、Ctrlキー（MacはCmdキー）を押しながら選択

#### 5-2. JavaScriptファイルをアップロード

1. **`assets/js/` フォルダを開く**
2. **「アップロード」ボタンをクリック**
3. **以下のファイルをアップロード**:
   - ローカルの `public/js/script.js`
   - ローカルの `public/js/navigation.js`
   - ローカルの `public/js/auth.js`
   - ローカルの `public/js/swiper-bundle.min.js`

#### 5-3. 画像ファイルをアップロード

1. **`assets/images/` フォルダを開く**
2. **「アップロード」ボタンをクリック**

**方法A: フォルダごとアップロード（推奨）**

エックスサーバーのファイルマネージャーではフォルダの直接アップロードができないため、以下の手順：

1. **`assets/images/` フォルダ内で、まず `images-admin` フォルダを作成**
2. **`images-admin` フォルダを開く**
3. **ローカルの `public/images-admin/` 内の全ファイルを選択してアップロード**
4. **同様に `images-service`、`images-material` フォルダも作成してアップロード**

**方法B: ZIPファイルでアップロード（簡単）**

1. **ローカルで `public/images-admin/`、`public/images-service/`、`public/images-material/` をZIPに圧縮**
2. **`assets/images/` フォルダにZIPファイルをアップロード**
3. **ZIPファイルを右クリック → 「展開」を選択**
4. **展開後、ZIPファイルを削除**

### ステップ6: ファイル構成の確認

最終的な構成：

```
cocoon-child-master/
├── style.css
├── functions.php
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── swiper-bundle.min.css
│   ├── js/
│   │   ├── script.js
│   │   ├── navigation.js
│   │   ├── auth.js
│   │   └── swiper-bundle.min.js
│   └── images/
│       ├── images-admin/
│       │   ├── hero-image001.png
│       │   ├── hero-image002.png
│       │   ├── hero-image003.png
│       │   ├── mask-hero001.png
│       │   └── ...（その他の画像）
│       ├── images-service/
│       │   ├── service01.jpg
│       │   └── ...（その他の画像）
│       └── images-material/
│           └── ...（その他の画像）
└── templates/
    ├── hero-section.php
    └── problem-section.php
```

## パーミッションの設定

エックスサーバーでは通常、自動的に適切なパーミッションが設定されますが、確認する場合：

1. **ファイルを右クリック**
2. **「パーミッション変更」を選択**
3. **以下の設定**:
   - **ファイル**: `644`
   - **フォルダ**: `755`

## 動作確認

### 1. ブラウザで確認

以下のURLにアクセスして、ファイルが読み込まれているか確認：

```
https://misesapo.site/wp-content/themes/cocoon-child-master/assets/css/style.css
https://misesapo.site/wp-content/themes/cocoon-child-master/assets/js/script.js
```

### 2. WordPress管理画面で確認

1. **WordPress管理画面にログイン**
2. **Elementorでページを編集**
3. **ショートコードウィジェットを追加**
4. **`[misesapo_hero]` と入力**
5. **プレビューで表示されるか確認**

## トラブルシューティング

### ファイルがアップロードできない

- **ファイルサイズ制限を確認**（通常10MBまで）
- **大きなファイルは分割してアップロード**
- **ZIPファイルで圧縮してアップロード後、展開**

### 404エラーが出る

- **ファイルパスを確認**
- **ファイル名の大文字小文字を確認**
- **ファイルが実際に存在するか確認**

### パーミッションエラー

- **ファイルのパーミッションを `644` に設定**
- **フォルダのパーミッションを `755` に設定**

## 次のステップ

1. ✅ フォルダを作成
2. ✅ テンプレートファイルをアップロード
3. ✅ CSS/JS/画像ファイルをアップロード
4. ⬜ Elementorでショートコードをテスト
5. ⬜ 動作確認

## 補足: 一括アップロードの方法

大量のファイルをアップロードする場合、FTPクライアント（FileZilla等）を使用することを推奨します：

1. **FileZillaをダウンロード・インストール**
2. **エックスサーバーのFTP情報で接続**
3. **ローカルの `public/` フォルダから、サーバーの `assets/` フォルダへドラッグ&ドロップ**

FTP情報は、エックスサーバーのサーバーパネル > 「FTPアカウント設定」で確認できます。


