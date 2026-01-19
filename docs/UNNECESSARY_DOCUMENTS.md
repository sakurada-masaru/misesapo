# 不要なドキュメント一覧

**作成日**: 2025年1月  
**目的**: 現在のシステムの状況で不要になったドキュメントを洗い出し

---

## 🔴 WordPress関連（完全に不要）

現在のシステムはWordPressを使用していないため、以下のドキュメントは削除対象です：

1. **`WORDPRESS_COMPLETE_SETUP_GUIDE.md`** - WordPress完全セットアップガイド
2. **`WORDPRESS_ELEMENTOR_EXAMPLES.php`** - WordPress Elementorの例
3. **`WORDPRESS_ELEMENTOR_MIGRATION.md`** - WordPress Elementor移行ガイド
4. **`WORDPRESS_ELEMENTOR_TEMPLATE_EXAMPLE.php`** - WordPress Elementorテンプレート例
5. **`WORDPRESS_FUNCTIONS_PHP_SETUP.md`** - WordPress functions.phpセットアップ
6. **`WORDPRESS_JS_CLEANUP.md`** - WordPress JSクリーンアップ
7. **`WORDPRESS_JS_FILES_CHECKLIST.md`** - WordPress JSファイルチェックリスト
8. **`WORDPRESS_PAGE_CHECK.md`** - WordPressページチェック
9. **`WORDPRESS_PATH_SETUP.md`** - WordPressパスセットアップ
10. **`WORDPRESS_SETUP_CHECKLIST.md`** - WordPressセットアップチェックリスト
11. **`COCOON_CHILD_THEME_SETUP.md`** - Cocoon子テーマセットアップ（WordPressテーマ）
12. **`COCOON_FUNCTIONS_PHP_ADD_CODE.md`** - Cocoon functions.php追加コード
13. **`LIGHTNING_CHILD_FOLDER_STRUCTURE.md`** - Lightning子テーマフォルダ構造（WordPressテーマ）
14. **`LIGHTNING_CHILD_FUNCTIONS_PHP.md`** - Lightning子テーマfunctions.php
15. **`LIGHTNING_CHILD_SETUP_GUIDE.md`** - Lightning子テーマセットアップガイド
16. **`FUNCTIONS_PHP_FIX.md`** - functions.php修正
17. **`FUNCTIONS_PHP_QUICK_START.md`** - functions.phpクイックスタート
18. **`NEXT_STEPS_AFTER_FUNCTIONS_PHP.md`** - functions.php後の次のステップ
19. **`CONTACT_BOX_SHORTCODE.md`** - コンタクトボックスショートコード（WordPress）
20. **`SCROLL_HINT_SHORTCODE.md`** - スクロールヒントショートコード（WordPress）
21. **`HEADER_MEGA_MENU_SWITCH_HTML.md`** - ヘッダーメガメニュースイッチHTML（WordPress関連の可能性）
22. **`HEADER_SWITCH_HTML.md`** - ヘッダースイッチHTML（WordPress関連の可能性）

**合計**: 22ファイル

---

## 🟡 EmailJS関連（実装されていない）

現在のシステムではEmailJSは使用されていないため、以下のドキュメントは削除対象です：

1. **`EMAILJS_SETUP.md`** - EmailJSセットアップガイド
2. **`EMAILJS_TEMPLATE_SETUP.md`** - EmailJSテンプレート設定ガイド

**合計**: 2ファイル

---

## 🟠 Firebase関連（一部不要）

現在のシステムではFirebase Authenticationのみを使用しています。以下のドキュメントは削除対象です：

### Firebase Hosting関連（使用していない）
1. **`FIREBASE_DEPLOYMENT_EXPLANATION.md`** - Firebaseデプロイメント説明
2. **`FIREBASE_SETUP_GUIDE.md`** - Firebaseセットアップガイド（Hosting関連の可能性）

