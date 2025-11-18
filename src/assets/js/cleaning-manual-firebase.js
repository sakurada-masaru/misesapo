/**
 * 清掃マニュアル管理 - Firebase統合
 * FirestoreとFirebase Storageを使用
 */

(function() {
    'use strict';
    
    // Firestoreコレクション名
    const FIRESTORE_COLLECTION = 'cleaning-manual';
    const FIRESTORE_DRAFT_COLLECTION = 'cleaning-manual-drafts';
    const STORAGE_PATH = 'cleaning-manual-images';
    
    // 認証が必要なロール
    const ALLOWED_ROLES = ['admin', 'staff', 'concierge', 'developer', 'master'];
    
    /**
     * 認証チェック
     */
    async function checkAuth() {
        if (!window.FirebaseAuth) {
            console.log('[CleaningManualFirebase] FirebaseAuth not available');
            return { authenticated: false, user: null, role: null };
        }
        
        // 現在のユーザーを取得（既にログイン済みの場合）
        let user = window.FirebaseAuth.currentUser;
        
        // ユーザーが取得できない場合、onAuthStateChangedを待つ
        if (!user) {
            user = await new Promise((resolve) => {
                const unsubscribe = window.FirebaseAuth.onAuthStateChanged((authUser) => {
                    unsubscribe();
                    resolve(authUser);
                });
                
                // タイムアウト（3秒）
                setTimeout(() => {
                    unsubscribe();
                    resolve(null);
                }, 3000);
            });
        }
        
        if (!user) {
            console.log('[CleaningManualFirebase] No user authenticated');
            return { authenticated: false, user: null, role: null };
        }
        
        // ロールを取得
        let role = 'customer';
        try {
            const idTokenResult = await user.getIdTokenResult(true); // forceRefresh: true
            role = idTokenResult.claims.role || 'customer';
            console.log('[CleaningManualFirebase] Role from Custom Claims:', role);
        } catch (error) {
            console.warn('[CleaningManualFirebase] Could not get custom claims:', error);
        }
        
        // Custom Claimsにロールがない場合、または'customer'の場合、users.jsからロールを取得
        if (role === 'customer' && window.Users && window.Users.findUserByEmail) {
            const userFromUsersJs = window.Users.findUserByEmail(user.email);
            if (userFromUsersJs && userFromUsersJs.role) {
                role = userFromUsersJs.role;
                console.log('[CleaningManualFirebase] Role from users.js:', role, 'for email:', user.email);
            }
        }
        
        const isAuthenticated = ALLOWED_ROLES.includes(role);
        console.log('[CleaningManualFirebase] Auth check result:', {
            email: user.email,
            role: role,
            authenticated: isAuthenticated,
            allowedRoles: ALLOWED_ROLES
        });
        
        return {
            authenticated: isAuthenticated,
            user: user,
            role: role
        };
    }
    
    /**
     * Firestoreからデータを読み込む
     */
    async function loadDataFromFirestore() {
        if (!window.FirebaseFirestore) {
            throw new Error('Firestore is not initialized');
        }
        
        const db = window.FirebaseFirestore;
        const docRef = db.collection(FIRESTORE_COLLECTION).doc('data');
        const doc = await docRef.get();
        
        if (doc.exists) {
            return doc.data();
        } else {
            // 初期データを返す
            return {
                kitchen: [],
                aircon: [],
                floor: [],
                other: []
            };
        }
    }
    
    /**
     * Firestoreにデータを保存（確定版）
     */
    async function saveDataToFirestore(data, isDraft = false) {
        if (!window.FirebaseFirestore) {
            throw new Error('Firestore is not initialized');
        }
        
        // FieldValueを取得（Firebase compat版ではfirebase.firestore.FieldValueから直接取得）
        let FieldValue;
        if (window.FirebaseFieldValue) {
            FieldValue = window.FirebaseFieldValue;
        } else if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
            FieldValue = firebase.firestore.FieldValue;
        } else {
            // フォールバック: 現在の日時を使用
            console.warn('[CleaningManualFirebase] FieldValue not available, using Date.now()');
            FieldValue = {
                serverTimestamp: () => new Date()
            };
        }
        
        const db = window.FirebaseFirestore;
        const collection = isDraft ? FIRESTORE_DRAFT_COLLECTION : FIRESTORE_COLLECTION;
        const docRef = db.collection(collection).doc('data');
        
        const saveData = {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: window.FirebaseAuth.currentUser?.email || 'unknown'
        };
        
        await docRef.set(saveData, { merge: true });
        return true;
    }
    
    /**
     * 下書きデータを取得
     */
    async function loadDraftFromFirestore() {
        if (!window.FirebaseFirestore) {
            return null;
        }
        
        const db = window.FirebaseFirestore;
        const docRef = db.collection(FIRESTORE_DRAFT_COLLECTION).doc('data');
        const doc = await docRef.get();
        
        if (doc.exists) {
            return doc.data();
        }
        return null;
    }
    
    /**
     * Firebase Storageに画像をアップロード
     */
    async function uploadImageToStorage(file, fieldName) {
        if (!window.FirebaseStorage) {
            throw new Error('Firebase Storage is not initialized');
        }
        
        // 認証チェック
        if (!window.FirebaseAuth || !window.FirebaseAuth.currentUser) {
            throw new Error('認証が必要です。ログインしてください。');
        }
        
        // 認証トークンを取得（リフレッシュ）
        const user = window.FirebaseAuth.currentUser;
        let authToken = null;
        try {
            authToken = await user.getIdToken(true); // 強制的にトークンをリフレッシュ
            console.log('[CleaningManualFirebase] Auth token refreshed');
        } catch (error) {
            console.error('[CleaningManualFirebase] Token refresh failed:', error);
            throw new Error('認証トークンの取得に失敗しました。再度ログインしてください。');
        }
        
        const storage = window.FirebaseStorage;
        const storageRef = storage.ref();
        
        // ファイル名を生成（タイムスタンプ + 元のファイル名）
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${timestamp}_${fieldName}_${safeFileName}`;
        const imageRef = storageRef.child(`${STORAGE_PATH}/${fileName}`);
        
        // メタデータを設定（contentTypeを明示的に指定）
        const metadata = {
            contentType: file.type || 'image/png',
            customMetadata: {
                uploadedBy: user.email || 'unknown',
                fieldName: fieldName
            }
        };
        
        // アップロード（メタデータ付き）
        try {
            console.log('[CleaningManualFirebase] Starting upload:', fileName);
            const snapshot = await imageRef.put(file, metadata);
            console.log('[CleaningManualFirebase] Upload successful:', snapshot);
            const downloadURL = await snapshot.ref.getDownloadURL();
            console.log('[CleaningManualFirebase] Download URL:', downloadURL);
            
            return {
                url: downloadURL,
                path: downloadURL // Firebase StorageのURLを返す
            };
        } catch (error) {
            console.error('[CleaningManualFirebase] Upload error:', error);
            
            // CORSエラーの場合の詳細なメッセージ
            if (error.code === 'storage/unauthorized' || error.message.includes('CORS') || error.message.includes('cors')) {
                throw new Error('CORSエラー: Firebase StorageのCORS設定が必要です。管理者に連絡してください。\n詳細: ' + error.message);
            } else if (error.code === 'storage/quota-exceeded') {
                throw new Error('ストレージの容量が不足しています。');
            } else if (error.code === 'storage/unauthenticated') {
                throw new Error('認証が必要です。再度ログインしてください。');
            } else {
                throw new Error('画像のアップロードに失敗しました: ' + (error.message || error.code || error.toString()));
            }
        }
    }
    
    // グローバルに公開
    window.CleaningManualFirebase = {
        checkAuth,
        loadDataFromFirestore,
        saveDataToFirestore,
        loadDraftFromFirestore,
        uploadImageToStorage,
        ALLOWED_ROLES
    };
})();

