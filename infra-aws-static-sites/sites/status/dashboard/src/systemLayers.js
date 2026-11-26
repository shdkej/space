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
const commitTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

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
    return { name, when: Number.isFinite(date) ? commitTime.format(date) + " KST · " + source : null };
  });
  const known = entries.filter(entry => entry.when).length;
  return {
    name: "L4 아티팩트", state: known === entries.length ? "ok" : "none",
    readiness: known === entries.length ? "확인됨" : "확인 대기",
    detail: `저장소 5개 · 최근 커밋 시각 ${known}개 확인`,
    observations: entries.map(entry => entry.name + " · " + (entry.when || "최근 커밋 미확인")),
  };
}

export function systemLayers(live, publicCommits = {}) {
  const system = live?.system;
  const sections = live?.audit?.sections || [];
  const collected = name => {
    const section = sections.find(item => item.name === name);
    return !section || section.state === "ok";
  };
  const life = collected("review") && system?.layers?.find(row => row?.key?.toLowerCase() === "l1");
  const crons = collected("crons") && Array.isArray(live?.crons) ? live.crons : null;
  const backlogs = collected("backlogs") && Array.isArray(system?.backlogs) ? system.backlogs : null;
  const infra = collected("monitoring") && live?.monitoring?.prometheus;
  const intents = collected("intents") && system?.intents;
  const pdca = collected("pdca") && system?.pdca;
  const repos = collected("monitoring") && Array.isArray(live?.monitoring?.github) ? live.monitoring.github : [];
  const cronStates = crons?.map(row => row.status) ?? ["none"];
  const backlogStates = backlogs?.map(row => row.state) ?? ["none"];

  return [
    {
      name: "L1 삶", state: states[life?.state] || "none",
      detail: life?.detail || life?.reason || "데일리 리뷰 수집 대기", metricId: "system.layer.l1",
    },
    {
      name: "L2 업/시스템", state: worst([...cronStates, ...backlogStates]),
      detail: [crons ? "크론 " + crons.length + "개" : "크론 수집 대기",
        backlogs ? "백로그 " + backlogs.length + "종" : "백로그 수집 대기",
        Array.isArray(infra?.nodes) ? "인프라 노드 " + infra.nodes.length + "개" : "인프라 수집 대기"].join(" · "),
      observations: [
        ...(crons ? ["크론 " + crons.length + "개 중 주의·중단 " + cronStates.filter(value => ["warn", "bad"].includes(states[value])).length + "개"] : ["크론 상태 수집 대기"]),
        ...(backlogs || []).map(row => row.name + " · " + count(row.count) + " / 경고 " + count(row.warnAt)),
        ...(infra?.nodes || []).map(row => row.name + " · " + (row.status || "상태 미수집")),
      ],
    },
    {
      name: "L3 워크플로우", state: states[pdca?.state || pdca?.status] || "none",
      readiness: pdca && !states[pdca.state || pdca.status] ? "상태 미수집" : undefined,
      detail: intents ? "Infinity 접수 " + count(intents.inbox) + " · 진행 " + count(intents.active) + " · 대기 " + count(intents.waiting) : "Infinity 수집 대기",
      observations: pdca ? [
        "미해결 감시 항목 " + count(pdca.checkUnresolved),
        "최근 7일 품질 게이트 실패 " + count(pdca.checkFailures7d),
        "운영 규칙 " + count(pdca.actRules),
      ] : ["PDCA 수집 대기"],
    },
    artifactLayer(repos, publicCommits),
  ];
}
