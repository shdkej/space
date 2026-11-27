// Only document navigations use the offline fallback. No runtime data is cached.
const appPaths = new Set(["/", "/add", "/deeds", "/dex", "/me", "/privacy"]);

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin) return;
  if (!appPaths.has(url.pathname.replace(/\/$/, "") || "/")) return;

  event.respondWith(fetch(request, { cache: "no-cache" }).catch(() => new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>오프라인 · 덕 쌓기</title>
    <style>
      :root { color-scheme: light dark; font-family: -apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
      body { margin: 0; min-height: 100svh; display: grid; place-content: center; }
      main { max-width: 25rem; padding: 2rem; } h1 { font-size: 1.5rem; }
      p { line-height: 1.6; } button { margin-top: .5rem; padding: .8rem 1rem; border: 0;
        background: #655584; color: white; border-radius: .75rem; font: inherit; cursor: pointer; }
    </style></head><body><main><h1>지금은 오프라인이에요</h1>
    <p>인터넷에 연결한 뒤 덕 쌓기를 다시 열어 주세요.</p>
    <button type="button" onclick="location.reload()">다시 시도</button></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  )));
});
