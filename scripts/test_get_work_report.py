#!/usr/bin/env python3
"""
GET /admin/work-reports/{id} の Status を確認し、失敗時は Response body を保存する。
実行: python3 scripts/test_get_work_report.py [work_report_id] [cognito_id_token]
例: python3 scripts/test_get_work_report.py 28c19e6e-225f-4497-9148-24b491845c56
    または環境変数 COGNITO_ID_TOKEN を設定
"""
import os
import sys
import json
import subprocess
from datetime import datetime

API_BASE = 'https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod'
WORK_REPORT_ID = sys.argv[1] if len(sys.argv) >= 2 else '28c19e6e-225f-4497-9148-24b491845c56'
COGNITO_ID_TOKEN = sys.argv[2] if len(sys.argv) >= 3 else os.environ.get('COGNITO_ID_TOKEN', '')

def main():
    url = f'{API_BASE}/admin/work-reports/{WORK_REPORT_ID}'
    headers = ['-H', 'Content-Type: application/json', '-H', 'Origin: https://misesapo.co.jp']
    if COGNITO_ID_TOKEN:
        headers.extend(['-H', f'Authorization: Bearer {COGNITO_ID_TOKEN}'])
    else:
        print('⚠️  COGNITO_ID_TOKEN が設定されていません。認証なしでリクエストします。', file=sys.stderr)
    
    print(f'GET {url}')
    print('---')
    
    try:
        # curl でリクエスト（ヘッダーとボディを分離）
        cmd = ['curl', '-i', '-s', '-w', '\nHTTP_CODE:%{http_code}', '-X', 'GET', url] + headers
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        output = result.stdout
        # HTTP_CODE:xxx を抽出
        if 'HTTP_CODE:' in output:
            parts = output.rsplit('HTTP_CODE:', 1)
            response_text = parts[0]
            status_code_str = parts[1].strip()
            try:
                status_code = int(status_code_str)
            except:
                status_code = 0
        else:
            response_text = output
            status_code = 0
        
        # ヘッダーとボディを分離
        if '\n\n' in response_text:
            header_text, body_text = response_text.split('\n\n', 1)
        else:
            header_text = response_text
            body_text = ''
        
        print('Response Headers:')
        for line in header_text.split('\n'):
            if line.strip() and (line.lower().startswith('access-control') or 
                                 any(k in line.lower() for k in ('content-type', 'x-amzn-requestid', 'x-amzn-errortype', 'http/'))):
                print(f'  {line}')
        
        print(f'\nStatus: {status_code}')
        print(f'\nResponse Body:')
        print(body_text)
        
        # 失敗時（4xx/5xx）はファイルに保存
        if status_code >= 400:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'/tmp/get_work_report_error_{status_code}_{timestamp}.json'
            error_data = {
                'timestamp': timestamp,
                'status_code': status_code,
                'url': url,
                'response_headers': header_text,
                'response_body': body_text,
            }
            try:
                # JSON としてパース可能ならパースして保存
                parsed_body = json.loads(body_text)
                error_data['response_body_parsed'] = parsed_body
            except:
                pass
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(error_data, f, ensure_ascii=False, indent=2)
            print(f'\n❌ エラー ({status_code}) の詳細を保存しました: {filename}')
            sys.exit(1)
        elif status_code == 200:
            print(f'\n✅ 成功 (Status: {status_code})')
            # 成功時も保存
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'/tmp/get_work_report_success_{timestamp}.json'
            success_data = {
                'timestamp': timestamp,
                'status_code': status_code,
                'url': url,
                'response_body': body_text,
            }
            try:
                parsed_body = json.loads(body_text)
                success_data['response_body_parsed'] = parsed_body
            except:
                pass
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(success_data, f, ensure_ascii=False, indent=2)
            print(f'✅ レスポンスを保存しました: {filename}')
            sys.exit(0)
        else:
            print(f'\n⚠️  予期しないステータスコード: {status_code}')
            sys.exit(1)
            
    except subprocess.TimeoutExpired:
        print(f'❌ リクエストタイムアウト', file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f'❌ 予期しないエラー: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(3)

if __name__ == '__main__':
    main()
