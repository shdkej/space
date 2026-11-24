import React, { useEffect, useState } from "react";

const SOURCES = {
  posthog: { title: "PostHog · 앱별", scopes: ["policycock", "miniapp-image-tools", "앱 미지정"], metrics: { sessions: "고유 세션", pageviews: "페이지뷰", events: "이벤트" } },
  ga4: { title: "GA4", scopes: ["blog", "afzma", "policycock", "purple-place-bb6ce"], metrics: { newUsers: "신규 사용자", sessions: "세션" } },
  instagram: { title: "Instagram", scopes: ["minimal_collector"], metrics: { views: "조회수", reach: "도달 계정", viewers: "조회한 사람", interactions: "반응", profileVisits: "프로필 방문", followers: "총 팔로워" } },
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const timestamp = (value) => new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

export default function ChannelAnalytics({ source, url }) {
  const [feed, setFeed] = useState(null);
  const [status, setStatus] = useState("조회 중");
  const { title, scopes: defaults, metrics } = SOURCES[source];
  const published = (feed?.rows || []).map((r) => r?.scope).filter((name) => typeof name === "string" && name.length > 0);
  const scopes = source === "instagram" ? defaults : [...new Set([...defaults, ...published])];
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function update() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (data.schemaVersion !== 1 || data.source !== source || !Array.isArray(data.rows) ||
            !Number.isFinite(Date.parse(data.observedAt))) throw Error();
        if (!controller.signal.aborted) { setFeed(data); setStatus(""); }
      } catch {
        if (!controller.signal.aborted) setStatus("실측 확인 대기");
      } finally { busy = false; }
    }
    update();
    const timer = setInterval(update, 600000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [source, url]);
  return <section className="channel-analytics" aria-label={title + " 실측"}>
    <header><h3>{title}</h3>{status && <small>{status}</small>}</header>
    {!scopes.length && <small>프로젝트별 집계 미연결</small>}
    {scopes.map((scope) => {
      const row = feed?.rows.find((item) => item?.scope === scope);
      const observedAt = row?.observedAt || feed?.observedAt;
      const periodLabel = typeof row?.periodLabel === "string" && row.periodLabel.trim()
        ? row.periodLabel
        : DATE.test(row?.periodStart) && DATE.test(row?.periodEnd)
          ? `${row.periodStart} – ${row.periodEnd} (${row.timeZone})` : null;
      return <div key={scope} className="channel-scope">
        <h4>{source === "instagram" ? "@" : ""}{scope}</h4>
        {row && periodLabel ? <>
          <p>{Object.entries(metrics).map(([key, label]) => {
            if (source === "instagram" && key !== "views" && !Object.hasOwn(row.values || {}, key)) return null;
            const value = row.values?.[key];
            return <span key={key}>{label} <b>{Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("ko-KR") : "측정값 없음"}</b></span>;
          })}</p>
          <small>{periodLabel}{row.method && ` · ${row.method}`}</small>
          <small>조회 {timestamp(observedAt)}{Date.now() - Date.parse(observedAt) > 86400000 && " · 24시간 이상 경과"}{row.status === "unavailable" && " · 최근 수집 실패"}</small>
        </> : <small>집계 미연결</small>}
      </div>;
    })}
  </section>;
}
