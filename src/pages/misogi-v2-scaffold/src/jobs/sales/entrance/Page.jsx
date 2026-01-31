import React from 'react';
import JobEntranceScreen from '../../../shared/ui/JobEntranceScreen';
import { SALES_HOTBAR } from './hotbar.config';

export default function Page() {
  return <JobEntranceScreen job="sales" hotbarConfig={SALES_HOTBAR} />;
}
