import assert from "node:assert/strict";
import test from "node:test";
import { systemLayers } from "../src/systemLayers.js";

const live = { system: { backlogs: [], knowledgeSource: { added24h: 0, added7d: 12, status: "ok" } } };
const counts = { notion: { total: 219, withoutPlatform: 65, status: "ok" }, linear: { backlog: 0, status: "ok" }, observedAt: new Date().toISOString() };
const sources = (snapshot = live, feed = counts) => systemLayers(snapshot, {}, {}, feed)[1].collections;

test("L2 combines Notion missing/total and retains successful zero counts", () => {
  assert.deepEqual(sources()?.map(row => row.value), ["65 / 219건", "0건", "0 / 12건"]);
});

test("a failed service retains its collection description and cannot become zero", () => {
  const rows = sources(live, { ...counts, notion: { status: "unavailable" } });
  assert.deepEqual(rows?.map(row => row.value), ["미수집", "0건", "0 / 12건"]);
  assert.ok(rows[0].description);
  assert.ok(rows[1].description);
});

test("a failed KL audit does not present source additions as collected", () => {
  const rows = sources({ ...live, audit: { sections: [{ name: "knowledge_source", state: "error" }] } });
  assert.equal(rows?.[2].value, "미수집");
});

test("KL source counts distinguish missing, malformed and successful zero observations", () => {
  for (const knowledgeSource of [undefined, { status: "unavailable" },
    { added24h: 2, added7d: 1, status: "ok" }]) {
    assert.equal(sources({ system: { knowledgeSource } })[2].value, "미수집");
  }
  assert.equal(sources({ system: { knowledgeSource: { added24h: 0, added7d: 0, status: "ok" } } })[2].value, "0 / 0건");
});
