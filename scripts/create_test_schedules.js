/**
 * テストスケジュール作成スクリプト
 * ブラウザのコンソールで実行してください
 */

(function () {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const testSchedules = [
        {
            id: 'SCH-TEST-001',
            store_id: 'store-001',
            store_name: '新宿店',
            brand_name: 'セブンイレブン',
            company_name: '株式会社セブン&アイ',
            time_slot: '10:00 - 12:00',
            date: today,
            status: 'pending',
            source: 'sales_request',
            created_at: new Date().toISOString()
        },
        {
            id: 'SCH-TEST-002',
            store_id: 'store-002',
            store_name: '渋谷道玄坂店',
            brand_name: 'ドトールコーヒー',
            company_name: '株式会社ドトールコーヒー',
            time_slot: '14:00 - 15:30',
            date: today,
            status: 'pending',
            source: 'sales_request',
            created_at: new Date().toISOString()
        },
        {
            id: 'SCH-TEST-003',
            store_id: 'store-003',
            store_name: '池袋東口店',
            brand_name: 'ローソン',
            company_name: '株式会社ローソン',
            time_slot: '17:00 - 18:30',
            date: today,
            status: 'pending',
            source: 'manual',
            created_at: new Date().toISOString()
        },
        {
            id: 'SCH-TEST-004',
            store_id: 'store-004',
            store_name: '品川港南口店',
            brand_name: 'スターバックス',
            company_name: 'スターバックスコーヒージャパン',
            time_slot: '09:00 - 10:30',
            date: tomorrow,
            status: 'pending',
            source: 'sales_request',
            created_at: new Date().toISOString()
        },
        {
            id: 'SCH-TEST-005',
            store_id: 'store-005',
            store_name: '銀座中央通り店',
            brand_name: 'マクドナルド',
            company_name: '日本マクドナルド株式会社',
            time_slot: '11:00 - 13:00',
            date: tomorrow,
            status: 'pending',
            source: 'manual',
            created_at: new Date().toISOString()
        }
    ];

    // 既存データとマージ
    const existing = JSON.parse(localStorage.getItem('sales_created_schedules') || '[]');
    const merged = [...existing.filter(e => !e.id.startsWith('SCH-TEST-')), ...testSchedules];
    localStorage.setItem('sales_created_schedules', JSON.stringify(merged));

    console.log('✅ テストスケジュールを作成しました:');
    console.log(`   今日 (${today}): 3件`);
    console.log(`   明日 (${tomorrow}): 2件`);
    console.log('');
    console.log('📋 詳細:');
    testSchedules.forEach(s => {
        console.log(`   ${s.date} ${s.time_slot} - ${s.brand_name} ${s.store_name}`);
    });

    // バッジ更新（関数が存在する場合）
    if (typeof updateScheduleFabBadge === 'function') {
        updateScheduleFabBadge();
        console.log('');
        console.log('🔔 FABバッジを更新しました');
    }

    return '✅ 完了！ページをリロードしてスケジュールを確認してください。';
})();
