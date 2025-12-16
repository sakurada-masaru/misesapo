/**
 * 清掃マニュアル管理 - Firebase統合
 * 
 * 注意: Firebase削除により、このファイルは無効化されました。
 * 清掃マニュアルの下書き保存機能は現在利用できません。
 */

(function() {
    'use strict';
    
    // グローバルに公開（互換性のため）
    window.CleaningManualFirebase = {
        checkAuth: async function() {
            return { authenticated: false, user: null, role: null };
        },
        loadDataFromFirestore: async function() {
            throw new Error('Firebase削除により、この機能は利用できません。');
        },
        saveDataToFirestore: async function() {
            throw new Error('Firebase削除により、この機能は利用できません。');
        },
        loadDraftFromFirestore: async function() {
            throw new Error('Firebase削除により、この機能は利用できません。');
        },
        uploadImageToStorage: async function() {
            throw new Error('Firebase削除により、この機能は利用できません。');
        },
        ALLOWED_ROLES: []
    };
})();
