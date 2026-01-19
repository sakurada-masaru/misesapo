#!/bin/bash
# AWS WorkMailでメールアドレスを作成するスクリプト

set -e

# 設定
REGION="ap-northeast-1"
DOMAIN="misesapo.app"
ORGANIZATION_ALIAS="misesapo"

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}AWS WorkMail メールアドレス作成スクリプト${NC}"
echo "=========================================="

# AWS CLIがインストールされているか確認
if ! command -v aws &> /dev/null; then
    echo -e "${RED}エラー: AWS CLIがインストールされていません${NC}"
    echo "インストール方法: https://aws.amazon.com/cli/"
    exit 1
fi

# AWS認証情報が設定されているか確認
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}エラー: AWS認証情報が設定されていません${NC}"
    echo "設定方法: aws configure"
    exit 1
fi

# 組織IDを取得
echo -e "${YELLOW}WorkMail組織を検索中...${NC}"
ORGANIZATION_ID=$(aws workmail list-organizations --region $REGION --query "OrganizationSummaries[?Alias=='$ORGANIZATION_ALIAS'].OrganizationId" --output text)

if [ -z "$ORGANIZATION_ID" ]; then
    echo -e "${YELLOW}組織が見つかりません。作成しますか？ (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${YELLOW}組織を作成中...${NC}"
        ORGANIZATION_ID=$(aws workmail create-organization \
            --alias $ORGANIZATION_ALIAS \
            --region $REGION \
            --query 'OrganizationId' \
            --output text)
        echo -e "${GREEN}組織を作成しました: $ORGANIZATION_ID${NC}"
    else
        echo "組織の作成をキャンセルしました"
        exit 1
    fi
else
    echo -e "${GREEN}組織が見つかりました: $ORGANIZATION_ID${NC}"
fi

# ドメインが登録されているか確認
echo -e "${YELLOW}ドメインを確認中...${NC}"
DOMAIN_REGISTERED=$(aws workmail list-domains \
    --organization-id $ORGANIZATION_ID \
    --region $REGION \
    --query "Domains[?Name=='$DOMAIN'].Name" \
    --output text)

if [ -z "$DOMAIN_REGISTERED" ]; then
    echo -e "${YELLOW}ドメインが登録されていません。登録しますか？ (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${YELLOW}ドメインを登録中...${NC}"
        aws workmail register-domain \
            --organization-id $ORGANIZATION_ID \
            --domain-name $DOMAIN \
            --region $REGION
        echo -e "${GREEN}ドメインを登録しました${NC}"
        echo -e "${YELLOW}注意: Route 53でDNSレコードを設定する必要があります${NC}"
    else
        echo "ドメインの登録をキャンセルしました"
        exit 1
    fi
else
    echo -e "${GREEN}ドメインが登録されています: $DOMAIN${NC}"
fi

# ユーザー情報を入力
echo ""
echo -e "${YELLOW}メールアドレス情報を入力してください${NC}"
read -p "ユーザー名（@より前の部分、例: info）: " USERNAME
read -p "表示名（例: ミセサポ管理者）: " DISPLAY_NAME
read -sp "パスワード: " PASSWORD
echo ""

# メールアドレス
EMAIL="${USERNAME}@${DOMAIN}"

# ユーザーを作成
echo -e "${YELLOW}ユーザーを作成中...${NC}"
USER_ID=$(aws workmail create-user \
    --organization-id $ORGANIZATION_ID \
    --name "$DISPLAY_NAME" \
    --display-name "$DISPLAY_NAME" \
    --password "$PASSWORD" \
    --region $REGION \
    --query 'UserId' \
    --output text 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}ユーザーを作成しました: $USER_ID${NC}"
    
    # メールボックスを作成
    echo -e "${YELLOW}メールボックスを作成中...${NC}"
    aws workmail register-to-work-mail \
        --organization-id $ORGANIZATION_ID \
        --entity-id $USER_ID \
        --email "$EMAIL" \
        --region $REGION 2>&1 || true
    
    echo ""
    echo -e "${GREEN}=========================================="
    echo "メールアドレス作成完了！"
    echo "=========================================="
    echo -e "メールアドレス: ${GREEN}$EMAIL${NC}"
    echo "組織ID: $ORGANIZATION_ID"
    echo "ユーザーID: $USER_ID"
    echo ""
    echo "次のステップ:"
    echo "1. Route 53でDNSレコードが正しく設定されているか確認"
    echo "2. メールクライアントで設定（IMAP/SMTP）"
    echo "3. Webメールでアクセスして動作確認"
    echo -e "${NC}"
else
    echo -e "${RED}エラー: ユーザーの作成に失敗しました${NC}"
    echo "$USER_ID"
    exit 1
fi