### Firebase Storage関連（使用していない）
3. **`FIREBASE_STORAGE_CORS_FIX.md`** - Firebase Storage CORS修正
4. **`FIREBASE_STORAGE_CORS_SETUP.md`** - Firebase Storage CORSセットアップ
5. **`FIREBASE_CLEANING_MANUAL_SETUP.md`** - Firebase清掃マニュアルセットアップ（Storage使用）

### Firebase Admin SDK関連（未実装）
6. **`FIREBASE_ADMIN_SDK_SETUP.md`** - Firebase Admin SDKセットアップ（未実装）
7. **`FIREBASE_AUTH_IMPLEMENTATION_REPORTS.md`** - Firebase認証統合レポート（Admin SDK関連）

### Firebase Console設定関連（既に設定済み）
8. **`FIREBASE_CONSOLE_SETUP_DETAILED.md`** - Firebase Console詳細セットアップ（既に設定済み）
9. **`FIREBASE_SETUP_QUICK_START.md`** - Firebaseセットアップクイックスタート（既に設定済み）

### Firebase Custom Claims関連（未実装）
10. **`FIREBASE_CUSTOM_CLAIMS_SETUP.md`** - Firebase Custom Claimsセットアップ（未実装）

### Firebase Email Verification関連（未実装）
11. **`FIREBASE_EMAIL_VERIFICATION.md`** - Firebaseメール確認機能（未実装）

### Firebase Next Steps関連（古い情報）
12. **`FIREBASE_NEXT_STEPS.md`** - Firebase次のステップ（古い情報）

**合計**: 12ファイル

**注意**: 以下のFirebase関連ドキュメントは**保持**してください（認証に使用中）：
- `FIREBASE_AUTH_IMPLEMENTATION.md` - Firebase認証実装ガイド（参考として有用）
- `FIREBASE_AUTH_CHECKLIST.md` - Firebase認証チェックリスト（参考として有用）
- `FIREBASE_AUTH_TROUBLESHOOTING.md` - Firebase認証トラブルシューティング（参考として有用）

---

## 🔵 その他の不要なドキュメント

### 古い実装計画・提案（既に実装済みまたは不要）
1. **`IMPLEMENTATION_PROPOSALS.md`** - 実装提案（古い情報）
2. **`IMPLEMENTATION_STATUS.md`** - 実装状況（古い情報、`CURRENT_STATUS.md`で代替可能）
3. **`NEXT_STEPS.md`** - 次のステップ（古い情報）
4. **`NEXT_STEPS_AFTER_HERO.md`** - ヒーロー後の次のステップ（古い情報）
5. **`NEXT_STEP_IMAGES_UPLOAD.md`** - 次のステップ画像アップロード（古い情報）

### 古いエラー修正（既に修正済み）
6. **`BROKEN_LAYOUT_FIX.md`** - 壊れたレイアウト修正（既に修正済み）
7. **`HERO_CSS_FIX.md`** - ヒーローCSS修正（既に修正済み）
8. **`HERO_NO_ANIMATION_SETUP.md`** - ヒーローアニメーションなしセットアップ（既に修正済み）
9. **`SCROLL_HINT_FIX.md`** - スクロールヒント修正（既に修正済み）
10. **`SCROLL_HINT_LAYOUT_FIX.md`** - スクロールヒントレイアウト修正（既に修正済み）
11. **`FIXED_ORDER_BUTTON_HTML.md`** - 固定注文ボタンHTML（既に修正済み）
12. **`FIXED_ORDER_BUTTON_SETUP.md`** - 固定注文ボタンセットアップ（既に修正済み）
13. **`FIXED_PAGE_SETUP.md`** - 固定ページセットアップ（既に修正済み）
14. **`REMAINING_ERRORS.md`** - 残りのエラー（既に修正済み）

### 古いデバッグ・トラブルシューティング（既に解決済み）
15. **`GITHUB_PAGES_DEBUG.md`** - GitHub Pagesデバッグ（既に解決済み）
16. **`GITHUB_PAGES_FIX.md`** - GitHub Pages修正（既に解決済み）
17. **`GITHUB_PAGES_SETTINGS_FIX.md`** - GitHub Pages設定修正（既に解決済み）
18. **`GITHUB_PAGES_VERIFICATION.md`** - GitHub Pages検証（既に解決済み）
19. **`TROUBLESHOOTING_404.md`** - 404トラブルシューティング（既に解決済み）
20. **`DEBUG_SCAN_ISSUE.md`** - デバッグスキャン問題（既に解決済み）

