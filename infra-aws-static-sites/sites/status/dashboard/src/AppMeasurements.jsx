import { useEffect, useState } from "react";

export function useAnalyticsFeed(source, enabled) {
  const [feed, setFeed] = useState({ rows: [], failed: false });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`./analytics-${source}.json`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (data.schemaVersion !== 1 || data.source !== source || !Array.isArray(data.rows)) throw Error();
        if (!controller.signal.aborted) setFeed({ rows: data.rows, failed: false });
      } catch {
        if (!controller.signal.aborted) setFeed(previous => ({ ...previous, failed: true }));
      }
    }
    refresh();
    const interval = setInterval(refresh, 600000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [enabled, source]);
  return feed;
}

export function AppMeasurements({ feed, metricKey, unit, label }) {
  return <div className="history-chart-wrap" aria-label={label}>
    <small className="history-footnote">{label} · 앱별 최근 7일</small>
    {!feed.rows.length && <p className="history-footnote">{feed.failed ? "집계 조회 실패" : "집계 확인 중"}</p>}
    {feed.rows.map(row => {
      const value = row.values?.[metricKey];
      const period = row.periodLabel || (row.periodStart && row.periodEnd && `${row.periodStart} – ${row.periodEnd} (${row.timeZone})`);
      const timestamp = Date.parse(row.observedAt);
      const observed = Number.isFinite(timestamp) && new Date(timestamp).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
      return <div className="history-legend" key={row.scope}>
        <span>{row.scope}<strong>{Number.isSafeInteger(value) && value >= 0 ? `${value.toLocaleString("ko-KR")}${unit}` : "측정값 없음"}</strong></span>
        <span>{[period, observed && `조회 ${observed}`, Date.now() - timestamp > 86400000 && "24시간 이상 경과", (feed.failed || row.status === "unavailable") && "최근 조회 실패"].filter(Boolean).join(" · ")}</span>
      </div>;
    })}
  </div>;
}
