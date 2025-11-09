#!/usr/bin/env python3
"""
開発用サーバー: 静的ファイル配信 + API機能
営業事務の人がブラウザからサービスページを編集できるようにする
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

# プロジェクトのルートディレクトリ
ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"
PUBLIC = ROOT / "public"
DATA_DIR = SRC / "data"
SERVICE_ITEMS_JSON = DATA_DIR / "service_items.json"
BROWSER_CHANGES_LOG = DATA_DIR / "browser_changes.json"
BUILD_SCRIPT = ROOT / "scripts" / "build.py"

PORT = 5173


class DevServerHandler(SimpleHTTPRequestHandler):
    """開発用サーバーハンドラー: 静的ファイル配信 + API機能"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)
    
    def do_GET(self):
        """GETリクエスト: 静的ファイル配信またはAPI"""
        if self.path.startswith('/api/'):
            self.handle_api_get()
        else:
            # 通常の静的ファイル配信
            super().do_GET()
    
    def handle_api_get(self):
        """API GET処理"""
        if self.path == '/api/services':
            # サービス一覧を返す
            try:
                with open(SERVICE_ITEMS_JSON, 'r', encoding='utf-8') as f:
                    services = json.load(f)
                self.send_json_response(services)
            except Exception as e:
                self.send_error(500, f"Failed to load services: {e}")
        elif self.path == '/api/pending-changes':
            # 未反映の変更を確認
            self.handle_pending_changes()
        elif self.path == '/api/images':
            # 画像一覧を返す
            self.handle_images_list()
        else:
            self.send_error(404, "API endpoint not found")
    
    def handle_api_post(self):
        """API POST処理"""
        if self.path == '/api/services':
            # 新規サービス作成
            self.handle_create_service()
        elif self.path == '/api/pull':
            # GitHubから最新データを取得
            self.handle_git_pull()
        elif self.path == '/api/discard-changes':
            # ローカルの変更を破棄
            self.handle_discard_changes()
        elif self.path == '/api/commit-and-push':
            # Gitにコミット・プッシュ
            self.handle_commit_and_push()
        else:
            self.send_error(404, "API endpoint not found")
    
    def do_POST(self):
        """POSTリクエスト: API処理"""
        if self.path.startswith('/api/'):
            self.handle_api_post()
        else:
            self.send_error(404, "Not Found")
    
    def do_PUT(self):
        """PUTリクエスト: API処理（更新用）"""
        if self.path.startswith('/api/'):
            self.handle_api_put()
        else:
            self.send_error(404, "Not Found")
    
    def do_DELETE(self):
        """DELETEリクエスト: API処理（削除用）"""
        if self.path.startswith('/api/'):
            self.handle_api_delete()
        else:
            self.send_error(404, "Not Found")
    
    def handle_pending_changes(self):
        """未反映の変更（ブラウザ経由の変更のみ）を確認"""
        try:
            # ブラウザ経由の変更ログを読み込む
            if not BROWSER_CHANGES_LOG.exists():
                self.send_json_response({'hasChanges': False, 'changes': []})
                return
            
            with open(BROWSER_CHANGES_LOG, 'r', encoding='utf-8') as f:
                browser_changes = json.load(f)
            
            if not browser_changes:
                self.send_json_response({'hasChanges': False, 'changes': []})
                return
            
            # 現在のサービスデータを読み込む（変更内容の詳細を取得するため）
            if not SERVICE_ITEMS_JSON.exists():
                self.send_json_response({'hasChanges': False, 'changes': []})
                return
            
            with open(SERVICE_ITEMS_JSON, 'r', encoding='utf-8') as f:
                services = json.load(f)
            
            # HEADのサービスデータを読み込む（変更前の値を取得するため）
            head_services = []
            try:
                git_dir = ROOT / ".git"
                if git_dir.exists():
                    head_result = subprocess.run(
                        ['git', 'show', f'HEAD:{SERVICE_ITEMS_JSON.relative_to(ROOT)}'],
                        cwd=str(ROOT),
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if head_result.returncode == 0 and head_result.stdout:
                        head_services = json.loads(head_result.stdout)
            except:
                # HEADにファイルがない場合（新規ファイル）は空リスト
                pass
            
            # ブラウザ経由の変更を処理
            changes = []
            for change_log in browser_changes:
                service_id = change_log.get('serviceId')
                change_type = change_log.get('type')  # 'created' or 'modified'
                service_name = change_log.get('serviceName', f'サービスID {service_id}')
                timestamp = change_log.get('timestamp', self.get_file_timestamp(SERVICE_ITEMS_JSON))
                
                # 現在のサービスデータを取得
                service = next((s for s in services if s.get('id') == service_id), None)
                if not service:
                    continue
                
                # 変更内容の詳細を取得
                if change_type == 'created':
                    # 新規作成の場合
                    changed_fields = self.get_changed_fields(None, service)
                else:
                    # 編集の場合
                    head_service = next((s for s in head_services if s.get('id') == service_id), None)
                    changed_fields = self.get_changed_fields(head_service, service)
                
                changes.append({
                    'serviceId': service_id,
                    'serviceName': service_name,
                    'type': change_type,
                    'timestamp': timestamp,
                    'changedFields': changed_fields
                })
            
            self.send_json_response({
                'hasChanges': len(changes) > 0,
                'changes': changes
            })
        except Exception as e:
            self.send_json_response({'hasChanges': False, 'changes': [], 'error': str(e)})
    
    def handle_images_list(self):
        """画像一覧を取得"""
        try:
            images_dir = PUBLIC / "images"
            if not images_dir.exists():
                self.send_json_response({'images': []})
                return
            
            # 画像ファイルを再帰的に検索
            image_extensions = {'.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'}
            images = []
            
            for img_path in images_dir.rglob('*'):
                if img_path.is_file() and img_path.suffix.lower() in image_extensions:
                    # public/からの相対パスを取得
                    rel_path = img_path.relative_to(PUBLIC)
                    # /images/... の形式に変換
                    image_path = '/' + str(rel_path).replace('\\', '/')
                    images.append({
                        'path': image_path,
                        'name': img_path.name,
                        'size': img_path.stat().st_size,
                        'extension': img_path.suffix.lower()
                    })
            
            # パスでソート
            images.sort(key=lambda x: x['path'])
            
            self.send_json_response({'images': images})
        except Exception as e:
            self.send_json_response({'images': [], 'error': str(e)})
    
    def get_changed_fields(self, old_service, new_service):
        """サービスオブジェクトの変更されたフィールドを特定して返す"""
        if old_service is None:
            # 新規サービスの場合、すべてのフィールドを変更として表示
            changed_fields = []
            important_fields = ['title', 'category', 'price', 'image', 'description', 'problems', 'solution', 'sections', 'forms', 'details']
            for field in important_fields:
                value = new_service.get(field)
                if value is not None and value != '' and value != []:
                    changed_fields.append({
                        'field': field,
                        'fieldName': self.get_field_name(field),
                        'oldValue': None,
                        'newValue': self.format_field_value(field, value)
                    })
            return changed_fields
        
        # 編集されたサービスの場合、変更されたフィールドのみを表示
        changed_fields = []
        important_fields = ['title', 'category', 'price', 'image', 'description', 'problems', 'solution', 'sections', 'forms', 'details']
        
        for field in important_fields:
            old_value = old_service.get(field)
            new_value = new_service.get(field)
            
            # 値が異なる場合のみ変更として扱う
            if old_value != new_value:
                changed_fields.append({
                    'field': field,
                    'fieldName': self.get_field_name(field),
                    'oldValue': self.format_field_value(field, old_value),
                    'newValue': self.format_field_value(field, new_value)
                })
        
        return changed_fields
    
    def get_field_name(self, field):
        """フィールド名を日本語に変換"""
        field_names = {
            'title': 'サービス名',
            'category': 'カテゴリー',
            'price': '価格',
            'image': 'サービスメイン画像',
            'description': '説明',
            'problems': '問題点',
            'solution': '解決策',
            'sections': 'モーダルセクション',
            'forms': 'フォームセクション',
            'details': '詳細セクション'
        }
        return field_names.get(field, field)
    
    def format_field_value(self, field, value):
        """フィールドの値を表示用にフォーマット"""
        if value is None:
            return '(未設定)'
        if value == '':
            return '(空)'
        if value == []:
            return '(空の配列)'
        
        if field == 'problems' and isinstance(value, list):
            return f"{len(value)}項目: {', '.join(str(v) for v in value[:3])}" + ('...' if len(value) > 3 else '')
        if field in ['sections', 'forms', 'details'] and isinstance(value, list):
            return f"{len(value)}セクション"
        if isinstance(value, str) and len(value) > 50:
            return value[:50] + '...'
        
        return str(value)
    
    def get_file_timestamp(self, file_path: Path) -> str:
        """ファイルの更新日時を取得"""
        try:
            import datetime
            mtime = file_path.stat().st_mtime
            dt = datetime.datetime.fromtimestamp(mtime)
            return dt.strftime('%Y-%m-%d %H:%M')
        except:
            return '不明'
    
    def log_browser_change(self, service_id, change_type, service_data):
        """ブラウザ経由の変更をログに記録"""
        try:
            # 変更ログを読み込む
            if BROWSER_CHANGES_LOG.exists():
                with open(BROWSER_CHANGES_LOG, 'r', encoding='utf-8') as f:
                    changes = json.load(f)
            else:
                changes = []
            
            # 既存の同じサービスIDのログを削除（重複防止）
            changes = [c for c in changes if c.get('serviceId') != service_id]
            
            # 新しい変更を追加
            import datetime
            changes.append({
                'serviceId': service_id,
                'serviceName': service_data.get('title', f'サービスID {service_id}'),
                'type': change_type,  # 'created' or 'modified'
                'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
                'serviceData': service_data  # 変更時のサービスデータを保存
            })
            
            # ログを保存
            with open(BROWSER_CHANGES_LOG, 'w', encoding='utf-8') as f:
                json.dump(changes, f, ensure_ascii=False, indent=2)
        except Exception as e:
            # ログ記録の失敗は無視（メイン処理には影響しない）
            pass
    
    def handle_create_service(self):
        """新規サービス作成処理"""
        try:
            # リクエストボディを読み込む
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            service_data = json.loads(body.decode('utf-8'))
            
            # 既存のサービスを読み込む
            if SERVICE_ITEMS_JSON.exists():
                with open(SERVICE_ITEMS_JSON, 'r', encoding='utf-8') as f:
                    services = json.load(f)
            else:
                services = []
            
            # 新しいIDを生成
            max_id = max([s.get('id', 0) for s in services], default=0)
            new_id = max_id + 1
            service_data['id'] = new_id
            
            # 新しいサービスを追加
            services.append(service_data)
            
            # JSONファイルを保存
            with open(SERVICE_ITEMS_JSON, 'w', encoding='utf-8') as f:
                json.dump(services, f, ensure_ascii=False, indent=2)
            
            # ブラウザ経由の変更をログに記録
            self.log_browser_change(new_id, 'created', service_data)
            
            # ビルドを実行（非同期）
            self.run_build_async()
            
            # 成功レスポンス
            self.send_json_response({
                'status': 'success',
                'id': new_id,
                'message': 'サービスを登録しました'
            })
        except Exception as e:
            self.send_error(500, f"Failed to create service: {e}")
    
    def handle_git_pull(self):
        """GitHubから最新データを取得"""
        try:
            # Gitリポジトリか確認
            git_dir = ROOT / ".git"
            if not git_dir.exists():
                self.send_json_response({
                    'status': 'error',
                    'message': 'Gitリポジトリが見つかりません'
                })
                return
            
            # git pullを実行
            result = subprocess.run(
                ['git', 'pull', 'origin', 'main'],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # ビルドを実行（非同期）
                self.run_build_async()
                
                self.send_json_response({
                    'status': 'success',
                    'message': 'GitHubから最新データを取得しました',
                    'output': result.stdout
                })
            else:
                self.send_json_response({
                    'status': 'error',
                    'message': 'git pullに失敗しました',
                    'error': result.stderr
                })
        except subprocess.TimeoutExpired:
            self.send_json_response({
                'status': 'error',
                'message': 'git pullがタイムアウトしました'
            })
        except Exception as e:
            self.send_json_response({
                'status': 'error',
                'message': f'エラーが発生しました: {str(e)}'
            })
    
    def handle_discard_changes(self):
        """ローカルの変更を破棄"""
        try:
            # Gitリポジトリか確認
            git_dir = ROOT / ".git"
            if not git_dir.exists():
                self.send_json_response({
                    'status': 'error',
                    'message': 'Gitリポジトリが見つかりません'
                })
                return
            
            # 変更を破棄（service_items.jsonとpublic/admin/services/）
            files_to_discard = [
                str(SERVICE_ITEMS_JSON.relative_to(ROOT)),
                'public/admin/services/'
            ]
            
            results = []
            for file_path in files_to_discard:
                result = subprocess.run(
                    ['git', 'restore', file_path],
                    cwd=str(ROOT),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                results.append({
                    'file': file_path,
                    'success': result.returncode == 0,
                    'error': result.stderr if result.returncode != 0 else None
                })
            
            # 未追跡ファイルを削除（public/admin/services/内の新規ファイル）
            subprocess.run(
                ['git', 'clean', '-fd', 'public/admin/services/'],
                cwd=str(ROOT),
                capture_output=True,
                timeout=10
            )
            
            # ブラウザ経由の変更ログもクリア
            if BROWSER_CHANGES_LOG.exists():
                with open(BROWSER_CHANGES_LOG, 'w', encoding='utf-8') as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
            
            # ビルドを実行（非同期）
            self.run_build_async()
            
            self.send_json_response({
                'status': 'success',
                'message': 'ローカルの変更を破棄しました',
                'results': results
            })
        except subprocess.TimeoutExpired:
            self.send_json_response({
                'status': 'error',
                'message': '変更の破棄がタイムアウトしました'
            })
        except Exception as e:
            self.send_json_response({
                'status': 'error',
                'message': f'エラーが発生しました: {str(e)}'
            })
    
    def handle_commit_and_push(self):
        """Gitにコミット・プッシュ（手動実行）"""
        try:
            # Gitリポジトリか確認
            git_dir = ROOT / ".git"
            if not git_dir.exists():
                self.send_json_response({
                    'status': 'error',
                    'message': 'Gitリポジトリが見つかりません'
                })
                return
            
            # 変更があるか確認
            result = subprocess.run(
                ['git', 'status', '--porcelain'],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if not result.stdout.strip():
                self.send_json_response({
                    'status': 'info',
                    'message': 'コミットする変更がありません'
                })
                return
            
            # 変更をステージング
            add_result = subprocess.run(
                ['git', 'add', 'src/data/service_items.json', 'public/'],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if add_result.returncode != 0:
                self.send_json_response({
                    'status': 'error',
                    'message': 'ファイルのステージングに失敗しました',
                    'error': add_result.stderr
                })
                return
            
            # コミット
            commit_message = "chore: サービス管理の更新"
            commit_result = subprocess.run(
                ['git', 'commit', '-m', commit_message],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if commit_result.returncode != 0:
                self.send_json_response({
                    'status': 'error',
                    'message': 'コミットに失敗しました',
                    'error': commit_result.stderr
                })
                return
            
            # ブラウザ経由の変更ログをクリア
            if BROWSER_CHANGES_LOG.exists():
                with open(BROWSER_CHANGES_LOG, 'w', encoding='utf-8') as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
                # ログファイルもコミット
                subprocess.run(
                    ['git', 'add', str(BROWSER_CHANGES_LOG.relative_to(ROOT))],
                    cwd=str(ROOT),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                subprocess.run(
                    ['git', 'commit', '-m', 'chore: ブラウザ変更ログをクリア'],
                    cwd=str(ROOT),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
            
            # プッシュ（リモートが設定されている場合のみ）
            remote_result = subprocess.run(
                ['git', 'remote', '-v'],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if not remote_result.stdout.strip():
                self.send_json_response({
                    'status': 'error',
                    'message': 'リモートリポジトリが設定されていません'
                })
                return
            
            push_result = subprocess.run(
                ['git', 'push', 'origin', 'main'],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if push_result.returncode == 0:
                self.send_json_response({
                    'status': 'success',
                    'message': 'GitHubにプッシュしました。数分後にGitHub Pagesに反映されます。',
                    'output': push_result.stdout
                })
            else:
                self.send_json_response({
                    'status': 'error',
                    'message': 'プッシュに失敗しました',
                    'error': push_result.stderr
                })
                
        except subprocess.TimeoutExpired:
            self.send_json_response({
                'status': 'error',
                'message': 'Git操作がタイムアウトしました'
            })
        except Exception as e:
            self.send_json_response({
                'status': 'error',
                'message': f'エラーが発生しました: {str(e)}'
            })
    
    def handle_api_put(self):
        """API PUT処理: サービス更新"""
        # /api/services/{id} の形式をパース
        path_parts = self.path.split('/')
        if len(path_parts) == 4 and path_parts[1] == 'api' and path_parts[2] == 'services':
            service_id = int(path_parts[3])
            try:
                # リクエストボディを読み込む
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                service_data = json.loads(body.decode('utf-8'))
                
                # 既存のサービスを読み込む
                with open(SERVICE_ITEMS_JSON, 'r', encoding='utf-8') as f:
                    services = json.load(f)
                
                # サービスを更新
                updated = False
                for i, service in enumerate(services):
                    if service.get('id') == service_id:
                        service_data['id'] = service_id
                        services[i] = service_data
                        updated = True
                        break
                
                if not updated:
                    self.send_error(404, f"Service {service_id} not found")
                    return
                
                # JSONファイルを保存
                with open(SERVICE_ITEMS_JSON, 'w', encoding='utf-8') as f:
                    json.dump(services, f, ensure_ascii=False, indent=2)
                
                # ブラウザ経由の変更をログに記録
                self.log_browser_change(service_id, 'modified', service_data)
                
                # ビルドを実行（非同期）
                self.run_build_async()
                
                # 成功レスポンス
                self.send_json_response({
                    'status': 'success',
                    'id': service_id,
                    'message': 'サービスを更新しました'
                })
            except Exception as e:
                self.send_error(500, f"Failed to update service: {e}")
        else:
            self.send_error(404, "API endpoint not found")
    
    def handle_api_delete(self):
        """API DELETE処理: サービス削除"""
        # /api/services/{id} の形式をパース
        path_parts = self.path.split('/')
        if len(path_parts) == 4 and path_parts[1] == 'api' and path_parts[2] == 'services':
            service_id = int(path_parts[3])
            try:
                # 既存のサービスを読み込む
                with open(SERVICE_ITEMS_JSON, 'r', encoding='utf-8') as f:
                    services = json.load(f)
                
                # サービスを削除
                services = [s for s in services if s.get('id') != service_id]
                
                # JSONファイルを保存
                with open(SERVICE_ITEMS_JSON, 'w', encoding='utf-8') as f:
                    json.dump(services, f, ensure_ascii=False, indent=2)
                
                # ビルドを実行（非同期）
                self.run_build_async()
                
                # 成功レスポンス
                self.send_json_response({
                    'status': 'success',
                    'id': service_id,
                    'message': 'サービスを削除しました'
                })
            except Exception as e:
                self.send_error(500, f"Failed to delete service: {e}")
        else:
            self.send_error(404, "API endpoint not found")
    
    def send_json_response(self, data, status=200):
        """JSONレスポンスを送信"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = json.dumps(data, ensure_ascii=False)
        self.wfile.write(response.encode('utf-8'))
    
    def run_build_async(self):
        """ビルドを非同期で実行（ページ生成を自動化）"""
        def build():
            try:
                result = subprocess.run(
                    [sys.executable, str(BUILD_SCRIPT)],
                    cwd=str(ROOT),
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                if result.returncode != 0:
                    print(f"Build error: {result.stderr}", file=sys.stderr)
                    return
                
                # ビルド成功後、自動的にGitHubにコミット・プッシュは行わない
                # 技術者が確認してから手動で実行する
            except Exception as e:
                print(f"Build exception: {e}", file=sys.stderr)
        
        # 別スレッドでビルドを実行（レスポンスをブロックしない）
        thread = threading.Thread(target=build)
        thread.daemon = True
        thread.start()
    
    def auto_commit_and_push(self):
        """自動的にGitHubにコミット・プッシュ（オプション機能）"""
        try:
            # Gitリポジトリか確認
            git_dir = ROOT / ".git"
            if not git_dir.exists():
                print("⚠️  Gitリポジトリではありません。自動コミットをスキップします。")
                return
            
            # 変更があるか確認
            result = subprocess.run(
                ['git', 'status', '--porcelain'],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if not result.stdout.strip():
                print("ℹ️  変更がないため、コミットをスキップします。")
                return
            
            # 変更をステージング
            subprocess.run(
                ['git', 'add', 'src/data/service_items.json', 'public/'],
                cwd=str(ROOT),
                capture_output=True,
                timeout=10
            )
            
            # コミット
            commit_message = f"chore: サービス管理の更新（自動コミット）"
            subprocess.run(
                ['git', 'commit', '-m', commit_message],
                cwd=str(ROOT),
                capture_output=True,
                timeout=10
            )
            
            # プッシュ（リモートが設定されている場合のみ）
            result = subprocess.run(
                ['git', 'remote', '-v'],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.stdout.strip():
                subprocess.run(
                    ['git', 'push', 'origin', 'main'],
                    cwd=str(ROOT),
                    capture_output=True,
                    timeout=30
                )
                print("✅ GitHubに自動プッシュしました。数分後にGitHub Pagesに反映されます。")
            else:
                print("⚠️  リモートリポジトリが設定されていません。手動でプッシュしてください。")
                
        except subprocess.TimeoutExpired:
            print("⚠️  Git操作がタイムアウトしました。手動でプッシュしてください。")
        except Exception as e:
            print(f"⚠️  自動コミット・プッシュに失敗しました: {e}")
            print("   手動で以下のコマンドを実行してください:")
            print("   git add src/data/service_items.json public/")
            print("   git commit -m 'chore: サービス管理の更新'")
            print("   git push origin main")
    
    def log_message(self, format, *args):
        """ログメッセージをカスタマイズ"""
        # ビルドログを抑制
        if 'build.py' not in str(args):
            super().log_message(format, *args)


def main():
    """メイン関数: サーバーを起動"""
    if not PUBLIC.exists():
        print(f"Error: {PUBLIC} directory not found")
        print("Please run: python3 scripts/build.py")
        sys.exit(1)
    
    if not SERVICE_ITEMS_JSON.exists():
        print(f"Warning: {SERVICE_ITEMS_JSON} not found")
        print("Creating empty service_items.json...")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(SERVICE_ITEMS_JSON, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)
    
    # ブラウザ変更ログファイルが存在しない場合は作成
    if not BROWSER_CHANGES_LOG.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(BROWSER_CHANGES_LOG, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)
    
    server = HTTPServer(('', PORT), DevServerHandler)
    print(f"開発サーバーを起動しました: http://localhost:{PORT}")
    print(f"APIエンドポイント: http://localhost:{PORT}/api/services")
    print("Ctrl+C で停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nサーバーを停止しました")
        server.shutdown()


if __name__ == '__main__':
    main()

