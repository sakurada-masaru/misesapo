#!/usr/bin/env python3
"""
ファイル変更を監視して自動的にビルドを実行するスクリプト
src/ ディレクトリ内のファイルが変更されたら自動的にビルドを実行します
"""

import subprocess
import sys
import time
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"
BUILD_SCRIPT = ROOT / "scripts" / "build.py"

# 監視対象のファイル拡張子
WATCH_EXTENSIONS = {'.html', '.css', '.js', '.json'}


def get_file_mtimes(directory):
    """ディレクトリ内の全ファイルの更新時刻を取得"""
    mtimes = {}
    for path in directory.rglob('*'):
        if path.is_file() and path.suffix in WATCH_EXTENSIONS:
            try:
                mtimes[str(path)] = path.stat().st_mtime
            except (OSError, FileNotFoundError):
                pass
    return mtimes


def run_build():
    """ビルドを実行"""
    print(f"\n[watch] ファイル変更を検知しました。ビルドを実行します...")
    try:
        result = subprocess.run(
            [sys.executable, str(BUILD_SCRIPT)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("[watch] ✅ ビルドが完了しました")
        else:
            print(f"[watch] ❌ ビルドエラー:\n{result.stderr}", file=sys.stderr)
    except subprocess.TimeoutExpired:
        print("[watch] ❌ ビルドがタイムアウトしました", file=sys.stderr)
    except Exception as e:
        print(f"[watch] ❌ ビルド例外: {e}", file=sys.stderr)


def main():
    """メイン関数: ファイル監視を開始"""
    if not SRC.exists():
        print(f"エラー: {SRC} ディレクトリが見つかりません")
        sys.exit(1)
    
    if not BUILD_SCRIPT.exists():
        print(f"エラー: {BUILD_SCRIPT} が見つかりません")
        sys.exit(1)
    
    # 初回ビルドを実行
    print("[watch] 初回ビルドを実行します...")
    try:
        result = subprocess.run(
            [sys.executable, str(BUILD_SCRIPT)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("[watch] ✅ 初回ビルドが完了しました")
        else:
            print(f"[watch] ⚠️  初回ビルドでエラーが発生しました:\n{result.stderr}", file=sys.stderr)
    except Exception as e:
        print(f"[watch] ⚠️  初回ビルドで例外が発生しました: {e}", file=sys.stderr)
    
    # ファイル監視を開始（ポーリング方式）
    print(f"[watch] 📁 {SRC} を監視中...")
    print("[watch] ファイルを変更すると自動的にビルドが実行されます")
    print("[watch] 停止するには Ctrl+C を押してください\n")
    
    last_mtimes = get_file_mtimes(SRC)
    last_build_time = 0
    debounce_seconds = 2  # 2秒以内の連続変更は無視
    
    try:
        while True:
            time.sleep(1)  # 1秒ごとにチェック
            
            current_mtimes = get_file_mtimes(SRC)
            
            # 変更を検知
            changed = False
            for file_path, mtime in current_mtimes.items():
                if file_path not in last_mtimes or last_mtimes[file_path] != mtime:
                    changed = True
                    break
            
            # ファイルが削除された場合も検知
            if not changed:
                for file_path in last_mtimes:
                    if file_path not in current_mtimes:
                        changed = True
                        break
            
            if changed:
                # デバウンス処理
                current_time = time.time()
                if current_time - last_build_time >= debounce_seconds:
                    last_build_time = current_time
                    run_build()
                    # ビルド後に更新時刻を再取得
                    last_mtimes = get_file_mtimes(SRC)
                else:
                    # デバウンス中は更新時刻のみ更新
                    last_mtimes = current_mtimes
            else:
                last_mtimes = current_mtimes
                
    except KeyboardInterrupt:
        print("\n[watch] 監視を停止しました")


if __name__ == "__main__":
    main()

