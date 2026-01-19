# ログイン後リダイレクト戦略の提案

## 📋 問題提起

ログイン後のリダイレクト先について、以下の2つの選択肢があります：

1. **マイページにリダイレクト** → 出退勤チェック → 作業開始ボタン → 該当ページ
2. **直接該当ページにリダイレクト** → 必要に応じてマイページにアクセス

### 懸念点
- 作業中にログアウトした場合、再ログイン時にどうするか？
- 毎回マイページを経由するのは煩わしいか？
- 出退勤チェックのタイミングはどうするか？

---

## 💡 提案：ハイブリッドアプローチ

### 基本方針

**「出退勤状態に応じて、リダイレクト先を動的に決定する」**

### 実装戦略

#### 1. 初回ログイン時（出退勤未記録）

```
ログイン
  ↓
マイページにリダイレクト
  ↓
出退勤チェック（出勤ボタン表示）
  ↓
「作業開始」ボタンをクリック
  ↓
出退勤記録 + 該当ページにリダイレクト
```

**メリット：**
- 出退勤を確実に記録できる
- 作業開始の意識付けができる
- 毎日のルーティンとして定着しやすい

#### 2. 再ログイン時（既に出退勤済み）

```
ログイン
  ↓
出退勤状態をチェック（API呼び出し）
  ↓
既に出退勤済み → 直接該当ページにリダイレクト
未出退勤 → マイページにリダイレクト
```

**メリット：**
- 既に出退勤済みの場合は、すぐに作業を再開できる
- ユーザーの利便性が向上
- 不要なステップを省略できる

#### 3. 作業中にログアウトした場合

```
作業中にログアウト
  ↓
再ログイン
  ↓
出退勤状態をチェック
  ↓
既に出退勤済み → 直接該当ページにリダイレクト
  （作業を継続できる）
```

**メリット：**
- 作業の中断・再開がスムーズ
- ユーザーのストレスが軽減

---

## 🎯 推奨実装

### フローチャート

```
ログイン成功
  ↓
従業員IDを取得
  ↓
今日の出退勤記録を取得（API: GET /attendance?staff_id={id}&date={today}）
  ↓
┌─────────────────────────────────┐
│ 出退勤記録の状態を判定          │
└─────────────────────────────────┘
  ↓
  ├─ 未出退勤
  │   ↓
  │   マイページにリダイレクト
  │   （出退勤ボタン表示）
  │
  └─ 既に出退勤済み
      ↓
      該当ページにリダイレクト
      （role_config.jsのdefaultPagesを使用）
```

### 実装コード例

```javascript
// signin.html のログイン成功後の処理

async function handleLoginSuccess(result) {
  const role = result.user.role || 'staff';
  const userId = result.user.id || result.user.user_id;
  
  // 今日の出退勤記録を取得
  const today = new Date().toISOString().split('T')[0];
  let hasAttendance = false;
  
  try {
    const attendanceResponse = await fetch(
      `${API_BASE}/attendance?staff_id=${userId}&date=${today}`
    );
    
    if (attendanceResponse.ok) {
      const attendanceData = await attendanceResponse.json();
      // 出退勤記録があるかチェック
      if (attendanceData.clock_in) {
        hasAttendance = true;
      }
    }
  } catch (error) {
    console.warn('出退勤記録の取得に失敗:', error);
    // エラー時は安全のためマイページにリダイレクト
  }
  
  let redirectPath;
  
  if (!hasAttendance) {
    // 未出退勤 → マイページにリダイレクト
    redirectPath = `/staff/mypage.html?id=${userId}`;
  } else {
    // 既に出退勤済み → 該当ページにリダイレクト
    if (window.RoleConfig && window.RoleConfig.getDefaultPageForRole) {
      redirectPath = window.RoleConfig.getDefaultPageForRole(role);
    } else {
      redirectPath = '/staff/mypage.html';
    }
  }
  
  // リダイレクト
  const basePath = document.querySelector('base')?.getAttribute('href') || '/';
  const redirectUrl = basePath === '/' 
    ? redirectPath 
    : basePath.replace(/\/$/, '') + redirectPath;
  
  window.location.href = redirectUrl;
}
```

---

## 🔄 マイページの「作業開始」ボタン

### 機能

1. **出退勤記録**
   - 出勤ボタンをクリック → 出退勤記録をAPIに保存

