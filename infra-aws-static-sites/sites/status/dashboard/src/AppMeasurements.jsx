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

export function appMeasurementSeries({ feed, metricKey, unit, label }, range) {
  const series = feed.rows.map(row => {
    const buckets = new Map();
    for (const sample of row.periods?.[range] || []) {
      const start = Date.parse(sample.periodStart + "T00:00:00Z") / 1000;
      const end = Date.parse(sample.periodEnd + "T00:00:00Z") / 1000;
      const observed = Date.parse(sample.observedAt) / 1000;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || !Number.isFinite(observed)) continue;
      const dates = sample.periodStart === sample.periodEnd ? sample.periodStart : `${sample.periodStart} – ${sample.periodEnd}`;
      const period = sample.timeZone ? `${dates} (${sample.timeZone})` : dates;
      const value = sample.values?.[metricKey];
      buckets.set(end, [end, Number.isSafeInteger(value) && value >= 0 ? value : null, { start, period, observed, events: sample.values?.events, eventsWithSessionId: sample.eventsWithSessionId }]);
    }
    return { name: row.scope, points: [...buckets.values()].sort((a, b) => a[0] - b[0]),
      failed: feed.failed || row.status === "unavailable" || row.periodStatus === "partial" };
  });
  return { label, series, unit, metricKey, calendar: true, failed: feed.failed };
}
