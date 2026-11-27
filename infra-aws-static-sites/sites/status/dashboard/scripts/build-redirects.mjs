import { mkdir, writeFile } from 'node:fs/promises';

// Retired URLs remain bookmarks into the single Status dashboard.
const page = (view, title) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Status</title><meta http-equiv="refresh" content="0;url=/#${view}"><script>location.replace('/#${view}')</script></head><body><a href="/#${view}">Status ${title} 열기</a></body></html>
`;
const dist = new URL('../../dist/', import.meta.url);
await mkdir(new URL('agents/', dist), { recursive: true });
await writeFile(new URL('agents/index.html', dist), page('agents', '에이전트'));
await writeFile(new URL('agents.html', dist), page('agents', '에이전트'));
await writeFile(new URL('office.html', dist), page('office', '사무실'));
