import * as React from "react";

const dayMs = 86400000;
const kstOffset = 9 * 3600000;
const fullTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dayLabel = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
});
const yearLabel = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "2-digit", month: "numeric", day: "numeric",
});
const hourLabel = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", hourCycle: "h23",
});
const kstMidnight = date => Math.floor((date + kstOffset) / dayMs) * dayMs - kstOffset;

export function ArtifactTimeline({ entries }) {
  const times = entries.map(entry => entry.timestamp).filter(Number.isFinite);
  const start = times.length ? kstMidnight(Math.min(...times)) : 0;
  const end = times.length ? kstMidnight(Math.max(...times)) + dayMs : dayMs;
  const spansYears = new Date(start + kstOffset).getUTCFullYear() !== new Date(end + kstOffset).getUTCFullYear();
  const axis = end - start <= dayMs ? hourLabel : spansYears ? yearLabel : dayLabel;
  return <figure className="artifact-timeline">
    <figcaption><strong>저장소별 마지막 수정일</strong><small>최근 커밋 · 전체 범위 · 한국 시간(KST)</small></figcaption>
    <ul>{entries.map(({ name, timestamp, source }) =>
      <li key={name}>
        <div className="artifact-label">
          <strong>{name}</strong>
          {timestamp === null ? <small>최근 커밋 미확인</small> :
            <small><time dateTime={new Date(timestamp).toISOString()}>{fullTime.format(timestamp)}</time> · {source}</small>}
        </div>
        <div className="artifact-track" aria-hidden="true">
          {timestamp !== null && <i className="artifact-point" style={{ left: (timestamp - start) / (end - start) * 100 + "%" }} />}
        </div>
      </li>)}</ul>
    {times.length > 0 && <div className="artifact-axis" aria-hidden="true">
      {[start, (start + end) / 2, end].map(tick => <span key={tick}>{axis.format(tick)}</span>)}
    </div>}
  </figure>;
}
