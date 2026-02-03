/**
 * スケジュールID生成（複数人案件で同一 schedule_id を一括生成する際に使用）
 * @param {string} [prefix='sch']
 * @returns {string}
 */
export function newScheduleId(prefix = 'sch') {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${Date.now()}_${rand}`;
}
