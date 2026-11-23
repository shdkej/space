const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.resolve(__dirname, '../dist');
const origin = 'https://policy.minimalcollector.com';
const brand = '모두의정책';
const read = file => fs.readFileSync(path.join(dist, file), 'utf8');
const { policies, timelines } = vm.runInNewContext(read('data.js') + '\n;({ policies: POLICY_DATA, timelines: POLICY_TIMELINES })');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
const route = p => '/policies/' + p.id + '.html';
function link(url, label) {
  const external = new URL(url, origin).origin !== origin;
  const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return '<a href="' + escape(url) + '"' + attributes + '>' + escape(label) + '</a>';
}
const urls = [];

function save(file, content) {
  const dest = path.join(dist, file);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(dest) || read(file) !== content) throw new Error('Regenerate with npm run search:build: ' + file);
    return;
  }
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, content);
}

function head(url, title, description, type, citations = []) {
  const full = origin + url;
  urls.push(full);
  const website = {'@type':'WebSite', '@id':origin + '/#website', url:origin + '/', name:brand, inLanguage:'ko'};
  const page = {'@type':type, '@id':full + '#page', url:full, name:title, description, inLanguage:'ko', isPartOf:{'@id':website['@id']}};
  if (citations.length) page.citation = [...new Set(citations)];
  const json = JSON.stringify({'@context':'https://schema.org', '@graph':[website,page]}).replace(/</g,'\\u003c');
  return [
    '<title>' + escape(title) + '</title>',
    '<meta name="description" content="' + escape(description) + '">',
    '<link rel="canonical" href="' + full + '">',
    ...Object.entries({'og:type':'website','og:locale':'ko_KR','og:site_name':brand,'og:url':full,'og:title':title,'og:description':description}).map(([key,value]) => '<meta property="' + key + '" content="' + escape(value) + '">'),
    '<script type="application/ld+json">' + json + '</script>'
  ].join('\n');
}

function marked(html, name, content) {
  const start = '<!-- ' + name + ' -->', end = '<!-- /' + name + ' -->';
  const first = html.indexOf(start), last = html.indexOf(end);
  if (first < 0 || last <= first) throw new Error('Missing markers: ' + name);
  return html.slice(0, first) + start + '\n' + content + '\n' + html.slice(last);
}

const pages = [
  ['index.html','/', '모두의정책 | 정책 공약·시행과 변경 이력', '아동수당, 청년기본소득 등 정책 10건이 처음 발표된 뒤 어떻게 달라졌는지 살펴보세요. 시점별 출처와 대한민국 국가기관의 역할을 확인할 수 있습니다.', 'CollectionPage'],
  ['sources.html','/sources.html','정책별 기록과 자료 출처 | 모두의정책','정책 10건의 발표 당시 단계와 변경 이력을 확인하고, 각 기록의 근거가 된 법령·기관 자료·관련 보도를 찾아보세요.', 'CollectionPage'],
  ['birth-grant-map.html','/birth-grant-map.html','지역별 출산지원금 지도 | 모두의정책','아이사랑 게시물을 바탕으로 지역별 출산지원금의 금액과 조건을 살펴보고, 신청 전 확인할 원문을 찾아보세요.', 'WebPage'],
  ['privacy.html','/privacy.html','개인정보 처리방침 | 모두의정책','출시 안내 이메일 신청과 선택형 방문 분석에서 처리하는 정보, 보유 기간과 신청 철회 방법을 안내합니다.', 'WebPage']
];
for (const [file,url,title,description,type] of pages) {
  let html = marked(read(file), 'search metadata', head(url,title,description,type));
  if (file === 'sources.html') {
    const sections = policies.map(p => `<section class="source-item">
<h2>${link(route(p), p.policy + ' 변경 이력')} · ${escape(p.name)}</h2>
<p>${escape([p.party,p.year,p.stage].join(' / '))} (발표 당시 기준)</p>
<p>${link(p.source,p.sourceLabel)} · ${link(p.news,'관련 뉴스')} · ${link('https://www.law.go.kr/LSW/unSc.do?query='+encodeURIComponent(p.law),'관련 법령 검색: '+p.law)}</p>
${p.sourceNote ? '<p>'+escape(p.sourceNote)+'</p>' : ''}</section>`);
    html = marked(html, 'policy source index', sections.join('\n'));
  }
  save(file, html);
}

for (const p of policies) {
  const events = timelines[p.id];
  const last = events.filter(e => !e.scheduled).at(-1);
  const description = last.changeSinceFirst || last.summary || last.label;
  const title = p.policy + ' 변경 이력 | ' + brand;
  const records = events.map(e => `<li><strong>${escape(e.date)} · ${escape(e.title || '정책 기록')}</strong>${e.scheduled ? ' (' + escape(e.scheduleKind || '시행 예정') + ')' : ''}
<p>${escape(e.label)} ${link(e.url,'이 기록의 출처 ↗')}</p></li>`).join('\n');
  save(route(p).slice(1), `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${head(route(p), title, description, 'WebPage', events.map(e => e.url))}
<link rel="stylesheet" href="/index.css"><script src="/domain-move.js"></script></head>
<body><main class="source-page">
<nav aria-label="탐색">${link('/',brand)} · ${link('/sources.html','정책별 기록과 자료 출처')}</nav>
<h1>${escape(p.policy)} 변경 이력</h1>
<p>${escape([p.name,p.party,p.year,p.stage].join(' / '))} (발표 당시 기준)</p>
<h2>처음 발표된 뒤 무엇이 달라졌나요?</h2>
<p>${escape(last.date)} 기록 기준 · ${escape(description)}</p>
<h2>시점별 기록과 출처</h2>
<ol>${records}</ol>
${p.sourceNote ? '<p>'+escape(p.sourceNote)+'</p>' : ''}
</main></body></html>\n`);
}
save('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(url => '  <url><loc>' + escape(url) + '</loc></url>').join('\n') + '\n</urlset>\n');
