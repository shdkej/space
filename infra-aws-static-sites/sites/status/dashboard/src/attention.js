const MAX_LIVE_AGE = 2 * 60 * 60 * 1000;
const hasCount = value => Number.isInteger(value) && value >= 0;
const sourceNames = {
  crons: "자동 작업 목록", intents: "작업 현황", workflow: "워크플로",
  freshness: "결과물 갱신", backlogs: "업무 집계", knowledge_source: "Knowledge Lab",
  layer_checks: "운영 레이어", pdca: "실행 주기", effectiveness: "실행 결과",
  review: "데일리 리뷰", notion: "Notion", work_counts: "Notion·Linear 집계",
  evidence: "운영 근거", role_watchers: "역할 관찰", office: "Agents",
};

// Count actionable observations, not the layer summaries derived from them.
export function attentionItems({ data, live, workCounts, now = Date.now() }) {
  const items = new Map();
  const add = (id, name, detail, view, state = "warn") => items.set(id, { id, name, detail, view, state });
  const source = name => add(`source:${name}`, sourceNames[name] || name, "수집 실패 · 원본 연결과 수집기를 확인하세요.", "system");
  const feedReady = (value, timestamp, id, name, view) => {
    const time = Date.parse(timestamp);
    if (!value || !Number.isFinite(time) || time > now + 5 * 60 * 1000) {
      add(`feed:${id}`, name, "피드를 확인할 수 없습니다.", view);
      return false;
    }
    if (now - time > MAX_LIVE_AGE) {
      add(`feed:${id}`, name, "2시간 넘게 갱신되지 않았습니다.", view);
      return false;
    }
    return true;
  };

  if (!Array.isArray(data?.checks) || !data.checks.length) {
    add("feed:status", "서비스 상태", "서비스 점검 결과를 불러오지 못했습니다.", "surfaces");
  } else {
    for (const check of data.checks) {
      if (check.state !== "ok") add(`surface:${check.url || check.name}`, check.name, "최근 배포 점검에서 정상 응답을 확인하지 못했습니다.", "surfaces", check.state === "bad" ? "bad" : "warn");
    }
  }

  const liveReady = feedReady(Array.isArray(live?.crons) && Array.isArray(live?.audit?.sections), live?.generatedAt, "agents", "운영 피드", "output");
  const countsReady = feedReady(workCounts, workCounts?.observedAt, "work-counts", "업무 집계 피드", "system");
  if (countsReady) {
    const { notion, linear } = workCounts;
    if (notion?.status !== "ok" || !hasCount(notion.total) || !hasCount(notion.withoutPlatform) || notion.withoutPlatform > notion.total) source("notion");
    if (linear?.status !== "ok" || !hasCount(linear.backlog)) {
      add("source:linear", "Linear", "수집 실패 · 원본 연결과 수집기를 확인하세요.", "system");
    }
  }
  if (liveReady) {
    const collected = name => !live.audit.sections.some(section => section.name === name && section.state !== "ok");
    if (collected("evidence")) {
      const evidence = live.evidence;
      if (evidence?.prometheus && evidence.prometheus.state !== "ok") {
        add("source:prometheus", "Prometheus 노드 목록", "수집 실패 · 노드 목록 연결을 확인하세요.", "system");
      }
      for (const repo of evidence?.github || []) {
        if (repo.state !== "ok") add(`source:github:${repo.repo}`, repo.repo, "GitHub 수집 실패 · 최근 커밋을 확인하지 못했습니다.", "system");
      }
    }
    for (const cron of live.crons) {
      if (collected("crons") && cron.enabled && (cron.last_status === "error" || cron.consecutive_errors > 0 || ["degraded", "down"].includes(cron.status))) {
        add(`cron:${cron.id || cron.name}`, cron.name || cron.id, "자동 작업 · 최근 실행 오류", "output");
      }
    }
    const knowledge = live.system?.knowledgeSource;
    if (knowledge?.status !== "ok" || !hasCount(knowledge.added24h) || !hasCount(knowledge.added7d) || knowledge.added24h > knowledge.added7d) source("knowledge_source");
    for (const section of live.audit.sections) {
      if (section.state === "ok") continue;
      // Missing/stale aggregate feed already has one item. Per-service failures
      // explain the work_counts wrapper failure, so don't count it again.
      if (["notion", "work_counts"].includes(section.name) && !countsReady) continue;
      if (section.name === "work_counts" && (items.has("source:notion") || items.has("source:linear") || live.audit.sections.some(row => row.name === "notion" && row.state !== "ok"))) continue;
      source(section.name);
    }
  }
  return [...items.values()];
}
