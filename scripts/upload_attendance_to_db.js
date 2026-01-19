/**
 * 櫻田さんの出勤履歴をDBにアップロードするスクリプト
 * 
 * 使用方法:
 * 1. ブラウザのコンソールで実行
 * 2. または、Node.jsで実行（AWS SDKが必要）
 */

// 設定
const STAFF_ID = 'W999';
const STAFF_NAME = '櫻田傑';
const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

/**
 * ローカルストレージから出勤履歴を取得
 */
function getAttendanceRecordsFromLocalStorage() {
  try {
    const stored = localStorage.getItem('attendanceRecords');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  return {};
}

/**
 * Cognito IDトークンを取得
 */
async function getCognitoIdToken() {
  try {
    // CognitoAuthから取得を試みる
    if (window.CognitoAuth && window.CognitoAuth.getCurrentUser) {
      const user = window.CognitoAuth.getCurrentUser();
      if (user) {
        const session = await new Promise((resolve, reject) => {
          user.getSession((err, session) => {
            if (err) reject(err);
            else resolve(session);
          });
        });
        if (session && session.isValid()) {
          return session.getIdToken().getJwtToken();
        }
      }
    }
    
    // localStorageから直接取得を試みる
    const idToken = localStorage.getItem('cognito_id_token');
    if (idToken) {
      return idToken;
    }
    
    // その他のストレージキーを確認
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('idToken')) {
        const token = localStorage.getItem(key);
        if (token && token.startsWith('eyJ')) {
          return token;
        }
      }
    }
  } catch (error) {
    console.error('Error getting Cognito ID token:', error);
  }
  return null;
}

/**
 * 出勤記録をAPIにアップロード
 */
async function uploadAttendanceRecord(record, date) {
  const idToken = await getCognitoIdToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  
  const data = {
    staff_id: STAFF_ID,
    staff_name: STAFF_NAME,
    date: date,
    clock_in: record.clock_in || null,
    clock_out: record.clock_out || null
  };
  
  // breaksがある場合は追加
  if (record.breaks && Array.isArray(record.breaks)) {
    data.breaks = record.breaks;
  }
  
  try {
    const response = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${date}: アップロード成功`, result);
      return { success: true, date, result };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ ${date}: アップロード失敗`, response.status, errorData);
      return { success: false, date, error: errorData };
    }
  } catch (error) {
    console.error(`❌ ${date}: エラー`, error);
    return { success: false, date, error: error.message };
  }
}

/**
 * 全ての出勤履歴をアップロード
 */
async function uploadAllAttendanceRecords() {
  console.log('📤 出勤履歴のアップロードを開始します...');
  console.log(`スタッフID: ${STAFF_ID}`);
  console.log(`スタッフ名: ${STAFF_NAME}`);
  
  const attendanceRecords = getAttendanceRecordsFromLocalStorage();
  console.log('📋 ローカルストレージから取得したデータ:', attendanceRecords);
  
  // 櫻田さんの記録を抽出
  const sakuraRecords = {};
  for (const date in attendanceRecords) {
    if (attendanceRecords[date][STAFF_ID]) {
      sakuraRecords[date] = attendanceRecords[date][STAFF_ID];
    }
  }
  
  console.log(`📊 アップロード対象: ${Object.keys(sakuraRecords).length}件`);
  
  if (Object.keys(sakuraRecords).length === 0) {
    console.warn('⚠️ アップロード対象の記録が見つかりませんでした');
    return;
  }
  
  const results = [];
  const dates = Object.keys(sakuraRecords).sort();
  
  // 順次アップロード（APIの負荷を考慮）
  for (const date of dates) {
    const record = sakuraRecords[date];
    console.log(`\n📅 処理中: ${date}`);
    console.log(`   出勤: ${record.clock_in || 'なし'}`);
    console.log(`   退勤: ${record.clock_out || 'なし'}`);
    
    const result = await uploadAttendanceRecord(record, date);
    results.push(result);
    
    // 少し待機（APIの負荷を軽減）
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 結果サマリー
  console.log('\n📊 アップロード結果サマリー:');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`✅ 成功: ${successCount}件`);
  console.log(`❌ 失敗: ${failCount}件`);
  
  if (failCount > 0) {
    console.log('\n❌ 失敗した日付:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.date}: ${r.error?.error || r.error || '不明なエラー'}`);
    });
  }
  
  return results;
}

// ブラウザのコンソールで実行する場合
if (typeof window !== 'undefined') {
  window.uploadAllAttendanceRecords = uploadAllAttendanceRecords;
  console.log('💡 実行方法: uploadAllAttendanceRecords() を呼び出してください');
}

// Node.jsで実行する場合（未実装 - AWS SDKが必要）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    uploadAllAttendanceRecords,
    uploadAttendanceRecord,
    getAttendanceRecordsFromLocalStorage
  };
}






