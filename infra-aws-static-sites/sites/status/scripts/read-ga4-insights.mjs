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

const engagementLabel = '세션당 평균 참여 시간';

async function readTab(label) {
  const value = await page.evaluate(label => {
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      const [name, text] = tab.innerText.trim().split(/\s*\n\s*/);
      if (name === label) return text;
    }
    return null;
  }, label);
  if (!value) return null;
  if (label === engagementLabel) {
    const duration = /^(?:(\d+)시간\s*)?(?:(\d+)분\s*)?(?:(\d+)초)?$/.exec(value);
    return duration && duration.slice(1).some(Boolean)
      ? Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0) : null;
  }
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value) ? Number(value.replaceAll(",", "")) : null;
}

async function selectMetric(label, ...preserve) {
  if (await readTab(label) !== null) return;
  const snapshot = await page.snapshot();
  const controls = [...snapshot.matchAll(/container "([^"\n]+)"\s+button \[ref=(\d+)\]/g)];
  const control = controls.find(([_, name]) =>
    /^(활성 사용자|새 사용자 수|세션수|이벤트 수|주요 이벤트|조회수|세션당 평균 참여 시간)\s/.test(name) &&
    !preserve.some(kept => name.startsWith(kept + " ")));
  if (!control) throw Error("GA4 metric selector unavailable");
  await page.click("@" + control[2]);
  const menu = await page.snapshot();
  const option = menu.match(new RegExp('button \\[ref=(\\d+)\\]\\s+text "' + label + '"'));
  if (!option) throw Error("GA4 metric unavailable");
  await page.click("@" + option[1]);
  await page.waitForFunction(label => [...document.querySelectorAll('[role="tab"]')].some(tab => {
    const [name, value] = tab.innerText.trim().split(/\s*\n\s*/);
    return name === label && /^\d/.test(value);
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

async function readChannelSessions(account, property, name, expectedSessions, observedAt) {
  const report = page;
  const day = 86400000;
  const today = Date.parse(new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Seoul"}).format(new Date(observedAt)));
  const dates = [7, 1].map(n => new Date(today - n * day).toISOString().slice(0, 10));
  const path = "/a" + account + "p" + property + "/reports/explorer";
  const [start, end] = dates.map(d => d.replaceAll("-", ""));
  const params = encodeURIComponent("_u..nav=maui&_u.date00=" + start + "&_u.date01=" + end);
  await report.goto("about:blank");
  await report.goto("https://analytics.google.com/analytics/web/#" + path + "?r=lifecycle-traffic-acquisition-v2&params=" + params);
  await report.waitForFunction(({path, dates, name}) => {
    const selected = document.querySelector('button[aria-label="기간 선택 도구 열기"]')?.innerText || "";
    const bounds = [...selected.matchAll(/(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/g)];
    const matches = bounds.length === 2 && bounds.every((m, i) => {
      const [y, mo, d] = dates[i].split("-").map(Number);
      return (!m[1] || Number(m[1]) === y) && Number(m[2]) === mo && Number(m[3]) === d;
    });
    return matches && location.hash.includes(path) &&
      document.querySelector('button[aria-label="범용 선택 도구 열기"]')?.innerText.includes(name) &&
      [...document.querySelectorAll('tr[role="row"]')].some(r => r.cells[2]?.innerText.trim() === "합계") &&
      (document.querySelector('td[role="gridcell"]') || document.body.innerText.includes("데이터가 없습니다"));
  }, {path, dates, name}, {timeout: 20000});

  const readTable = () => report.evaluate(() => {
    const rows = [...document.querySelectorAll('tr[role="row"]')];
    const header = rows.find(r => r.cells[2]?.innerText.includes("세션 기본 채널 그룹(기본 채널 그룹)") &&
      r.cells[3]?.innerText.trim() === "세션수");
    if (!header) return null;
    const tableRows = rows.filter(r => r.closest("table") === header.closest("table"));
    const totalCell = tableRows.find(r => r.cells[2]?.innerText.trim() === "합계")?.cells[3].innerText;
    const totalText = totalCell?.split(/\n/).map(s => s.trim()).find(s => /^[\d,]+$/.test(s));
    if (!totalText) return null;
    const entries = tableRows.filter(r => /^\d+$/.test(r.cells[1]?.innerText.trim())).map(r => {
      const label = r.cells[2].innerText.trim();
      const count = r.cells[3].innerText.trim().match(/^([\d,]+)(?:\s|$)/);
      return [label, count ? Number(count[1].replaceAll(",", "")) : null];
    });
    return {total: Number(totalText.replaceAll(",", "")), entries};
  });
  let data = await readTable();
  if (data?.entries.length >= 10 && data.entries.reduce((sum, [, n]) => sum + n, 0) < expectedSessions) {
    await report.evaluate(() => document.getElementById("rows-per-page-select")?.scrollIntoView({block: "center"}));
    await report.click("css:#rows-per-page-select");
    await report.click('role:option[name="50"]');
    await report.waitForFunction(() => [...document.querySelectorAll('tr[role="row"]')].filter(r =>
      /^\d+$/.test(r.cells[1]?.innerText.trim())).length > 10, undefined, {timeout: 10000});
    data = await readTable();
  }
  if (!data || data.total !== expectedSessions || data.entries.length > 32 ||
      data.entries.some(([name, count]) => !name || name.length > 48 || !Number.isSafeInteger(count) || count < 0) ||
      new Set(data.entries.map(([name]) => name)).size !== data.entries.length ||
      data.entries.reduce((sum, [, count]) => sum + count, 0) !== expectedSessions) {
    throw Error("GA4 channel sessions do not match the source total");
  }
  return Object.fromEntries(data.entries);
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
      if (typeof collectPrivateEngagement !== "undefined" && collectPrivateEngagement && sessions > 0) {
        try {
          // Keep both required tabs available for the calendar queries.
          await selectMetric(engagementLabel, "새 사용자 수", "세션수");
          const seconds = await readTab(engagementLabel);
          if (seconds !== null) row.avgSessionEngagementSeconds = seconds;
        } catch {
          await page.keyboard.press("Escape").catch(() => {});
        }
      }
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
    if (typeof collectPrivateEngagement !== "undefined" && collectPrivateEngagement && row?.status === "ok") {
      try {
        row.channelSessions = await readChannelSessions(account, property, name, row.values.sessions, row.observedAt);
      } catch {
        // Public measurements and the independently observed engagement metric remain available.
      }
    }
    rows.push(row);
  }
  console.log(JSON.stringify({schemaVersion: 1, source: "ga4", observedAt: new Date().toISOString(), rows}));
} finally {
  await task.finish({keep: []});
}
