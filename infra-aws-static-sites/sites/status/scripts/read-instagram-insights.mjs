// Execute with Ego Lite in the signed-in Korean Instagram UI.
const task = await taskSpace("Instagram account insights for the status dashboard");
const page = task.page("p1");
const insightsURL = "https://www.instagram.com/accounts/insights/?timeframe=7";
const privateMode = typeof collectPrivateInstagram !== "undefined" && collectPrivateInstagram;
const accounts = privateMode ? ["minimal_collector", "every.policy"] : ["minimal_collector"];

async function signedInProfile() {
  return page.evaluate(() => {
    const profile = [...document.querySelectorAll('a[href]')].find(a =>
      !a.closest('main') && /^\/[\w.]+\/$/.test(a.getAttribute('href')) &&
      (a.innerText.trim() === '프로필' || a.querySelector('[aria-label="프로필"],img[alt$="프로필 사진"]')));
    return profile?.getAttribute('href').slice(1, -1);
  });
}

async function selectAccount(target) {
  if (await signedInProfile() === target) return true;
  await page.evaluate(() => document.querySelector('svg[aria-label="설정"]').closest('a').click());
  await page.waitForFunction(() => [...document.querySelectorAll('span')].some(e =>
    !e.childElementCount && e.innerText === '계정 전환'), undefined, {timeout: 7000});
  await page.evaluate(() => [...document.querySelectorAll('span')].find(e =>
    !e.childElementCount && e.innerText === '계정 전환').click());
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog && dialog.querySelector('[role="button"] span') && !dialog.querySelector('[role="progressbar"]');
  }, undefined, {timeout: 10000});
  const found = await page.evaluate(target => {
    const entry = [...document.querySelectorAll('[role="dialog"] span')].find(e =>
      !e.childElementCount && e.innerText === target)?.closest('[role="button"]');
    if (!entry) return false;
    entry.click();
    return true;
  }, target);
  if (!found) {
    await page.keyboard.press('Escape');
    return false;
  }
  await page.waitForFunction(target => [...document.querySelectorAll('a[href]')].some(a =>
    !a.closest('main') && a.getAttribute('href') === '/' + target + '/' &&
    (a.innerText.trim() === '프로필' || a.querySelector('[aria-label="프로필"],img[alt$="프로필 사진"]'))), target, {timeout: 18000});
  return true;
}

async function readInsights(scope) {
  await page.goto(insightsURL);
  await page.waitForFunction(() => {
    const text = document.querySelector("main")?.innerText || "";
    return /조회수\n[\d,]+\n조회수/.test(text) && /조회한 사람\n[\d,]+/.test(text);
  }, undefined, {timeout: 22000});
  if (await signedInProfile() !== scope) throw Error("Wrong Instagram profile");
  return page.evaluate(scope => {
    const text = document.querySelector("main").innerText;
    if (!text.includes("최근 7일") || new URL(location.href).searchParams.get("timeframe") !== "7")
      throw Error("Wrong Instagram period");
    const count = pattern => {
      const match = text.match(pattern);
      if (!match) throw Error("Missing Instagram metric");
      return Number(match[1].replaceAll(",", ""));
    };
    const values = {views: count(/조회수\n([\d,]+)\n조회수/), viewers: count(/조회한 사람\n([\d,]+)/)};
    if (scope === "minimal_collector") {
      values.interactions = count(/반응\n([\d,]+)\n반응/);
      values.profileVisits = count(/프로필 방문\n([\d,]+)/);
      values.followers = count(/팔로워\n([\d,]+)\n총 팔로워/);
    }
    return {scope, status: "ok", method: "Instagram 프로페셔널 대시보드",
      observedAt: new Date().toISOString(), periodLabel: "최근 7일 (Instagram 표시 기준)", values};
  }, scope);
}

let original;
try {
  await page.goto(insightsURL);
  await page.waitForFunction(() => document.querySelector('svg[aria-label="설정"]'), undefined, {timeout: 20000});
  original = await signedInProfile();
  if (!original) throw Error("Unable to establish signed-in account");
  const rows = [];
  for (const scope of accounts) {
    try {
      await page.goto(insightsURL);
      await page.waitForFunction(() => document.querySelector('svg[aria-label="설정"]'), undefined, {timeout: 10000});
      if (!await selectAccount(scope)) throw Error("No account access");
      rows.push(await readInsights(scope));
    } catch { rows.push({scope, status: "unavailable"}); }
  }
  const result = {schemaVersion: 1, source: "instagram", observedAt: new Date().toISOString(), rows: [rows[0]]};
  if (privateMode) result.privateAccounts = rows.map(row => row.status === "ok"
    ? {scope: row.scope, status: row.status, observedAt: row.observedAt,
       values: {views: row.values.views, viewers: row.values.viewers}}
    : row);
  if (await signedInProfile() !== original) {
    await page.goto(insightsURL);
    await page.waitForFunction(() => document.querySelector('svg[aria-label="설정"]'), undefined, {timeout: 10000});
    if (!await selectAccount(original) || await signedInProfile() !== original) throw Error("Failed to restore signed-in account");
  }
  console.log(JSON.stringify(result));
} finally {
  await task.finish({keep: []});
}