### 古いAWS設定（既に設定済み）
21. **`AWS_S3_SETUP.md`** - AWS S3セットアップ（既に設定済み、`AWS_S3_SETUP_STEP_BY_STEP.md`で代替可能）
22. **`AWS_S3_ONLY_SETUP.md`** - AWS S3のみセットアップ（既に設定済み）
23. **`AWS_S3_PUBLIC_ACCESS_SETUP.md`** - AWS S3パブリックアクセスセットアップ（既に設定済み）
24. **`AWS_S3_ACL_ERROR_FIX.md`** - AWS S3 ACLエラー修正（既に修正済み）
25. **`AWS_S3_BUCKET_CHECK.md`** - AWS S3バケットチェック（既に確認済み）
26. **`AWS_LAMBDA_DEPLOY_CHECK.md`** - AWS Lambdaデプロイチェック（既に確認済み）
27. **`AWS_LAMBDA_FUNCTION_ERROR_FIX.md`** - AWS Lambda関数エラー修正（既に修正済み）
28. **`AWS_MOCK_INTEGRATION_500_ERROR_FIX.md`** - AWSモック統合500エラー修正（既に修正済み）
29. **`AWS_DRAFT_OPTIONS_FIX.md`** - AWS下書きオプション修正（既に修正済み）
30. **`AWS_IMAGE_NOT_DISPLAYING_TROUBLESHOOTING.md`** - AWS画像表示トラブルシューティング（既に解決済み）
31. **`AWS_UPLOAD_ENDPOINT_CHECK.md`** - AWSアップロードエンドポイントチェック（既に確認済み）
32. **`AWS_API_GATEWAY_PATH_DEBUG.md`** - AWS API Gatewayパスデバッグ（既に解決済み）
33. **`AWS_CORS_TROUBLESHOOTING.md`** - AWS CORSトラブルシューティング（既に解決済み）
34. **`AWS_CLOUDWATCH_LOGS_CHECK.md`** - AWS CloudWatch Logsチェック（既に確認済み）

### 古いGitHub設定（既に設定済み）
35. **`GITHUB_PAGES_SETUP.md`** - GitHub Pagesセットアップ（既に設定済み）
36. **`GITHUB_CLI_SETUP.md`** - GitHub CLIセットアップ（既に設定済み）
37. **`GITHUB_PAT_SETUP.md`** - GitHub PATセットアップ（既に設定済み）
38. **`GITHUB_SETTINGS_CHECKLIST.md`** - GitHub設定チェックリスト（既に設定済み）
39. **`GITHUB_UPLOAD_CHECKLIST.md`** - GitHubアップロードチェックリスト（既に設定済み）
40. **`GITHUB_UPLOAD_GUIDE.md`** - GitHubアップロードガイド（既に設定済み）
41. **`GITHUB_ACTIONS_TROUBLESHOOTING.md`** - GitHub Actionsトラブルシューティング（既に解決済み）

### 古いxServer設定（使用していない）
42. **`XSERVER_FILE_MANAGER_GUIDE.md`** - xServerファイルマネージャーガイド（使用していない）
43. **`XSERVER_UPLOAD_CHECKLIST.md`** - xServerアップロードチェックリスト（使用していない）

### 古いCloud Run設定（使用していない）
44. **`CLOUD_RUN_DEPLOY_TROUBLESHOOTING.md`** - Cloud Runデプロイトラブルシューティング（使用していない）

### 古いテスト・デバッグ（既に完了）
45. **`TEST_SUCCESS_SUMMARY.md`** - テスト成功サマリー（古い情報）
46. **`ERROR_FIX_CHECKLIST.md`** - エラー修正チェックリスト（既に修正済み）

