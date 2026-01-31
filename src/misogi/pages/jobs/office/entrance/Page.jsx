import React from 'react';
import JobEntranceScreen from '../../../shared/ui/JobEntranceScreen';
import { OFFICE_HOTBAR } from './hotbar.config';

export default function Page() {
  return <JobEntranceScreen job="office" hotbarConfig={OFFICE_HOTBAR} />;
}
