// 出退勤データをリセットするスクリプト
// ブラウザのコンソールで実行してください

(async function() {
  const staffId = 'W999';
  const today = new Date().toISOString().split('T')[0];
  const attendanceId = `${today}_${staffId}`;
  const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  
  console.log('出退勤データをリセットします...');
  console.log(`対象: staff_id=${staffId}, date=${today}, attendance_id=${attendanceId}`);
  
  // 1. ローカルストレージから削除
  try {
    const stored = localStorage.getItem('attendanceRecords');
    if (stored) {
      const records = JSON.parse(stored);
      if (records[today] && records[today][staffId]) {
        delete records[today][staffId];
        // 日付のエントリが空になったら削除
        if (Object.keys(records[today]).length === 0) {
          delete records[today];
        }
        localStorage.setItem('attendanceRecords', JSON.stringify(records));
        console.log('✓ ローカルストレージから削除しました');
      } else {
        console.log('ローカルストレージに該当データが見つかりませんでした');
      }
    } else {
      console.log('ローカルストレージにデータがありません');
    }
  } catch (error) {
    console.error('ローカルストレージの削除に失敗:', error);
  }
  
  // 2. API経由でDynamoDBから削除
  try {
    // Cognito ID Tokenを取得
    let idToken = localStorage.getItem('cognito_id_token');
    if (!idToken && window.getCognitoIdToken) {
      idToken = await window.getCognitoIdToken();
    }
    
    const headers = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    
    const response = await fetch(`${API_BASE}/attendance/${attendanceId}`, {
      method: 'DELETE',
      headers: headers
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ DynamoDBから削除しました:', result);
    } else {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      console.warn('DynamoDBからの削除に失敗:', response.status, errorData);
      console.log('（記録が存在しない可能性があります）');
    }
  } catch (error) {
    console.error('API経由の削除に失敗:', error);
  }
  
  console.log('リセット完了。ページを再読み込みしてください。');
})();






