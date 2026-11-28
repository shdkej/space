const states = {
  ok: "ok", operational: "ok", warn: "warn", maintenance: "warn", degraded: "warn",
  bad: "bad", down: "bad", none: "none", planned: "none",
};

function worst(values) {
  const normalized = values.map(value => states[value] || "none");
  return ["bad", "warn", "none", "ok"].find(value => normalized.includes(value)) || "none";
}

const count = value => Number.isInteger(value) && value >= 0 ? value + "건" : "미수집";

const artifactRepos = [
  ["infinity", "Infinity"],
  ["openclaw-backups", "OpenClaw Backups"],
  ["knowledge-lab", "Knowledge Lab"],
  ["agent-wiki", "Agent Wiki"],
  ["shdkej.github.io", "shdkej.github.io"],
];
export async function fetchPublicCommitTimes(signal) {
  const repos = ["agent-wiki", "shdkej.github.io"];
  const results = await Promise.allSettled(repos.map(async repo => {
    const response = await fetch(`https://api.github.com/repos/shdkej/${repo}/commits?per_page=1`, {
      signal, credentials: "omit", referrerPolicy: "no-referrer",
    });
    if (!response.ok) return null;
    const [latest] = await response.json();
    return latest?.commit?.committer?.date;
  }));
  return Object.fromEntries(repos.map((repo, index) => [repo, results[index].value]));
}

function artifactLayer(collectedRepos, publicCommits) {
  const entries = artifactRepos.map(([repo, name]) => {
    const feed = collectedRepos.find(row => row.repo === "shdkej/" + repo);
    const direct = publicCommits[repo];
    const date = Date.parse(direct || (feed?.state === "ok" ? feed.updatedAt : ""));
    const source = direct ? "GitHub API" : "운영 피드";
    return { name, timestamp: Number.isFinite(date) ? date : null, source };
  });
  const known = entries.filter(entry => entry.timestamp !== null).length;
  return {
    name: "L4 아티팩트", state: known === entries.length ? "ok" : "none",
    readiness: known === entries.length ? "확인됨" : "확인 대기",
    detail: `저장소 5개 · 최근 커밋 시각 ${known}개 확인`,
    artifacts: entries,
  };
}

export function systemLayers(live, publicCommits, workflow, workCounts) {
  const system = live?.system;
  const sections = live?.audit?.sections || [];
  const collected = name => {
    const section = sections.find(item => item.name === name);
    return !section || section.state === "ok";
  };
  const life = collected("review") && system?.layers?.find(row => row?.key?.toLowerCase() === "l1");
  const backlogs = collected("backlogs") && Array.isArray(system?.backlogs)
    ? system.backlogs.filter(row => row.name !== "marketing-inbox-7d")
    : null;
  // Accept the previous feed during rollout; the reduced collector publishes evidence only.
  const evidence = live?.evidence || live?.monitoring;
  const evidenceReady = collected(live?.evidence ? "evidence" : "monitoring");
  const repos = evidenceReady && Array.isArray(evidence?.github) ? evidence.github : [];
  const { notion, linear, observedAt } = workCounts || {};
  const hasCount = value => Number.isInteger(value) && value >= 0;
  const notionReady = notion?.status === "ok" && hasCount(notion.total) &&
    hasCount(notion.withoutPlatform) && notion.withoutPlatform <= notion.total;
  const linearReady = linear?.status === "ok" && hasCount(linear.backlog);
  const notionLabel = notionReady
    ? `Notion 전체 ${count(notion.total)} 중 플랫폼 없음 ${count(notion.withoutPlatform)}`
    : "Notion 미수집";
  const linearLabel = linearReady ? "Linear 백로그 " + count(linear.backlog) : "Linear 백로그 미수집";
  const sampledAt = Date.parse(observedAt);
  const fresh = Number.isFinite(sampledAt) && Date.now() - sampledAt < 36 * 60 * 60 * 1000;
  const backlogStates = backlogs?.map(row => row.state) ?? ["none"];
  const summarized = backlogs?.find(row => row.name === "kl-summarized");

  return [
    {
      name: "L1 삶", state: states[life?.state] || "none",
      detail: life?.detail || life?.reason || "데일리 리뷰 수집 대기", metricId: "system.layer.l1",
    },
    {
      name: "L2 업/시스템", state: worst([...backlogStates, notionReady && linearReady && fresh ? "ok" : "none"]),
      detail: [notionLabel, linearLabel].join(" · "),
      collections: [
        { name: "Notion · 소셜 미디어 콘텐츠", description: "보관·휴지통을 제외한 전체 페이지", value: notionReady ? count(notion.total) : "미수집" },
        { name: "Notion · 플랫폼 미지정", description: "소셜 미디어 콘텐츠 중 ‘플랫폼’이 비어 있는 페이지", value: notionReady ? count(notion.withoutPlatform) : "미수집" },
        { name: "Linear · 백로그", description: "접근 가능한 미보관 이슈 중 backlog 상태인 이슈", value: linearReady ? count(linear.backlog) : "미수집" },
        { name: "Knowledge Lab · 마케팅 자료", description: "요약 완료 상태로 남아 있는 자료", value: count(summarized?.count) },
      ],
    },
    workflow,
    artifactLayer(repos, publicCommits),
  ];
}
