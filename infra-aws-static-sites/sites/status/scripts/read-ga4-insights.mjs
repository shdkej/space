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

try {
  for (const [scope, account, property, name] of properties) {
    try {
      await page.goto("about:blank");
      const path = "/a" + account + "p" + property + "/reports/intelligenthome";
      await page.goto("https://analytics.google.com/analytics/web/#" + path);
      await page.waitForFunction(([route, name]) =>
        location.hash.includes(route) && [...document.querySelectorAll('button')].some(b =>
          b.getAttribute("aria-label") === "범용 선택 도구 열기" && b.innerText.includes(name)) &&
        document.querySelectorAll('[role="tab"]').length >= 4 &&
        [...document.querySelectorAll('button,[role="combobox"]')].some(b =>
          b.getAttribute("aria-label") === "기간 선택 도구 열기" && b.innerText.includes("지난 7일")),
        [path, name], {timeout: 25000});
      await selectMetric("새 사용자 수", "세션수");
      await selectMetric("세션수", "새 사용자 수");
      const newUsers = await readTab("새 사용자 수");
      const sessions = await readTab("세션수");
      if (newUsers === null || sessions === null || !(await page.url()).includes(path))
        throw Error("GA4 selection changed");
      rows.push({scope, status: "ok", method: "GA4 홈 · Egolite",
        observedAt: new Date().toISOString(), periodLabel: "지난 7일 (GA4 속성 기준)",
        values: {newUsers, sessions}});
    } catch {
      rows.push({scope, status: "unavailable"});
    }
  }
  console.log(JSON.stringify({schemaVersion: 1, source: "ga4", observedAt: new Date().toISOString(), rows}));
} finally {
  await task.finish({keep: []});
}
