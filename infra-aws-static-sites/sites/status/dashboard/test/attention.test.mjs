import assert from "node:assert/strict";
import test from "node:test";
import { attentionItems } from "../src/attention.js";

const now = Date.parse("2026-11-28T04:00:00Z");
const date = new Date(now).toISOString();
const healthy = () => ({
  now,
  data: { generatedAt: date, checks: [{ name: "Status", url: "https://status.example", state: "ok" }] },
  live: { generatedAt: date, crons: [], audit: { sections: [] }, system: {
    knowledgeSource: { status: "ok", added24h: 0, added7d: 0 },
  } },
  workCounts: { observedAt: date, notion: { status: "ok", total: 0, withoutPlatform: 0 }, linear: { status: "ok", backlog: 0 } },
});

test("healthy observations, including zero counts, need no attention", () => {
  assert.deepEqual(attentionItems(healthy()), []);
});

test("counts failed enabled jobs and surfaces, without counting disabled jobs or layer rollups", () => {
  const input = healthy();
  input.live.crons = [
    { id: "daily", name: "Daily review", enabled: true, status: "degraded", last_status: "error", consecutive_errors: 1 },
    { id: "paused", enabled: false, status: "degraded", last_status: "error" },
    { id: "new", enabled: true, status: "planned", last_status: null },
  ];
  input.live.system.layers = [{ key: "l2", state: "warn" }, { key: "l3", state: "bad" }];
  input.data.checks.push({ name: "App", url: "https://app.example", state: "bad" });
  assert.deepEqual(attentionItems(input).map(x => x.id).sort(), ["cron:daily", "surface:https://app.example"]);
});

test("a failed source is counted once across audit and aggregate feeds", () => {
  const input = healthy();
  input.live.audit.sections = [
    { name: "notion", state: "error" }, { name: "work_counts", state: "error" },
    { name: "knowledge_source", state: "error" },
  ];
  input.live.system.knowledgeSource = { status: "unavailable" };
  input.workCounts.notion = { status: "unavailable" };
  assert.deepEqual(attentionItems(input).map(x => x.id).sort(), ["source:knowledge_source", "source:notion"]);
});

test("a source failure and unrelated audit failure remain distinct", () => {
  const input = healthy();
  input.live.audit.sections = [{ name: "crons", state: "error" }];
  input.workCounts.linear = { status: "unavailable" };
  assert.equal(attentionItems(input).length, 2);
});

test("nested evidence failures count even when their audit wrapper succeeded", () => {
  const input = healthy();
  input.live.audit.sections = [{ name: "evidence", state: "ok" }];
  input.live.evidence = { prometheus: { state: "warn" }, github: [{ repo: "example/repo", state: "warn" }, { repo: "example/ok", state: "ok" }] };
  assert.equal(attentionItems(input).length, 2);
  input.live.audit.sections[0].state = "error";
  assert.deepEqual(attentionItems(input).map(x => x.id), ["source:evidence"]);
});

test("missing feeds never look like a successful zero", () => {
  assert.equal(attentionItems({ now }).length, 3);
  const input = healthy();
  input.data.checks = [];
  input.workCounts.notion = { status: "ok", total: 5, withoutPlatform: 6 };
  assert.equal(attentionItems(input).length, 2);
});

test("stale live feeds count once per feed, without repeating old source and job errors", () => {
  const input = healthy();
  input.live.generatedAt = input.workCounts.observedAt = "2026-11-28T01:00:00Z";
  input.live.crons = [{ id: "old", enabled: true, last_status: "error" }];
  input.live.audit.sections = [{ name: "notion", state: "error" }];
  input.workCounts.notion = { status: "unavailable" };
  assert.deepEqual(attentionItems(input).map(x => x.id), ["feed:agents", "feed:work-counts"]);
});

test("static service checks retain their last deployment observation; invalid live time is unavailable", () => {
  const input = healthy();
  input.data.generatedAt = "2026-11-01T00:00:00Z";
  assert.deepEqual(attentionItems(input), []);
  input.live.generatedAt = "invalid";
  assert.deepEqual(attentionItems(input).map(x => x.id), ["feed:agents"]);
});
