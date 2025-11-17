# 次のステップ: 画像ファイルのアップロード

## ✅ 完了したこと
- CSSファイルをアップロード
- JavaScriptファイルをアップロード

## 次のステップ: 画像ファイルのアップロード

### 必須の画像フォルダ

以下の3つのフォルダをアップロードしてください：

1. **`images-admin/`** - ヒーロー画像など（必須）
2. **`images-service/`** - サービス画像（縦スライダーで使用）
3. **`images-material/`** - アイコンやロゴなど（必須）

### アップロード手順

#### ステップ1: フォルダを作成

1. エックスサーバーのファイルマネージャーで `assets/images/` フォルダを開く
2. 「新規作成」→「フォルダを作成」
3. フォルダ名に `images-admin` と入力して作成
4. 同様に `images-service` と `images-material` フォルダも作成

#### ステップ2: 画像ファイルをアップロード

**方法A: 1つずつアップロード（確実）**

1. `images-admin` フォルダを開く
2. 「アップロード」ボタンをクリック
3. ローカルの `public/images-admin/` 内の全ファイルを選択
4. アップロード
5. 同様に `images-service`、`images-material` もアップロード

**方法B: ZIPファイルでアップロード（簡単・推奨）**

1. **ローカルでZIPファイルを作成:**
   - `public/images-admin/` フォルダを右クリック → 「圧縮」→ `images-admin.zip`
   - `public/images-service/` フォルダを右クリック → 「圧縮」→ `images-service.zip`
   - `public/images-material/` フォルダを右クリック → 「圧縮」→ `images-material.zip`

2. **エックスサーバーで:**
   - `assets/images/` フォルダを開く
   - ZIPファイルをアップロード
   - ZIPファイルを右クリック → 「展開」を選択
   - 展開後、ZIPファイルを削除

### 特に重要な画像（ヒーローセクション用）

以下の画像は必須です：

- `images-admin/hero-image001.png`
- `images-admin/hero-image002.png`
- `images-admin/hero-image003.png`
- `images-admin/mask-hero001.png`

これらがないと、ヒーローセクションが正しく表示されません。

## アップロード後の確認

### 1. ファイルが正しくアップロードされたか確認

ブラウザで以下のURLにアクセスして、画像が表示されるか確認：

```
https://misesapo.site/wp-content/themes/cocoon-child-master/assets/images/images-admin/hero-image001.png
https://misesapo.site/wp-content/themes/cocoon-child-master/assets/images/images-admin/mask-hero001.png
```

### 2. WordPress管理画面で確認

1. WordPress管理画面にログイン
2. サイトを表示
3. エラーメッセージが出ていないか確認

## チェックリスト

- [x] CSSファイルをアップロード
- [x] JavaScriptファイルをアップロード
- [ ] `images-admin/` フォルダと画像をアップロード
- [ ] `images-service/` フォルダと画像をアップロード
- [ ] `images-material/` フォルダと画像をアップロード
- [ ] 画像が正しく表示されるか確認

## その後のステップ

画像ファイルのアップロードが完了したら：

1. ✅ テンプレートファイルをアップロード（`templates/hero-section.php` など）
2. ✅ Elementorでショートコードをテスト
3. ✅ 動作確認