2. **該当ページへのリダイレクト**
   - 出退勤記録後、自動的に該当ページにリダイレクト
   - `role_config.js`の`defaultPages`を使用

### 実装例

```javascript
// mypage.html の出退勤ボタンクリック時

async function handleAttendanceClick() {
  // 出退勤記録
  await recordAttendance();
  
  // 該当ページにリダイレクト
  const role = currentUser.role || 'staff';
  let redirectPath = '/staff/mypage.html';
  
  if (window.RoleConfig && window.RoleConfig.getDefaultPageForRole) {
    redirectPath = window.RoleConfig.getDefaultPageForRole(role);
  }
  
  // リダイレクト
  window.location.href = redirectPath;
}
```

---

## 📊 比較表

| 項目 | 常にマイページ | 常に該当ページ | **ハイブリッド（推奨）** |
|------|---------------|---------------|----------------------|
| **初回ログイン時** | ✅ 出退勤記録できる | ❌ 出退勤を忘れる可能性 | ✅ 出退勤記録できる |
| **再ログイン時** | ❌ 毎回マイページ経由 | ✅ すぐ作業開始 | ✅ すぐ作業開始 |
| **作業中断時** | ❌ 毎回マイページ経由 | ✅ すぐ作業再開 | ✅ すぐ作業再開 |
| **ユーザビリティ** | ⚠️ やや煩わしい | ✅ スムーズ | ✅ 最適 |
| **出退勤記録率** | ✅ 高い | ❌ 低い可能性 | ✅ 高い |

---

## 🎨 UX改善案

### 1. マイページに「作業開始」ボタンを追加

```html
<!-- mypage.html -->
<div class="attendance-card">
  <!-- 出退勤ステータス表示 -->
  <div class="attendance-status">...</div>
  
  <!-- 出退勤ボタン -->
  <button id="attendance-toggle-btn">出勤する</button>
  
  <!-- 作業開始ボタン（出退勤済みの場合のみ表示） -->
  <button id="work-start-btn" style="display: none;">
    <i class="fas fa-play"></i>
    作業開始
  </button>
</div>
```

### 2. 該当ページに「出退勤状況」バッジを表示

```html
<!-- dashboard.html など -->
<div class="attendance-badge">
  <i class="fas fa-clock"></i>
  <span>出勤中</span>
  <a href="/staff/mypage.html?id={userId}">詳細</a>
</div>
```

### 3. 通知機能（オプション）

- 出退勤未記録の場合、該当ページに警告バナーを表示
- 「出退勤を記録する」リンクを表示

---

## ✅ 推奨事項

### 即座に実装すべき機能

1. **ログイン時の出退勤状態チェック**
   - APIから今日の出退勤記録を取得
   - 状態に応じてリダイレクト先を決定

2. **マイページの「作業開始」ボタン**
   - 出退勤記録後、該当ページにリダイレクト

3. **該当ページへの直接リダイレクト**
   - 既に出退勤済みの場合、該当ページに直接リダイレクト

### 将来的に検討すべき機能

1. **作業中断・再開の状態管理**
   - 作業中の状態を保存
   - 再ログイン時に作業を継続できるようにする

2. **出退勤リマインダー**
   - 出退勤未記録の場合、通知を表示

3. **ダッシュボードへの出退勤状況表示**
   - 各ダッシュボードに出退勤状況を表示
   - マイページへのリンクを提供

---

## 🚀 実装優先度

### Phase 1: 基本機能（最優先）
- [x] ロールごとのリダイレクト先設定
- [ ] ログイン時の出退勤状態チェック
- [ ] マイページの「作業開始」ボタン

### Phase 2: UX改善
- [ ] 該当ページへの出退勤状況表示
- [ ] 出退勤リマインダー

### Phase 3: 高度な機能
- [ ] 作業中断・再開の状態管理
- [ ] 通知機能

---

## 💭 結論

**ハイブリッドアプローチを推奨します。**

理由：
1. **出退勤記録率を維持**しながら、**ユーザビリティを向上**できる
2. **初回ログイン時**は出退勤を確実に記録
3. **再ログイン時**はすぐに作業を再開できる
4. **作業中断時**もスムーズに作業を継続できる

このアプローチにより、**出退勤記録の徹底**と**作業効率の向上**の両立が可能になります。

