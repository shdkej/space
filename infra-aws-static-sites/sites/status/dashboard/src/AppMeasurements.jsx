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

export function appMeasurementSeries({ feed, metricKey, unit, label }) {
  const series = feed.rows.map(row => {
    const observations = new Map();
    for (const sample of [...(Array.isArray(row.history) ? row.history : []), row]) {
      const observed = Date.parse(sample?.observedAt) / 1000;
      const time = sample?.sampleAt ? Date.parse(sample.sampleAt) / 1000 : observed;
      if (!Number.isFinite(time) || !Number.isFinite(observed)) continue;
      const value = sample.values?.[metricKey];
      const period = sample.periodLabel || (sample.periodStart && sample.periodEnd
        ? `${sample.periodStart} – ${sample.periodEnd}${sample.timeZone ? " (" + sample.timeZone + ")" : ""}` : "");
      observations.set(time, [time, Number.isSafeInteger(value) && value >= 0 ? value : null, period, observed, !!sample.sampleAt]);
    }
    return { name: row.scope, points: [...observations.values()].sort((a, b) => a[0] - b[0]),
      failed: feed.failed || row.status === "unavailable" };
  });
  return { label, series, unit, observations: true, failed: feed.failed };
}
