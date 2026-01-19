# カスタムドメイン設定: GitHub Pages vs AWS

## 現在の状況

- ✅ **AWSでメインドメインを管理中**（Route53など）
- ✅ **バックエンド**: AWS（Lambda + API Gateway + DynamoDB + S3）

---

## カスタムドメイン設定の比較

### GitHub Pages + カスタムドメイン

**設定方法**:
1. GitHub Pagesの設定でカスタムドメインを指定
2. DNS設定（Route53など）でCNAMEレコードを追加
   ```
   www.example.com → sakurada-masaru.github.io
   ```
3. GitHub PagesでDNS検証

**メリット**:
- ✅ ホスティングは無料
- ✅ 設定が比較的簡単

**デメリット**:
- ⚠️ DNS管理が分離（Route53とGitHub Pagesの両方を管理）
- ⚠️ SSL証明書はGitHubが自動発行（Let's Encrypt）
- ⚠️ サブドメインごとに設定が必要

**コスト**: ホスティング無料、DNSはRoute53の料金（月額 $0.50/ホストゾーン）

---

### AWS S3 + CloudFront + Route53

**設定方法**:
1. S3バケットに静的ファイルをアップロード
2. CloudFrontディストリビューションを作成
3. Route53でAレコードまたはALIASレコードを設定
   ```
   www.example.com → CloudFrontディストリビューション
   ```
4. SSL証明書はACM（AWS Certificate Manager）で無料発行

**メリット**:
- ✅ **すべてAWSで一元管理**（Route53 + S3 + CloudFront）
- ✅ メインドメインと同じAWSアカウントで管理
- ✅ SSL証明書もAWSで管理（ACM）
- ✅ サブドメインも簡単に追加可能
- ✅ CloudFrontのCDNで高速配信

**デメリット**:
- ⚠️ 設定がやや複雑（S3 + CloudFront + Route53の3つを設定）
- ⚠️ わずかなコスト（月額 $1-3程度）

**コスト**: 
- S3: ほぼ無料（最初の5GB無料）
- CloudFront: 最初の1TB無料、その後 $0.085/GB
- Route53: 月額 $0.50/ホストゾーン
- **合計: 月額 $1-3程度**（小規模なら）

---

## 推奨: **AWS S3 + CloudFront + Route53**

### 理由

1. **一元管理**
   - メインドメインと同じAWSアカウントで管理
   - Route53、S3、CloudFront、Lambda、API Gatewayすべてが同じコンソールで管理可能

2. **DNS設定が簡単**
   - Route53で既に管理しているので、ALIASレコードを追加するだけ
   - GitHub Pagesの場合は、Route53とGitHub Pagesの両方を管理する必要がある

3. **サブドメインの追加が簡単**
   - 例: `app.example.com`, `admin.example.com` など
   - Route53で簡単に追加可能

4. **SSL証明書もAWSで管理**
   - ACM（AWS Certificate Manager）で無料発行
   - CloudFrontと自動連携

5. **コストはほぼ同じ**
   - GitHub Pages: 無料（DNSはRoute53の料金）
   - AWS: 月額 $1-3程度（小規模なら）

---

## 設定手順（AWS S3 + CloudFront + Route53）

### 1. S3バケットの作成

```bash
# S3バケットを作成（例: misesapo-frontend）
aws s3 mb s3://misesapo-frontend --region ap-northeast-1

# 静的ファイルをアップロード
aws s3 sync public/ s3://misesapo-frontend --delete

# バケットポリシーを設定（CloudFrontからのアクセスのみ許可）
```

### 2. CloudFrontディストリビューションの作成

```bash
# CloudFrontディストリビューションを作成
# - Origin: S3バケット
# - Viewer Protocol Policy: Redirect HTTP to HTTPS
# - Default Root Object: index.html
```

### 3. SSL証明書の取得（ACM）

```bash
# ACMでSSL証明書をリクエスト
# - ドメイン: www.example.com（または *.example.com）
# - 検証方法: DNS検証（Route53で自動設定可能）
```

### 4. Route53でDNS設定

```bash
# Route53でAレコード（ALIAS）を追加
# - 名前: www
# - タイプ: A - IPv4 address
# - Alias: Yes
# - Alias Target: CloudFrontディストリビューション
```

### 5. デプロイの自動化

```yaml
# .github/workflows/deploy-aws.yml
name: Deploy to AWS S3 + CloudFront

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Build
        run: python3 scripts/build.py
      - name: Deploy to S3
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
      - name: Sync to S3
        run: aws s3 sync public/ s3://misesapo-frontend --delete
      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

---

## まとめ

### **AWS S3 + CloudFront + Route53を推奨**

**理由**:
1. ✅ メインドメインと同じAWSアカウントで一元管理
2. ✅ DNS設定が簡単（Route53でALIASレコードを追加するだけ）
3. ✅ サブドメインの追加が簡単
4. ✅ SSL証明書もAWSで管理
5. ✅ コストは月額 $1-3程度（小規模なら）

**次のステップ**:
1. S3バケットを作成
2. CloudFrontディストリビューションを作成
3. Route53でDNS設定
4. GitHub Actionsで自動デプロイを設定

これで、すべてAWSで一元管理できます！

