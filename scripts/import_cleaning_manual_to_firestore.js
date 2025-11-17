#!/usr/bin/env node
/**
 * 清掃マニュアルデータをFirestoreに投入するスクリプト
 * 
 * 使用方法:
 * node scripts/import_cleaning_manual_to_firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Admin SDKの初期化
const serviceAccount = require('../scripts/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importData() {
  try {
    // JSONファイルを読み込む
    const jsonPath = path.join(__dirname, '../src/data/cleaning-manual.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    console.log('データを読み込みました:', {
      kitchen: jsonData.kitchen?.length || 0,
      aircon: jsonData.aircon?.length || 0,
      floor: jsonData.floor?.length || 0,
      other: jsonData.other?.length || 0
    });
    
    // Firestoreに保存
    const docRef = db.collection('cleaning-manual').doc('data');
    await docRef.set({
      ...jsonData,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      importedBy: 'script'
    });
    
    console.log('✅ Firestoreにデータを投入しました！');
    console.log('コレクション: cleaning-manual/data');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

importData();

