// Execute with Ego Lite's nodejs command in the signed-in Korean Analytics UI.
const properties = [
  ["blog", "110967461", "252603434", "내 블로그"],
  ["afzma", "383859191", "523848883", "afzma"],
  ["policycock", "417124324", "565383231", "모두의정책 웹사이트"],
  ["purple-place-bb6ce", "110967461", "376243766", "purple-place-bb6ce"],
];

const task = await taskSpace("Daily GA4 account aggregates for Status");
const page = task.page("p1");
const rows = [];

async function readTab(label) {
  return page.evaluate(label => {
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      const [name, value] = tab.innerText.trim().split(/\s*\n\s*/);
      if (name === label && /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value))
        return Number(value.replaceAll(",", ""));
    }
    return null;
  }, label);
}

async function selectMetric(label, preserve) {
  if (await readTab(label) !== null) return;
  const snapshot = await page.snapshot();
  const controls = [...snapshot.matchAll(/container "([^"\n]+)"\s+button \[ref=(\d+)\]/g)];
  const control = controls.find(([_, name]) =>
    /^(활성 사용자|새 사용자 수|세션수|이벤트 수|주요 이벤트|조회수)\s/.test(name) &&
    !name.startsWith(preserve + " "));
  if (!control) throw Error("GA4 metric selector unavailable");
  await page.click("@" + control[2]);
  const menu = await page.snapshot();
  const option = menu.match(new RegExp('button \\[ref=(\\d+)\\]\\s+text "' + label + '"'));
  if (!option) throw Error("GA4 metric unavailable");
  await page.click("@" + option[1]);
  await page.waitForFunction(label => [...document.querySelectorAll('[role="tab"]')].some(tab => {
    const [name, value] = tab.innerText.trim().split(/\s*\n\s*/);
    return name === label && /^[\d,]+$/.test(value);
  }), label, {timeout: 15000});
}

const requests = typeof requestedCalendarPeriods === "undefined" ? {} : requestedCalendarPeriods;
const koreanDate = iso => iso.split("-").map((part, i) => Number(part) + ["년", "월", "일"][i]).join(" ");

async function chooseRange(label) {
  const snapshot = await page.snapshot();
  const picker = snapshot.match(/comboboxgrouping "기간 선택 도구 열기" \[ref=(\d+)/);
  if (!picker) throw Error("GA4 date picker unavailable");
  await page.click("@" + picker[1]);
  const menu = await page.snapshot();
  const option = menu.match(new RegExp('menuitem \\[ref=(\\d+)[^\\]]*\\]\\s+text "' + label + '"'));
  if (!option) throw Error("GA4 date range option unavailable");
  await page.click("@" + option[1]);
}

async function waitForChart(range, path) {
  // The date control changes before the report data. Verify the chart's
  // rendered calendar ticks before accepting the newly selected metric totals.
  await page.waitForFunction(({periodStart, periodEnd, kind, path}) => {
    if (!location.hash.includes(path)) return false;
    const start = new Date(periodStart), end = new Date(periodEnd);
    const ticks = [...(document.querySelector("svg .chart-root .x-axis")?.querySelectorAll(".tick text") || [])].map(tick => {
      const lines = tick.querySelectorAll("tspan");
      return {day: Number(lines[0]?.textContent), month: parseInt(lines[1]?.textContent, 10)};
    });
    if (!ticks.length || ticks[0].month !== start.getUTCMonth() + 1) return false;
    if (kind === "month") {
      // GA4 draws sparse week ticks for a whole calendar month.
      return ticks.length >= 3 && ticks.length <= 6 &&
        ticks.every(tick => tick.day >= 1 && tick.day <= end.getUTCDate()) &&
        ticks.at(-1).day >= end.getUTCDate() - 7;
    }
    const count = Math.round((end - start) / 86400000) + 1;
    return ticks.length === count && ticks.every((tick, i) =>
      tick.day === new Date(start.getTime() + i * 86400000).getUTCDate());
  }, {...range, path}, {timeout: 15000});
}

async function readPeriod(range, path) {
  const {kind, periodStart, periodEnd} = range;
  if (!["day", "week", "month"].includes(kind) ||
      ![periodStart, periodEnd].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value))) throw Error("Invalid range");
  await chooseRange("맞춤");
  const selectedDates = () => page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] input')].map(input => input.value));
  const start = koreanDate(periodStart), end = koreanDate(periodEnd);
  for (let attempt = 0; attempt < 5; attempt++) {
    const [selectedStart, selectedEnd] = await selectedDates();
    if (selectedStart === start && selectedEnd === end) break;
    const nextDate = selectedStart === start && !selectedEnd ? end : start;
    await page.click('css:button[aria-label="' + nextDate + '"]');
  }
  const picked = await selectedDates();
  if (picked[0] !== start || picked[1] !== end) throw Error("GA4 date selection mismatch");
  const dialog = await page.snapshot({scope: "full_page"});
  const apply = dialog.match(/button \[ref=(\d+)[^\]]*\]\s+text "적용"/);
  if (!apply) throw Error("GA4 apply button unavailable");
  await page.click("@" + apply[1]);
  await waitForChart(range, path);
  const newUsers = await readTab("새 사용자 수"), sessions = await readTab("세션수");
  if (newUsers === null || sessions === null) throw Error("GA4 metric unavailable");
  return {periodStart, periodEnd, timeZone: "Asia/Seoul", observedAt: new Date().toISOString(),
    values: {newUsers, sessions}};
}

