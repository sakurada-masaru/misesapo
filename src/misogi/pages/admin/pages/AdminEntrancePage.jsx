import React from 'react';
import JobEntranceScreen from '../../shared/ui/JobEntranceScreen';
import { ADMIN_HOTBAR } from './admin-entrance-hotbar.config';

/**
 * 管理エントランス（他エントランスと同様に Visualizer + メイン + ホットバー4枠）
 * 選択肢はホットバーボタン。オーバーレイ禁止。権限ガードは当面なし。
 */
export default function AdminEntrancePage() {
  return <JobEntranceScreen job="admin" hotbarConfig={ADMIN_HOTBAR} />;
}
