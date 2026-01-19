# 管理者向けレポート作成UI設計

## 📋 概要

管理者がレポートを作成・編集するためのUI設計です。参考画像のレポート詳細ページを基に、作成・編集フォームを設計します。

## 🎨 ページ構成

### 1. レポート作成ページ (`/admin/reports/new.html`)

**レイアウト**:
```
[ヘッダー]
  - 戻るボタン
  - タイトル: "レポート作成"

[フォーム]
  [作業情報セクション]
    - 店舗選択（ドロップダウン）
    - 清掃日時
      - 日付選択
      - 開始時刻
      - 終了時刻
  
  [清掃項目セクション]
    - 清掃項目の追加ボタン
    - 各清掃項目カード
      - 項目名（グリストラップ、レンジフード清掃、床清掃、トイレ清掃など）
      - 詳細情報（タイプ、個数、メモなど）
      - 作業内容（テキストエリア）
      - 作業メモ（テキストエリア）
      - 写真アップロード
        - 作業前（複数枚、無制限）
        - 作業後（複数枚、無制限）
      - 削除ボタン
  
  [位置情報セクション]（オプション）
    - 現在位置を取得ボタン
  
  [送信ボタン]
    - "レポートを作成"
```

### 2. レポート編集ページ (`/admin/reports/{id}/edit.html`)

**レイアウト**: 作成ページと同様、既存データをフォームに読み込む

### 3. レポート一覧ページ (`/admin/reports.html`)

**レイアウト**:
```
[ヘッダー]
  - タイトル: "レポート一覧"
  - 新規作成ボタン

[フィルター]
  - 店舗でフィルタ
  - 日付範囲でフィルタ
  - ステータスでフィルタ

[レポート一覧]
  - カード形式で表示
    - 店舗名
    - 清掃日時
    - 清掃項目数
    - ステータス
    - 編集ボタン
    - 削除ボタン
```

### 4. レポート詳細ページ（ユーザー向け）(`/reports/{id}.html`)

**レイアウト**: 参考画像ベース
- 清掃項目のタブ表示
- 作業前・作業後の写真を2列グリッドで表示
- 満足度調査・コメント機能（将来実装）

---

## 📸 写真アップロードUI

### 要件
- **枚数制限**: なし（無制限）
- **表示**: 2列グリッド（スマホ画面で水平方向に2枚配置）
- **最適化**: クライアント側でリサイズ（最大幅800px、JPEG品質80%）

### UI設計

```
[作業前]
┌─────────┬─────────┐
│ 写真1   │ 写真2   │
│ [削除]  │ [削除]  │
├─────────┼─────────┤
│ 写真3   │ 写真4   │
│ [削除]  │ [削除]  │
├─────────┴─────────┤
│ [+ 写真を追加]    │
└───────────────────┘
```

**実装**:
- 写真は動的に追加可能
- 各写真に削除ボタン
- 最後に「写真を追加」ボタン
- ドラッグ&ドロップで順序変更（オプション）

---

## 🔧 実装詳細

### 清掃項目の動的追加

```javascript
// 清掃項目のテンプレート
const workItemTemplate = {
  item_id: 'grease-trap',
  item_name: 'グリストラップ',
  details: {
    type: '',
    count: 1,
    manifest: false,
    notes: ''
  },
  work_content: '',
  work_memo: '',
  photos: {
    before: [],
    after: []
  }
};

// 利用可能な清掃項目
const availableWorkItems = [
  { id: 'grease-trap', name: 'グリストラップ' },
  { id: 'range-hood', name: 'レンジフード清掃' },
  { id: 'floor', name: '床清掃' },
  { id: 'toilet', name: 'トイレ清掃' },
  { id: 'duct', name: 'ダクト清掃' },
  { id: 'aircon', name: 'エアコン分解洗浄' }
];
```

### 写真アップロードの実装

```javascript
// 写真の最適化とアップロード
async function uploadPhoto(file, reportId, itemId, category, index) {
  // 1. 画像を最適化
  const optimizedBlob = await optimizeImage(file, 800, 0.8);
  
  // 2. Base64に変換
  const base64 = await blobToBase64(optimizedBlob);
  
  // 3. APIに送信
  const response = await fetch('/api/staff/reports/photos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firebaseIdToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      report_id: reportId,
      item_id: itemId,
      category: category, // 'before' | 'after'
      image: base64
    })
  });
  
  return await response.json();
}
```

---

## 📋 実装チェックリスト

### 管理者向けページ
- [ ] `/admin/reports/new.html` - レポート作成ページ
- [ ] `/admin/reports/{id}/edit.html` - レポート編集ページ
- [ ] `/admin/reports.html` - レポート一覧ページ
- [ ] 清掃項目の動的追加機能
- [ ] 写真アップロード機能（無制限）
- [ ] 写真の最適化機能
- [ ] フォームバリデーション
- [ ] エラーハンドリング

### ユーザー向けページ
- [ ] `/reports/{id}.html` - レポート詳細ページ（参考画像ベース）
- [ ] `/reports.html` - レポート一覧ページ
- [ ] 清掃項目のタブ表示
- [ ] 写真の2列グリッド表示
- [ ] レスポンシブデザイン

---

## 🎨 UI/UXの考慮事項

1. **操作性**
   - 大きなボタン（最小44x44px）
   - タップしやすいUI
   - ドラッグ&ドロップで写真の順序変更（オプション）

2. **視認性**
   - 必須項目の明確な表示
   - 進捗インジケーター
   - エラーメッセージの明確な表示

3. **パフォーマンス**
   - 写真の遅延読み込み
   - 画像の最適化
   - フォームデータの自動保存（localStorage）

---

## 📚 参考

- 参考画像: レポート詳細ページのデザイン
- 既存のレポート作成ページ: `/staff/reports/new.html`