**合計**: 46ファイル

---

## 📊 削除対象ドキュメントの合計

| カテゴリ | ファイル数 |
|---------|-----------|
| WordPress関連 | 22 |
| EmailJS関連 | 2 |
| Firebase関連（一部不要） | 12 |
| その他（古い実装計画・エラー修正など） | 46 |
| **合計** | **82ファイル** |

---

## ✅ 保持すべきドキュメント

以下のドキュメントは**保持**してください：

### Firebase認証関連（使用中）
- `FIREBASE_AUTH_IMPLEMENTATION.md` - Firebase認証実装ガイド
- `FIREBASE_AUTH_CHECKLIST.md` - Firebase認証チェックリスト
- `FIREBASE_AUTH_TROUBLESHOOTING.md` - Firebase認証トラブルシューティング

### AWS関連（使用中）
- `AWS_LAMBDA_API_GATEWAY_SETUP.md` - AWS Lambda API Gatewayセットアップ
- `AWS_LAMBDA_QUICK_START.md` - AWS Lambdaクイックスタート
- `AWS_SETUP_STEP_BY_STEP.md` - AWSセットアップステップバイステップ
- `AWS_SETUP_QUICK_START.md` - AWSセットアップクイックスタート
- `AWS_S3_SETUP_STEP_BY_STEP.md` - AWS S3セットアップステップバイステップ
- `AWS_API_GATEWAY_SETUP_CHECK.md` - AWS API Gatewayセットアップチェック
- `AWS_API_GATEWAY_METHODS_SETUP.md` - AWS API Gatewayメソッドセットアップ
- `AWS_API_GATEWAY_INTEGRATION_CHECK.md` - AWS API Gateway統合チェック
- `AWS_API_GATEWAY_CORS_UPDATE.md` - AWS API Gateway CORS更新
- `AWS_API_GATEWAY_CORS_CLEANING_MANUAL.md` - AWS API Gateway CORS清掃マニュアル
- `AWS_API_GATEWAY_CORS_TRAINING_VIDEOS.md` - AWS API Gateway CORS研修動画
- `SERVICES_AWS_SETUP_GUIDE.md` - サービスAWSセットアップガイド

### 現在の状況・仕様
- `CURRENT_STATUS.md` - 現在の状況
- `PAGE_SPECIFICATIONS.md` - ページ仕様
- `PROJECT_OVERVIEW.md` - プロジェクト概要
- `DATA_ARCHITECTURE.md` - データアーキテクチャ
- `ER_DIAGRAM.md` - ER図

### テスト・チェックリスト
- `FIRST_TEST_PHASE_CHECKLIST.md` - 第一テスト段階チェックリスト
- `API_CHECK_RESULT.md` - API動作確認結果
- `RELEASE_CHECK_REMOVAL_RESULT.md` - リリース前チェック削除結果
- `BUSINESS_FLOW_TEST.md` - 業務フローテスト
- `BUSINESS_FLOW_REVIEW.md` - 業務フロー再確認
- `BUSINESS_FLOW_BUGS.md` - 業務フローバグ
- `TESTING_GUIDE.md` - テストガイド
- `TESTING_CHECKLIST.md` - テストチェックリスト
- `FRONTEND_TEST_CHECKLIST.md` - フロントエンドテストチェックリスト

### その他（有用なドキュメント）
- `グローバル設定ファイル一覧.md` - グローバル設定ファイル一覧
- `DOCUMENTATION_INDEX.md` - ドキュメントインデックス
- `ROUTES.md` - ルート
- `SERVICE_LIST.md` - サービス一覧

---

## 🎯 推奨アクション

1. **WordPress関連ドキュメント（22ファイル）を削除**
2. **EmailJS関連ドキュメント（2ファイル）を削除**
3. **Firebase関連の不要なドキュメント（12ファイル）を削除**
4. **古い実装計画・エラー修正ドキュメント（46ファイル）を削除**

合計82ファイルを削除することで、ドキュメントを整理し、必要な情報にアクセスしやすくなります。

