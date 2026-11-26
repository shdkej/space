import { useEffect, useState } from "react";

const roles = ["planner", "developer", "marketer", "operator"];
const labels = ["기획", "개발", "마케팅", "운영"];
const dayMs = 86400000;
const historyUrl = "https://raw.githubusercontent.com/shdkej/prompt-archive/main/data/workflow-line-counts.json";

export function useWorkflowHistory(enabled) {
  const [feed, setFeed] = useState({ data: null, failed: false });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await fetch(historyUrl, { signal: controller.signal, cache: "no-cache", credentials: "omit" });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (data.version !== 1 || data.roles?.join() !== roles.join() || !Array.isArray(data.snapshots) || !data.snapshots.length) throw Error();
        const valid = data.snapshots.every((row, index, rows) =>
          /^\d{4}-\d{2}-\d{2}$/.test(row.date) && (!index || rows[index - 1].date < row.date) &&
          Array.isArray(row.counts) && row.counts.length === roles.length &&
          row.counts.every(n => n === null || (Number.isSafeInteger(n) && n >= 0)));
        if (!valid) throw Error();
        if (!controller.signal.aborted) setFeed({ data, observedAt: Date.now(), failed: false });
      } catch {
        if (!controller.signal.aborted) setFeed(previous => ({ ...previous, failed: true }));
      } finally {
        pending = false;
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 600000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled]);
  return feed;
}

const isoDay = epoch => new Date(epoch).toISOString().slice(0, 10);

// Calendar boundaries are represented as UTC midnights for KST date labels.
function periodStart(day, range) {
  const date = new Date(day);
  if (range === "month") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (range === "week") return day - (date.getUTCDay() + 6) % 7 * dayMs;
  return day;
}

export function workflowChart(feed, range) {
  const series = roles.map((role, index) => ({ name: labels[index] + " · " + role, points: [] }));
  const metric = { label: "역할별 워크플로우 파일 줄 수", unit: "줄", calendar: true, snapshot: true, series, failed: feed.failed };
  if (!feed.data) return metric;

  const history = feed.data.snapshots;
  const today = Math.floor((feed.observedAt + 9 * 3600000) / dayMs) * dayMs;
  let end = today;
  const periods = { day: 14, week: 12, month: 12 };
  for (let i = 0; i < periods[range]; i++) {
    const start = periodStart(end, range);
    const endDate = isoDay(end);
    const latest = history.findLast(sample => sample.date <= endDate);
    if (!latest) break;
    const startDate = isoDay(start);
    const period = (start === end ? endDate : startDate + " – " + endDate) + (i === 0 ? " (진행 중)" : "");
    const bucket = { start: start / 1000, period, observed: feed.observedAt / 1000 };
    series.forEach((item, index) => {
      const count = latest.counts[index];
      item.points.unshift([end / 1000, Number.isSafeInteger(count) && count >= 0 ? count : null, bucket]);
    });
    end = start - dayMs;
  }
  return metric;
}

export function workflowLayer(feed) {
  const counts = feed.data?.snapshots.at(-1)?.counts;
  const complete = counts?.every(Number.isSafeInteger);
  return {
    name: "L3 워크플로우", workflow: true,
    state: complete && !feed.failed ? "ok" : "none",
    readiness: feed.failed ? "조회 실패" : complete ? "확인됨" : counts ? "일부 미확인" : "확인 대기",
    detail: counts ? counts.map((n, i) => labels[i] + " " + (n === null ? "미확인" : n + "줄")).join(" · ") : "Prompt Archive 파일 줄 수 확인 대기",
  };
}
