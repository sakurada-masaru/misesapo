# Lightning Child フォルダ構造とファイル配置

## テーマフォルダ名
`lightning-child`

## 完全なパス
```
/misesapo.site/public_html/corporate/wp-content/themes/lightning-child/
```

## フォルダ構造

```
lightning-child/
├── style.css                    ← 既存（Lightning Childのstyle.css）
├── functions.php                ← 既存（編集済み）
├── assets/                      ← 新規作成
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
│       ├── images-service/
│       └── images-material/
└── templates/                   ← 新規作成
    ├── hero-section.php
    ├── problem-section.php
    └── contact-box-section.php
```

## フォルダ作成手順

### Xserverのファイルマネージャーで作成

1. **Xserverのサーバーパネルにログイン**
2. **ファイルマネージャー** を開く
3. 以下のパスに移動：
   ```
   /misesapo.site/public_html/corporate/wp-content/themes/lightning-child/
   ```
4. **新規作成** → **フォルダを作成** をクリック
5. 以下のフォルダを順番に作成：

#### 1. assets フォルダ
- フォルダ名: `assets`
- パス: `/lightning-child/assets/`

#### 2. assets/css フォルダ
- フォルダ名: `css`
- パス: `/lightning-child/assets/css/`
- 親フォルダ: `assets`

#### 3. assets/js フォルダ
- フォルダ名: `js`
- パス: `/lightning-child/assets/js/`
- 親フォルダ: `assets`

#### 4. assets/images フォルダ
- フォルダ名: `images`
- パス: `/lightning-child/assets/images/`
- 親フォルダ: `assets`

#### 5. assets/images/images-admin フォルダ
- フォルダ名: `images-admin`
- パス: `/lightning-child/assets/images/images-admin/`
- 親フォルダ: `assets/images`

#### 6. assets/images/images-service フォルダ
- フォルダ名: `images-service`
- パス: `/lightning-child/assets/images/images-service/`
- 親フォルダ: `assets/images`

#### 7. assets/images/images-material フォルダ
- フォルダ名: `images-material`
- パス: `/lightning-child/assets/images/images-material/`
- 親フォルダ: `assets/images`

#### 8. templates フォルダ
- フォルダ名: `templates`
- パス: `/lightning-child/templates/`

## ファイルアップロード先

### CSSファイル
- **アップロード元（ローカル）:**
  - `public/css/style.css`
  - `public/css/swiper-bundle.min.css`

- **アップロード先:**
  - `/lightning-child/assets/css/style.css`
  - `/lightning-child/assets/css/swiper-bundle.min.css`

### JavaScriptファイル
- **アップロード元（ローカル）:**
  - `public/js/script.js`
  - `public/js/navigation.js`
  - `public/js/auth.js`
  - `public/js/swiper-bundle.min.js`

- **アップロード先:**
  - `/lightning-child/assets/js/script.js`
  - `/lightning-child/assets/js/navigation.js`
  - `/lightning-child/assets/js/auth.js`
  - `/lightning-child/assets/js/swiper-bundle.min.js`

### 画像ファイル
- **アップロード元（ローカル）:**
  - `public/images-admin/` フォルダ内の全ファイル
  - `public/images-service/` フォルダ内の全ファイル
  - `public/images-material/` フォルダ内の全ファイル

- **アップロード先:**
  - `/lightning-child/assets/images/images-admin/`
  - `/lightning-child/assets/images/images-service/`
  - `/lightning-child/assets/images/images-material/`

### テンプレートファイル
- **アップロード元（ローカル）:**
  - `wordpress-templates/hero-section.php`
  - `wordpress-templates/problem-section.php`
  - `wordpress-templates/contact-box-section.php`

- **アップロード先:**
  - `/lightning-child/templates/hero-section.php`
  - `/lightning-child/templates/problem-section.php`
  - `/lightning-child/templates/contact-box-section.php`

## パーミッション設定

### フォルダ
- パーミッション: `755`

### ファイル
- PHPファイル: `644`
- CSSファイル: `644`
- JavaScriptファイル: `644`
- 画像ファイル: `644`

## 確認方法

### フォルダ構造の確認
Xserverのファイルマネージャーで、以下のパスに移動して確認：
```
/misesapo.site/public_html/corporate/wp-content/themes/lightning-child/
```

### ファイルの存在確認
ブラウザで直接URLにアクセスして確認：
- CSS: `https://misesapo.site/wp-content/themes/lightning-child/assets/css/style.css`
- JS: `https://misesapo.site/wp-content/themes/lightning-child/assets/js/script.js`
- 画像: `https://misesapo.site/wp-content/themes/lightning-child/assets/images/images-admin/hero-image001.png`

## 次のステップ

フォルダ構造の作成が完了したら：
1. CSSファイルをアップロード
2. JavaScriptファイルをアップロード
3. 画像ファイルをアップロード
4. テンプレートファイルをアップロード

詳細は `LIGHTNING_CHILD_SETUP_GUIDE.md` を参照してください。


