// Run inside the signed-in Ego Lite browser with "ego-browser nodejs".
const task = await taskSpace("Instagram account insights for the status dashboard");
try {
  const page = task.page("p1");
  await page.goto("https://www.instagram.com/accounts/insights/?timeframe=7");
  await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("총 팔로워"),
    undefined, { timeout: 20000 });
  const row = await page.evaluate(() => {
    const text = document.querySelector("main").innerText;
    if (!document.querySelector('a[href="/minimal_collector/"]') ||
        !text.includes("최근 7일") || new URL(location.href).searchParams.get("timeframe") !== "7")
      throw Error("Instagram 계정 또는 집계 기간이 다릅니다.");
    const count = pattern => {
      const match = text.match(pattern);
      if (!match) throw Error("Insights 화면에서 지표를 읽을 수 없습니다.");
      return Number(match[1].replaceAll(",", ""));
    };
    return {
      scope: "minimal_collector", status: "ok", method: "Instagram 프로페셔널 대시보드",
      observedAt: new Date().toISOString(), periodLabel: "최근 7일 (Instagram 표시 기준)",
      values: {
        views: count(/조회수\n([\d,]+)\n조회수/), viewers: count(/조회한 사람\n([\d,]+)/),
        interactions: count(/반응\n([\d,]+)\n반응/), profileVisits: count(/프로필 방문\n([\d,]+)/),
        followers: count(/팔로워\n([\d,]+)\n총 팔로워/)
      }
    };
  });
  console.log(JSON.stringify({ schemaVersion: 1, source: "instagram", observedAt: row.observedAt, rows: [row] }));
} finally {
  await task.finish({keep: []});
}
