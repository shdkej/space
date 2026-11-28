import assert from "node:assert/strict";
import test from "node:test";
import { systemLayers } from "../src/systemLayers.js";

const live = { system: { backlogs: [{ name: "kl-summarized", count: 19, state: "ok" }] } };
const counts = { notion: { total: 219, withoutPlatform: 65, status: "ok" }, linear: { backlog: 0, status: "ok" }, observedAt: new Date().toISOString() };
const sources = (snapshot = live, feed = counts) => systemLayers(snapshot, {}, {}, feed)[1].collections;

test("L2 collection rows expose the four measured counts including a successful zero", () => {
  assert.deepEqual(sources()?.map(row => row.value), ["219건", "65건", "0건", "19건"]);
});

test("a failed service retains its collection description and cannot become zero", () => {
  const rows = sources(live, { ...counts, notion: { status: "unavailable" } });
  assert.deepEqual(rows?.map(row => row.value), ["미수집", "미수집", "0건", "19건"]);
  assert.ok(rows[0].description);
  assert.ok(rows[1].description);
});

test("a failed KL audit does not present the previous backlog count as collected", () => {
  const rows = sources({ ...live, audit: { sections: [{ name: "backlogs", state: "error" }] } });
  assert.equal(rows?.[3].value, "미수집");
});
