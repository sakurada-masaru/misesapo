# Lambda関数のデプロイ手順

## 🚀 今すぐやること

### ステップ1: Lambda関数のコードをコピー

1. **ローカルの `lambda_function.py` を開く**
   - ファイルパス: `/Users/sakuradamasaru/Desktop/misesapo-main/lambda_function.py`
   - すべての内容を選択（Cmd+A）してコピー（Cmd+C）

### ステップ2: AWS Lambdaコンソールでデプロイ

1. **AWS Lambdaコンソールを開く**
   - ブラウザで https://console.aws.amazon.com/lambda/ にアクセス
   - ログインが必要な場合はログイン

2. **Lambda関数を選択**
   - 関数一覧から、既存のLambda関数を選択
   - （例: `misesapo-s3-upload` など）

3. **コードエディタを開く**
   - 「コード」タブをクリック
   - コードエディタが表示されます

4. **コードを貼り付け**
   - エディタ内の既存のコードをすべて選択（Cmd+A / Ctrl+A）
   - 削除（Delete / Backspace）
   - コピーしたコードを貼り付け（Cmd+V / Ctrl+V）

5. **デプロイ**
   - 右上の「Deploy」ボタンをクリック
   - デプロイが完了するまで待つ（数秒〜数十秒）

### ステップ3: デプロイの確認

1. **コードが正しく反映されているか確認**
   - コードエディタで `from boto3.dynamodb.conditions import Key, Attr` が含まれているか確認
   - `get_report_detail`関数内で `Attr('report_id').eq(report_id)` が使われているか確認

2. **デプロイが完了したら**
   - 「Deploy」ボタンの下に「Last modified: ...」と表示される
   - これが最新の日時になっていればOK

---

## 🧪 ステップ4: テストを実行

デプロイが完了したら、ターミナルでテストを実行：

```bash
cd /Users/sakuradamasaru/Desktop/misesapo-main
./test-api.sh
```

---

## 🆘 うまくいかない場合

### エラー: デプロイボタンが押せない
- コードに構文エラーがある可能性があります
- エラーメッセージを確認してください

### エラー: テストがまだ失敗する
- CloudWatch Logsを確認してください
- Lambda関数の「モニタリング」タブ → 「CloudWatch Logs を表示」
- `DEBUG:` で始まるログを確認

### エラー: Lambda関数が見つからない
- 正しいAWSリージョンを選択しているか確認
- 関数名を確認してください

---

## 📝 補足

- Lambda関数のコードは、ローカルの `lambda_function.py` と同期させる必要があります
- コードを変更したら、必ずデプロイしてください
- デプロイには数秒〜数十秒かかります

