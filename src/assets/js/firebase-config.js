/**
 * Firebase設定
 * 
 * 注意: このファイルにはFirebase設定情報が含まれます。
 * Firebase Consoleから取得した設定情報をここに記入してください。
 * 
 * 設定方法:
 * 1. Firebase Console (https://console.firebase.google.com/) にアクセス
 * 2. プロジェクトを選択（または新規作成）
 * 3. プロジェクト設定（⚙️）→「アプリを追加」→「Web」（</>）
 * 4. 表示される設定情報をコピーして、以下のfirebaseConfigに貼り付け
 */

(function() {
  'use strict';
  
  // Firebase設定情報（Firebase Consoleから取得）
  const firebaseConfig = {
    apiKey: "AIzaSyDeFpczINqpaEAApjuWzCyveuqErCh4s4g",
    authDomain: "misesapo-system.firebaseapp.com",
    projectId: "misesapo-system",
    storageBucket: "misesapo-system.firebasestorage.app",
    messagingSenderId: "202401316449",
    appId: "1:202401316449:web:a140e6b22ac3d272057420",
    measurementId: "G-KM44PRSSE1"
  };
  
  // Firebase初期化
  if (typeof firebase !== 'undefined') {
    try {
      firebase.initializeApp(firebaseConfig);
      window.FirebaseAuth = firebase.auth();
      window.FirebaseFirestore = firebase.firestore();
      window.FirebaseStorage = firebase.storage();
      console.log('[Firebase] Initialized successfully');
    } catch (error) {
      console.error('[Firebase] Initialization error:', error);
    }
  } else {
    console.warn('[Firebase] Firebase SDK is not loaded. Make sure firebase-app-compat.js and firebase-auth-compat.js are loaded before this script.');
  }
})();

