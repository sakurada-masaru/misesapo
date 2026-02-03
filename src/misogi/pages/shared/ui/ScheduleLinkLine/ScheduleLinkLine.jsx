import React, { useMemo } from 'react';
import './schedule-link-line.css';

function daysBetween(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00');
  const b = new Date(bISO + 'T00:00:00');
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function shortLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w})`;
}

/**
 * カード内「2点＋実線＋-7dラベル」で同一案件の工程連結を可視化。
 * 3点セットで説明ゼロで伝える：中央に -7d、両端に日付、役割名（事前連絡/清掃当日）。
 *
 * 縦型: 縦スクロールUIと相性◎（SPで自動切替）
 * 横型: カード幅があるPC向け
 *
 * @param {string} contactDueISO - 事前連絡期限 "YYYY-MM-DD"
 * @param {string} workISO - 清掃当日 "YYYY-MM-DD"
 * @param {string} contactLabel - 左/上ラベル（既定: "事前連絡"）
 * @param {string} workLabel - 右/下ラベル（既定: "清掃当日"）
 * @param {string} contactStatusLabel - 事前連絡ノード横の状態表示（例: "未連絡"）→ [未連絡]
 * @param {string} workStatusLabel - 清掃当日ノード横の状態表示（例: "予定"）→ [予定]
 * @param {string} workTime - 清掃時刻（例: "09:00"）→ 日付の横に表示
 * @param {boolean} contactDone - 事前連絡済なら true（未連絡時は中央を「要連絡」、●を空丸に）
 * @param {boolean} within48h - 清掃が48h以内なら true（線・バッジに⚠）
 */
export default function ScheduleLinkLine({
  contactDueISO,
  workISO,
  contactLabel = '事前連絡',
  workLabel = '清掃当日',
  contactStatusLabel,
  workStatusLabel,
  workTime,
  contactDone = true,
  within48h = false,
}) {
  const diff = useMemo(() => daysBetween(contactDueISO, workISO), [contactDueISO, workISO]);
  const diffText = diff === 7 ? '-7d' : `-${diff}d`;
  const badgeText = !contactDone ? `要連絡（${diffText}）` : diffText;
  const workSub = workTime ? `${shortLabel(workISO)} ${workTime}` : shortLabel(workISO);

  return (
    <div className="schedule-link-line" role="img" aria-label={`${contactLabel} ${shortLabel(contactDueISO)} から ${workLabel} ${shortLabel(workISO)} まで ${diff}日前`}>
      <div className="schedule-link-line-node">
        <div
          className={`schedule-link-line-dot ${!contactDone ? 'schedule-link-line-dot--pending' : ''}`}
          aria-hidden
        />
        <div className="schedule-link-line-text">
          <div className="schedule-link-line-title">{contactLabel}</div>
          <div className="schedule-link-line-sub">{shortLabel(contactDueISO)} 期限</div>
        </div>
        {contactStatusLabel != null && contactStatusLabel !== '' && (
          <span className="schedule-link-line-status">{contactStatusLabel}</span>
        )}
      </div>

      <div className="schedule-link-line-connector" aria-hidden>
        <div className={`schedule-link-line-solid ${within48h ? 'schedule-link-line-solid--warn' : ''}`} />
        <div className={`schedule-link-line-badge ${within48h ? 'schedule-link-line-badge--warn' : ''}`}>
          {within48h && <span className="schedule-link-line-warn" aria-hidden>⚠</span>}
          {badgeText}
        </div>
      </div>

      <div className="schedule-link-line-node">
        <div className="schedule-link-line-dot schedule-link-line-dot--work" aria-hidden />
        <div className="schedule-link-line-text">
          <div className="schedule-link-line-title">{workLabel}</div>
          <div className="schedule-link-line-sub">{workSub}</div>
        </div>
        {workStatusLabel != null && workStatusLabel !== '' && (
          <span className="schedule-link-line-status">{workStatusLabel}</span>
        )}
      </div>
    </div>
  );
}
