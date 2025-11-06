# EmailJS セットアップガイド

フィードバック機能を自動送信するために、EmailJSを設定します。

## EmailJSとは

EmailJSは、フロントエンドから直接メールを送信できる無料サービスです。
JavaScriptコードから直接メールを送信できます。

## セットアップ手順

### 1. EmailJSアカウント作成

1. https://www.emailjs.com/ にアクセス
2. 「Sign Up」でアカウントを作成（無料プランで利用可能）

### 2. Email Service（メールサービス）の設定

1. EmailJSダッシュボードにログイン
2. 「Email Services」をクリック
3. 「Add New Service」をクリック
4. 「Gmail」を選択（または他のメールサービス）
5. 「Connect Account」をクリックしてGmailアカウントを連携
6. Service IDをコピー（例: `service_xxxxx`）

### 3. Email Template（メールテンプレート）の作成

1. 「Email Templates」をクリック
2. 「Create New Template」をクリック
3. テンプレートを設定：

**Subject（件名）:**
```
フィードバック: {{page_title}}
```

**Content（本文）:**
```
フィードバックが届きました。

ページ: {{page_title}}
URL: {{page_url}}
日時: {{timestamp}}

コメント:
{{comment}}

スクリーンショット: {{has_screenshot}}

{{screenshot_image}}
```

**重要: HTMLメールを有効にする**
1. テンプレート編集画面で「HTML」タブをクリック
2. または、テンプレート設定で「Content Type」を「HTML」に変更
3. これにより、`{{screenshot_image}}`がHTML画像として表示されます

4. 「Save」をクリック
5. Template IDをコピー（例: `template_xxxxx`）

### 4. Public Key（公開キー）の取得

1. 「Account」→「General」をクリック
2. 「Public Key」をコピー（例: `xxxxxxxxxxxxxx`）

### 5. コードに設定を反映

`src/partials/feedback-button.html` の以下の部分を編集：

```javascript
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID'; // 2で取得したService ID
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; // 3で取得したTemplate ID
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // 4で取得したPublic Key
```

実際の値に置き換えてください：

```javascript
const EMAILJS_SERVICE_ID = 'service_xxxxx';
const EMAILJS_TEMPLATE_ID = 'template_xxxxx';
const EMAILJS_PUBLIC_KEY = 'xxxxxxxxxxxxxx';
```

## 使用方法

1. 各ページの赤い矢印ボタンをクリック
2. フィードバックを入力
3. 必要に応じてスクリーンショットを撮影
4. 「送信」ボタンをクリック
5. 自動で `misesapofeedback@gmail.com` にメールが送信されます

## 注意事項

### スクリーンショットの送信について

スクリーンショットは、base64エンコードされた画像をHTMLメールとして埋め込んで送信します。

**設定方法:**

1. EmailJSのテンプレートで「HTML」モードを有効にする
2. テンプレートの本文に `{{screenshot_image}}` を追加
3. これにより、スクリーンショットがHTMLメール内の画像として表示されます

**注意事項:**
- 一部のメールクライアント（特にOutlook）では、base64画像が表示されない場合があります
- その場合は、画像ホスティングサービス（Imgur等）にアップロードしてURLを送信する方法を検討してください

### 送信制限

EmailJSの無料プランでは、月200通まで送信可能です。
それ以上送信する場合は、有料プランへのアップグレードが必要です。

## トラブルシューティング

### メールが届かない場合

1. EmailJSダッシュボードの「Logs」で送信履歴を確認
2. エラーメッセージを確認
3. Service ID、Template ID、Public Keyが正しいか確認
4. Gmailアカウントの連携が有効か確認

### 認証エラーが発生する場合

1. Public Keyが正しく設定されているか確認
2. EmailJSのアカウントが有効か確認

