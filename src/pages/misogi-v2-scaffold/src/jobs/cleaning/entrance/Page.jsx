import React from 'react';
import JobEntranceScreen from '../../../shared/ui/JobEntranceScreen';
import { CLEANING_HOTBAR } from './hotbar.config';

export default function Page() {
  return <JobEntranceScreen job="cleaning" hotbarConfig={CLEANING_HOTBAR} />;
}
