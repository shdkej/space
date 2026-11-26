const states = {
  ok: "ok", operational: "ok", warn: "warn", maintenance: "warn", degraded: "warn",
  bad: "bad", down: "bad", none: "none", planned: "none",
};

function worst(values) {
  const normalized = values.map(value => states[value] || "none");
  return ["bad", "warn", "none", "ok"].find(value => normalized.includes(value)) || "none";
}

const count = value => Number.isInteger(value) && value >= 0 ? value + "건" : "미수집";

export function systemLayers(live) {
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
  const outputs = collected("freshness") && Array.isArray(live?.outputs) ? live.outputs : null;
  const cronStates = crons?.map(row => row.status) ?? ["none"];
  const backlogStates = backlogs?.map(row => row.state) ?? ["none"];
  const overdue = outputs?.filter(row => ["warn", "bad"].includes(row.state));
  const knownOutputStates = outputs?.every(row => ["ok", "warn", "bad"].includes(row.state));

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
    {
      name: "L4 아티팩트", state: worst(outputs?.map(row => row.state) || []),
      readiness: overdue?.length ? "갱신 지연" : undefined,
      detail: outputs ? "산출물 " + outputs.length + "개 · 갱신 지연 " + (knownOutputStates ? overdue.length + "개" : "집계 대기") : "산출물 수집 대기",
      observations: outputs?.length ? [...outputs].sort((a, b) => overdue.includes(b) - overdue.includes(a)).map(row => {
        const age = Number.isFinite(row.ageHours) ? (row.ageHours < 1 ? "1시간 이내" : Math.round(row.ageHours) + "시간 전") : "갱신 시각 미수집";
        const label = {ok: "최신", warn: "갱신 주의", bad: "갱신 지연"}[row.state] || "상태 미수집";
        return row.name + " · " + label + " · " + age;
      }) : [outputs ? "등록된 산출물 없음" : "산출물 수집 대기"],
    },
  ];
}
