#!/usr/bin/env python3
"""
清掃業務内容が設定されている人と現場部署の人をOS課に更新するスクリプト（自動実行版）
"""
import json
import urllib.request
import sys

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

def get_all_workers():
    """全ユーザーを取得"""
    try:
        url = f'{API_BASE}/workers'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            return workers
    except Exception as e:
        print(f'エラー: ユーザー取得に失敗しました - {e}')
        return []

def update_worker_department(worker_id, department):
    """ユーザーの部署を更新"""
    try:
        url = f'{API_BASE}/workers/{worker_id}'
        data = json.dumps({'department': department}).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='PUT'
        )
        
        with urllib.request.urlopen(req) as response:
            if response.status in [200, 204]:
                return True
            else:
                error_body = response.read().decode()
                print(f'  ✗ 更新失敗: {response.status} - {error_body}')
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else 'Unknown error'
        print(f'  ✗ 更新失敗: {e.code} - {error_body}')
        return False
    except Exception as e:
        print(f'  ✗ エラー: {e}')
        return False

def main():
    print('=== 部署をOS課に更新（自動実行） ===\n')
    
    # 全ユーザーを取得
    workers = get_all_workers()
    if not workers:
        print('ユーザーを取得できませんでした')
        sys.exit(1)
    
    # 更新対象者を特定
    target_workers = []
    
    for worker in workers:
        worker_id = worker.get('id')
        job = worker.get('job', '') or ''
        department = worker.get('department', '') or ''
        name = worker.get('name', 'N/A')
        
        should_update = False
        reason = ''
        
        # 清掃業務内容が設定されている人
        if job and ('清掃' in str(job) or 'cleaning' in str(job).lower()):
            should_update = True
            reason = f'清掃業務: {job}'
        
        # 現場という部署の人
        if department and ('現場' in str(department)):
            should_update = True
            reason = f'現場部署: {department}'
        
        if should_update and worker_id:
            target_workers.append({
                'id': worker_id,
                'name': name,
                'current_department': department,
                'job': job,
                'reason': reason
            })
    
    print(f'更新対象者: {len(target_workers)}人\n')
    
    if not target_workers:
        print('更新対象者が見つかりませんでした')
        sys.exit(0)
    
    # 更新対象者を表示
    for w in target_workers:
        print(f"  {w['id']}: {w['name']}")
        print(f"    現在の部署: {w['current_department']}")
        print(f"    業務: {w['job']}")
        print(f"    理由: {w['reason']}")
        print()
    
    # 更新実行
    print('更新中...\n')
    success_count = 0
    error_count = 0
    
    for w in target_workers:
        print(f"更新中: {w['id']} - {w['name']}...")
        if update_worker_department(w['id'], 'OS課'):
            print(f"  ✓ 更新成功: {w['name']} → OS課")
            success_count += 1
        else:
            print(f"  ✗ 更新失敗: {w['name']}")
            error_count += 1
        print()
    
    # 結果サマリー
    print('=== 更新結果 ===')
    print(f'成功: {success_count}人')
    print(f'失敗: {error_count}人')
    print(f'合計: {len(target_workers)}人')
    
    sys.exit(0 if error_count == 0 else 1)

if __name__ == '__main__':
    main()

