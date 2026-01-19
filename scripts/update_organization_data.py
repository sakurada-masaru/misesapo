#!/usr/bin/env python3
"""
組織図データをDynamoDBに反映するスクリプト
docs/ORGANIZATION_DATA.mdのデータを基に、全ユーザーの情報を更新します。
"""

import json
import subprocess
import sys
from datetime import datetime, timezone

# 組織図データ（docs/ORGANIZATION_DATA.mdから）
ORGANIZATION_DATA = {
    'W001': {
        'name': '正田和輝',
        'email': 'frappe.manma@gmail.com',
        'role': 'admin',  # 管理者
        'job': 'CEO',  # 担当業務
        'department': '取締役会'
    },
    'W002': {
        'name': '梅岡アレサンドレユウジ',
        'email': 'umeoka@misesapo.co.jp',
        'role': 'admin',  # 管理者
        'job': 'FS営業・清掃',
        'department': '営業'
    },
    'W003': {
        'name': '中島郁哉',
        'email': 'nakajima@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': 'メンテナンス',
        'department': '現場'
    },
    'W004': {
        'name': '板橋隆二',
        'email': 'itabashi@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': '清掃',
        'department': '現場'
    },
    'W005': {
        'name': '吉井奎吾',
        'email': 'yoshii@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': '清掃・メンテナンス',
        'department': '現場'
    },
    'W006': {
        'name': '佐々木一真',
        'email': 'sasaki@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': '清掃・メンテナンス',
        'department': '現場'
    },
    'W007': {
        'name': '大野幹太',
        'email': 'ono@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': '清掃',
        'department': '現場'
    },
    'W008': {
        'name': '平鋭未',
        'email': 'taira@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': 'FS営業・清掃',
        'department': '営業'
    },
    'W009': {
        'name': '沖智弘',
        'email': 'oki@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': 'FS営業',
        'department': '営業'
    },
    'W010': {
        'name': '北野康平',
        'email': 'okitano@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': '清掃',
        'department': '現場'
    },
    'W011': {
        'name': '熊谷円',
        'email': 'kumagai@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': '事務',
        'department': '事務'
    },
    'W012': {
        'name': '増田優香',
        'email': 'masuda@misesapo.co.jp',
        'role': 'admin',  # 管理者
        'job': '営業事務',
        'department': '事務'
    },
    'W013': {
        'name': '生井剛',
        'email': 'namai@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': 'FS営業',
        'department': '営業'
    },
    'W014': {
        'name': '太田真也',
        'email': 'ota@misesapo.co.jp',
        'role': 'admin',  # 管理者
        'job': 'スペシャルバイザー',
        'department': '開発'
    },
    'W017': {
        'name': '岡本涼子',
        'email': 'okamoto@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': '経理',
        'department': '運営'
    },
    'W018': {
        'name': '山村明広',
        'email': 'yamamura@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': 'システム開発・プログラミング',
        'department': '開発'
    },
    'W019': {
        'name': '夏目倫之助',
        'email': 'natsume@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': 'デザイン・制作',
        'department': '開発'
    },
    'W020': {
        'name': '竹内那海',
        'email': 'takeuchi@misesapo.co.jp',
        'role': 'staff',  # なし
        'job': 'デザイン・制作',
        'department': '開発'
    },
    'W021': {
        'name': '遠藤虹輝',
        'email': 'endo@misesapo.co.jp',
        'role': 'admin',  # 管理者
        'job': '清掃・メンテナンス',
        'department': '現場'
    },
    'W022': {
        'name': '関口栄一',
        'email': 'eiichi@prf.tokyo',
        'role': 'staff',  # なし
        'job': '人事',
        'department': '運営'
    },
    'W999': {
        'name': '櫻田傑',
        'email': 'sakurada@misesapo.co.jp',
        'role': 'admin',  # 管理者
        'job': '総務・開発',
        'department': '運営'
    }
}

# ロールコードマッピング（既存のマッピングを維持）
ROLE_CODE_MAP = {
    'admin': '1',
    'staff': '4',
    'sales': '5',
    'office': '6',
    'developer': '7',
    'designer': '8',
    'engineer': '9',
    'accounting': '10',
    'human_resources': '11'
}

def get_existing_user_from_dynamodb(user_id):
    """DynamoDBから既存ユーザーを取得"""
    try:
        cmd = [
            'aws', 'dynamodb', 'get-item',
            '--table-name', 'workers',
            '--key', json.dumps({'id': {'S': user_id}}),
            '--region', 'ap-northeast-1'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        if 'Item' in data:
            # DynamoDB形式から通常の辞書に変換
            item = {}
            for key, value in data['Item'].items():
                if 'S' in value:
                    item[key] = value['S']
                elif 'N' in value:
                    item[key] = value['N']
            return item
        return None
    except subprocess.CalledProcessError:
        return None
    except Exception as e:
        print(f'  ✗ 取得エラー: {user_id} - {e}')
        return None

def update_user_in_dynamodb(user_id, user_data):
    """DynamoDBにユーザーを更新"""
    now = datetime.now(timezone.utc).isoformat() + 'Z'
    
    # 既存ユーザーを取得
    existing = get_existing_user_from_dynamodb(user_id)
    created_at = existing.get('created_at') if existing else now
    
    # DynamoDBアイテムを作成
    item = {
        'id': {'S': user_id},
        'name': {'S': user_data['name']},
        'email': {'S': user_data['email']},
        'role': {'S': user_data['role']},
        'department': {'S': user_data['department']},
        'job': {'S': user_data['job']},  # 担当業務を追加
        'status': {'S': existing.get('status', 'active') if existing else 'active'},
        'role_code': {'S': ROLE_CODE_MAP.get(user_data['role'], '4')},
        'created_at': {'S': created_at},
        'updated_at': {'S': now}
    }
    
    # 既存のフィールドを保持（phone, cognito_sub など）
    if existing:
        for field in ['phone', 'cognito_sub', 'scheduled_start_time', 
                     'scheduled_end_time', 'scheduled_work_hours', 'work_pattern']:
            if field in existing:
                if isinstance(existing[field], str):
                    item[field] = {'S': existing[field]}
                elif isinstance(existing[field], (int, float)):
                    item[field] = {'N': str(existing[field])}
    
    try:
        cmd = [
            'aws', 'dynamodb', 'put-item',
            '--table-name', 'workers',
            '--item', json.dumps(item, ensure_ascii=False),
            '--region', 'ap-northeast-1'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f'✓ 更新: {user_id} - {user_data["name"]} ({user_data["email"]})')
        print(f'  ロール: {user_data["role"]}, 部署: {user_data["department"]}, 担当業務: {user_data["job"]}')
        return True
    except subprocess.CalledProcessError as e:
        print(f'✗ 更新失敗: {user_id} - {e.stderr}')
        return False
    except Exception as e:
        print(f'✗ 更新失敗: {user_id} - {e}')
        return False

def main():
    print('=' * 80)
    print('組織図データをDynamoDBに反映します')
    print('=' * 80)
    print()
    
    success_count = 0
    fail_count = 0
    
    for user_id, user_data in ORGANIZATION_DATA.items():
        print(f'処理中: {user_id} - {user_data["name"]}')
        if update_user_in_dynamodb(user_id, user_data):
            success_count += 1
        else:
            fail_count += 1
        print()
    
    print('=' * 80)
    print(f'完了: 成功 {success_count}件, 失敗 {fail_count}件')
    print('=' * 80)
    
    if fail_count > 0:
        sys.exit(1)

if __name__ == '__main__':
    main()

