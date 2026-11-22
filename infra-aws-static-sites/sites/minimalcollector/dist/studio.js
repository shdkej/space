const drawers = [
  ['물건', 'Objects', [
    ['TS 502', '리처드 사퍼와 마르코 차누소가 만든 접이식 라디오. 닫으면 손잡이 하나 달린 상자가 된다.'],
    ['여행지 마그넷', '여행을 다녀온 뒤에도 손바닥만 한 크기로 남는 장소.']
  ]],
  ['공간', 'Spaces', [
    ['라우렌치아나 도서관', '피렌체. 넓어졌다 좁아지는 돌계단 끝에서 하나의 문을 만난다.'],
    ['흰 스튜디오', '아직 채우지 않은 자리. 오늘 꺼낸 물건 하나를 놓을 수 있는 공간.']
  ]],
  ['사람', 'People', [
    ['디터 람스', '제품 앞에서 무엇을 더 덜어낼 수 있을지 생각하게 하는 디자이너.'],
    ['알바로 시자', '흰 벽에 난 창 하나로 빛과 풍경을 들이는 건축가.']
  ]],
  ['기록', 'Notes', [
    ['수집 노트', '물건 이름 옆에, 오래 눈이 간 이유를 한 줄 남겨 두는 곳.'],
    ['글쓰기', '흩어진 메모를 다시 읽고 한 편의 글로 묶는 일.']
  ]],
  ['만드는 일', 'Making', [
    ['디자인', '무엇을 먼저 보게 하고 어떤 자리를 비워 둘지 정하는 일.'],
    ['개발', '그 결정을 손으로 열고 움직일 수 있는 작은 도구로 만드는 일.']
  ]]
];
const cabinet = document.querySelector('.cabinet');
function element(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  if (value) node.textContent = value;
  return node;
}
for (const [index, [name, english, items]] of drawers.entries()) {
  const row = element('section', 'row');
  row.setAttribute('aria-label', name + ' 서랍');
  row.tabIndex = 0;
  const tray = element('div', 'tray');
  const handle = element('button', 'handle');
  const plate = element('span', 'plate');
  const sub = element('small', '', english);
  sub.lang = 'en';
  plate.append(element('b', '', name), sub);
  handle.append(plate, element('span', 'grip'));
  const contents = element('div', 'contents');
  contents.id = 'drawer-' + index;
  handle.setAttribute('aria-controls', contents.id);
  for (const [title, body] of items) {
    const card = element('article', 'card');
    card.append(element('h2', '', title), element('p', '', body));
    contents.append(card);
  }
  tray.append(handle, contents);
  row.append(element('div', 'clearance'), tray);
  cabinet.append(row);
  const behavior = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  const sync = () => {
    const opened = row.scrollLeft > 30;
    handle.setAttribute('aria-expanded', String(opened));
    handle.setAttribute('aria-label', name + ' 서랍 ' + (opened ? '닫기' : '열기'));
  };
  sync();
  row.addEventListener('scroll', sync, {passive:true});
  handle.addEventListener('click', () => row.scrollTo({
    left: row.scrollLeft > 30 ? 0 : Math.min(row.scrollWidth - row.clientWidth, row.clientWidth * .73),
    behavior: behavior()
  }));
  row.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const x = { Home:0, End:row.scrollWidth, ArrowLeft:row.scrollLeft - 220, ArrowRight:row.scrollLeft + 220 }[event.key];
    row.scrollTo({left:x, behavior:behavior()});
  });
  let drag;
  row.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button === 0 && e.target.closest('.tray') && !e.target.closest('button')) {
      drag = {start:e.clientX, left:row.scrollLeft};
      row.setPointerCapture(e.pointerId);
    }
  });
  row.addEventListener('pointermove', e => {
    if (drag) row.scrollLeft = drag.left + drag.start - e.clientX;
  });
  row.addEventListener('lostpointercapture', () => { drag = null; });
}