try {
  for (const [scope, account, property, name] of properties) {
    let row;
    let changedRange = false;
    try {
      await page.goto("about:blank");
      const path = "/a" + account + "p" + property + "/reports/intelligenthome";
      await page.goto("https://analytics.google.com/analytics/web/#" + path);
      await page.waitForFunction(([route, name]) =>
        location.hash.includes(route) && [...document.querySelectorAll('button')].some(b =>
          b.getAttribute("aria-label") === "범용 선택 도구 열기" && b.innerText.includes(name)) &&
        document.querySelectorAll('[role="tab"]').length >= 4 &&
        document.querySelector('button[aria-label="기간 선택 도구 열기"]'),
        [path, name], {timeout: 25000});
      const rolling = await page.evaluate(() =>
        document.querySelector('button[aria-label="기간 선택 도구 열기"]').innerText.includes("지난 7일"));
      if (!rolling) {
        await chooseRange("지난 7일");
        const today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Seoul"}).format(new Date());
        const daysAgo = count => new Date(Date.parse(today) - count * 86400000).toISOString().slice(0, 10);
        await waitForChart({kind: "week", periodStart: daysAgo(7), periodEnd: daysAgo(1)}, path);
      }
      await selectMetric("새 사용자 수", "세션수");
      await selectMetric("세션수", "새 사용자 수");
      const newUsers = await readTab("새 사용자 수");
      const sessions = await readTab("세션수");
      if (newUsers === null || sessions === null || !(await page.url()).includes(path))
        throw Error("GA4 selection changed");
      row = {scope, status: "ok", method: "GA4 홈 · Egolite", observedAt: new Date().toISOString(),
        periodLabel: "지난 7일 (GA4 속성 기준)", values: {newUsers, sessions}};
      if (requests[scope]?.length) {
        changedRange = true;
        row.periods = {day: [], week: [], month: []};
        for (const range of requests[scope]) {
          const observation = await readPeriod(range, path);
          row.periods[range.kind].push(observation);
        }
      }
    } catch {
      // Keep completed buckets; the publisher can retry any missing range.
      if (!row) row = {scope, status: "unavailable"};
    } finally {
      if (changedRange) {
        await page.keyboard.press("Escape").catch(() => {});
        await chooseRange("지난 7일").catch(() => {});
      }
    }
    rows.push(row);
  }
  console.log(JSON.stringify({schemaVersion: 1, source: "ga4", observedAt: new Date().toISOString(), rows}));
} finally {
  await task.finish({keep: []});
}
