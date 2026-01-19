#!/usr/bin/env python3
"""
API、DB、WEBページのデータ統一性を確認するスクリプト
"""

import json
import urllib.request
import time
import subprocess

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

# 組織図データ
ORG_DATA = {
    'W001': {'name': '正田和輝', 'email': 'frappe.manma@gmail.com', 'role': 'admin', 'job': 'CEO', 'department': '取締役会'},
    'W002': {'name': '梅岡アレサンドレユウジ', 'email': 'umeoka@misesapo.co.jp', 'role': 'admin', 'job': 'FS営業・清掃', 'department': '営業'},
    'W003': {'name': '中島郁哉', 'email': 'nakajima@misesapo.co.jp', 'role': 'staff', 'job': 'メンテナンス', 'department': '現場'},
    'W004': {'name': '板橋隆二', 'email': 'itabashi@misesapo.co.jp', 'role': 'staff', 'job': '清掃', 'department': '現場'},
    'W005': {'name': '吉井奎吾', 'email': 'yoshii@misesapo.co.jp', 'role': 'staff', 'job': '清掃・メンテナンス', 'department': '現場'},
    'W006': {'name': '佐々木一真', 'email': 'sasaki@misesapo.co.jp', 'role': 'staff', 'job': '清掃・メンテナンス', 'department': '現場'},
    'W007': {'name': '大野幹太', 'email': 'ono@misesapo.co.jp', 'role': 'staff', 'job': '清掃', 'department': '現場'},
    'W008': {'name': '平鋭未', 'email': 'taira@misesapo.co.jp', 'role': 'staff', 'job': 'FS営業・清掃', 'department': '営業'},
    'W009': {'name': '沖智弘', 'email': 'oki@misesapo.co.jp', 'role': 'staff', 'job': 'FS営業', 'department': '営業'},
    'W010': {'name': '北野康平', 'email': 'okitano@misesapo.co.jp', 'role': 'staff', 'job': '清掃', 'department': '現場'},
    'W011': {'name': '熊谷円', 'email': 'kumagai@misesapo.co.jp', 'role': 'staff', 'job': '事務', 'department': '事務'},
    'W012': {'name': '増田優香', 'email': 'masuda@misesapo.co.jp', 'role': 'admin', 'job': '営業事務', 'department': '事務'},
    'W013': {'name': '生井剛', 'email': 'namai@misesapo.co.jp', 'role': 'staff', 'job': 'FS営業', 'department': '営業'},
    'W014': {'name': '太田真也', 'email': 'ota@misesapo.co.jp', 'role': 'admin', 'job': 'スペシャルバイザー', 'department': '開発'},
    'W017': {'name': '岡本涼子', 'email': 'okamoto@misesapo.co.jp', 'role': 'staff', 'job': '経理', 'department': '運営'},
    'W018': {'name': '山村明広', 'email': 'yamamura@misesapo.co.jp', 'role': 'staff', 'job': 'システム開発・プログラミング', 'department': '開発'},
    'W019': {'name': '夏目倫之助', 'email': 'natsume@misesapo.co.jp', 'role': 'staff', 'job': 'デザイン・制作', 'department': '開発'},
    'W020': {'name': '竹内那海', 'email': 'takeuchi@misesapo.co.jp', 'role': 'staff', 'job': 'デザイン・制作', 'department': '開発'},
    'W021': {'name': '遠藤虹輝', 'email': 'endo@misesapo.co.jp', 'role': 'admin', 'job': '清掃・メンテナンス', 'department': '現場'},
    'W022': {'name': '関口栄一', 'email': 'eiichi@prf.tokyo', 'role': 'staff', 'job': '人事', 'department': '運営'},
    'W999': {'name': '櫻田傑', 'email': 'sakurada@misesapo.co.jp', 'role': 'admin', 'job': '総務・開発', 'department': '運営'}
}

def get_users_from_api():
    """APIから全ユーザーを取得"""
    try:
        url = f'{API_BASE}/workers?t={int(time.time() * 1000)}'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            return {str(w.get('id', '')).strip(): w for w in workers}
    except Exception as e:
        print(f'✗ API取得エラー: {e}')
        return {}

def check_consistency():
    """データの統一性をチェック"""
    print('=' * 80)
    print('API、DB、WEBページのデータ統一性を確認')
    print('=' * 80)
    print()
    
    api_users = get_users_from_api()
    valid_ids = set(ORG_DATA.keys())
    
    errors = []
    missing = []
    extra = []
    
    # 組織図データと照合
    for worker_id, org_info in ORG_DATA.items():
        if worker_id not in api_users:
            missing.append(worker_id)
            continue
        
        worker = api_users[worker_id]
        issues = []
        
        if worker.get('name', '').strip() != org_info['name']:
            issues.append(f'名前: API={worker.get("name")} vs 組織図={org_info["name"]}')
        if worker.get('email', '').strip() != org_info['email']:
            issues.append(f'メール: API={worker.get("email")} vs 組織図={org_info["email"]}')
        if worker.get('role', '').strip() != org_info['role']:
            issues.append(f'ロール: API={worker.get("role")} vs 組織図={org_info["role"]}')
        if worker.get('job', '').strip() != org_info['job']:
            issues.append(f'担当業務: API={worker.get("job")} vs 組織図={org_info["job"]}')
        if worker.get('department', '').strip() != org_info['department']:
            issues.append(f'部署: API={worker.get("department")} vs 組織図={org_info["department"]}')
        
        if issues:
            errors.append((worker_id, org_info['name'], issues))
    
    # リストにないユーザーをチェック
    for worker_id in api_users:
        if worker_id not in valid_ids:
            extra.append((worker_id, api_users[worker_id].get('name', 'N/A')))
    
    # 結果を表示
    if errors:
        print('【データ不一致】')
        print('-' * 80)
        for worker_id, name, issues in errors:
            print(f'  ✗ {worker_id} ({name}):')
            for issue in issues:
                print(f'      - {issue}')
        print('-' * 80)
        print()
    
    if missing:
        print('【組織図に存在するがAPIに存在しない】')
        print('-' * 80)
        for worker_id in missing:
            print(f'  ✗ {worker_id} ({ORG_DATA[worker_id]["name"]})')
        print('-' * 80)
        print()
    
    if extra:
        print('【リストにないユーザー（削除対象）】')
        print('-' * 80)
        for worker_id, name in extra:
            print(f'  ✗ {worker_id} ({name})')
        print('-' * 80)
        print()
    
    # サマリー
    print('=' * 80)
    if not errors and not missing and not extra:
        print('✓ データは統一されています！')
        print(f'  総ユーザー数: {len(api_users)}名（組織図: {len(ORG_DATA)}名）')
        return True
    else:
        print(f'✗ 問題が見つかりました:')
        print(f'  - データ不一致: {len(errors)}件')
        print(f'  - 欠落: {len(missing)}件')
        print(f'  - 余分: {len(extra)}件')
        return False

if __name__ == '__main__':
    success = check_consistency()
    exit(0 if success else 1)

