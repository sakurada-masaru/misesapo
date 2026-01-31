import React from 'react';
import JobEntranceScreen from '../../../shared/ui/JobEntranceScreen';
import { DEV_HOTBAR } from './hotbar.config';

export default function Page() {
  return <JobEntranceScreen job="dev" hotbarConfig={DEV_HOTBAR} />;
}
