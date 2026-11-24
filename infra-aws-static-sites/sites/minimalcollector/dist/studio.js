const drawers = [
  ['물건', 'Objects', [
    ['TS 502', '리처드 사퍼와 마르코 차누소가 만든 접이식 라디오. 닫으면 손잡이 하나 달린 상자가 된다.'],
    ['여행지 마그넷', '여행을 다녀온 뒤에도 손바닥만 한 크기로 남는 장소.'],
    ["빈티지 의자", "등받이의 기울기, 팔이 닿아 반들반들해진 모서리."],
    ["오뚝이", "한쪽을 툭 밀어 본다. 바닥에 숨은 무게가 몸을 다시 일으킨다."],
    ["매거진 B", "한 브랜드를 한 권에 담은 잡지. 등만 나란히 놓아도 작은 목록이 된다."],
    ["카메라", "프레임의 가장자리에서 무엇을 빼면 사진이 달라질까."],
    ["손잡이", "서랍 전체보다 먼저 손에 닿는 작은 곡면."],
    ["나무 서랍", "옆으로 잡아당기면 닫힌 면이 길고 좁은 진열대가 된다."]
  ]],
  ['공간', 'Spaces', [
    ['라우렌치아나 도서관', '피렌체. 넓어졌다 좁아지는 돌계단 끝에서 하나의 문을 만난다.'],
    ['흰 스튜디오', '아직 채우지 않은 자리. 오늘 꺼낸 물건 하나를 놓을 수 있는 공간.'],
    ["바티칸 도서관", "소장품 하나와 서가 전체를 서로 다른 거리에서 상상해 본다."],
    ["영국도서관", "지도 한 장을 펼쳐 볼 만큼 넓은 책상에 대한 메모."],
    ["생갈렌 수도원 도서관", "나무 서가가 벽과 난간으로 이어지는 도서관."],
    ["뉴욕공립도서관", "긴 열람 테이블 위에 반복되는 독서등을 따라가 본다."],
    ["슈투트가르트 시립도서관", "흰 층계와 서가 사이에서 책등의 색이 또렷해진다."],
    ["책과인쇄박물관", "책 한 권을 종이, 활자, 잉크의 순서로 다시 바라보는 장소."]
  ]],
  ['사람', 'People', [
    ['디터 람스', '제품 앞에서 무엇을 더 덜어낼 수 있을지 생각하게 하는 디자이너.'],
    ['알바로 시자', '흰 벽에 난 창 하나로 빛과 풍경을 들이는 건축가.'],
    ["리처드 사퍼", "작은 라디오에 소리와 손잡이와 경첩을 함께 넣는 방법."],
    ["마르코 차누소", "TS 502를 함께 설계한 사람. 두 껍질이 꼭 맞닿는 선을 따라가 본다."],
    ["미니멀 유목민", "떠날 때 가방에 넣는 것과 두고 가는 것에 관한 관심."],
    ["윤파도", "미니멀을 실천하는 사람을 모은 노트에서 다시 꺼낸 이름."],
    ["anuyk", "같은 취향도 다른 사람의 생활에서는 다른 모습이 된다."],
    ["미켈란젤로", "도서관 문 앞에서 발걸음을 잠시 늦추게 하는 계단을 설계한 사람."]
  ]],
  ['기록', 'Notes', [
    ['수집 노트', '물건 이름 옆에, 오래 눈이 간 이유를 한 줄 남겨 두는 곳.'],
    ['글쓰기', '흩어진 메모를 다시 읽고 한 편의 글로 묶는 일.'],
    ["독서 노트", "책을 덮은 뒤에도 생각나는 한 문장을 적어 두는 자리."],
    ["여행 노트", "같은 길을 다시 찾을 수 있게 장소 이름과 작은 단서를 함께 남긴다."],
    ["영화 노트", "줄거리를 다 옮기기보다 오래 떠오르는 한 장면을 붙잡는다."],
    ["일기", "하루를 떠올릴 때 가장 먼저 보이는 장면부터 쓴다."],
    ["블로그", "메모 여러 장에서 다른 사람과 나눌 만한 이야기 하나를 고른다."],
    ["사진 기록", "같은 장소를 다른 날에 찍어 나란히 놓으면 무엇이 바뀌었는지 보인다."]
  ]],
  ['만드는 일', 'Making', [
    ['디자인', '무엇을 먼저 보게 하고 어떤 자리를 비워 둘지 정하는 일.'],
    ['개발', '그 결정을 손으로 열고 움직일 수 있는 작은 도구로 만드는 일.'],
    ["콘셉트", "여러 장의 스케치를 한 방향으로 모아 주는 첫 문장."],
    ["설계", "손이 닿는 순서대로 종이 위에서 먼저 움직여 본다."],
    ["구도", "화면 모서리에 걸린 것을 빼고 남은 대상의 무게를 본다."],
    ["배치", "두 요소의 순서는 그대로 두고 사이의 거리만 바꿔 본다."],
    ["색감", "같은 나무도 흰 벽 곁에 놓으면 붉은 기가 더 잘 보인다."],
    ["디자인 시스템", "다음 서랍을 더 만들 때도 이름표가 같은 자리에 놓이도록 기준을 남긴다."]
  ]]
];
const cabinet = document.querySelector('.cabinet');
function element(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  if (value) node.textContent = value;
  return node;
}
const viewing = document.querySelector('.viewing');
const imageSubjects = [
  ['주황색 접이식 라디오', '작은 여행 기념 자석', '나무 의자', '둥근 오뚝이', '무지 표지 잡지', '필름 카메라', '나무 손잡이', '작은 목제 서랍'],
  ['돌계단 모형', '흰 스튜디오 모형', '장서가 놓인 서가 모형', '지도와 열람대', '나무 난간과 서가 모형', '독서등과 긴 테이블', '흰 계단과 중정 모형', '인쇄기 모형'],
  ['라디오 다이얼', '창 하나가 난 흰 벽 모형', '검은 관절형 램프', '경첩으로 연결된 두 면', '작은 여행 가방', '접힌 천', '도자기 그릇', '부채꼴 계단 모형'],
  ['색인 상자', '만년필과 종이', '책갈피가 꽂힌 책', '지도와 수첩', '필름 조각', '천 표지 일기장', '교정지', '흑백 인화 사진'],
  ['재료 견본', '회로 기판', '연필 스케치', '설계 도면과 자', '나무 도형', '종이 배치 모형', '색상 견본', '나무 모듈']
];
const studyTypes = ['형태 습작','공간 모형','인물에서 연상한 정물','기록 도구 습작','제작 습작'];
const imagePath = (group, item) => 'exhibits/' + drawers[group][1].toLowerCase() + '-' + (item + 1) + '.webp';
let currentGroup;
let currentItem;
function showPiece(group, item) {
  currentGroup = group;
  currentItem = item;
  const [name, , items] = drawers[group];
  const img = viewing.querySelector('img');
  img.src = imagePath(group, item);
  img.alt = imageSubjects[group][item];
  viewing.querySelector('.category').textContent = name + ' / ' + studyTypes[group] + ' · AI 이미지';
  viewing.querySelector('h2').textContent = items[item][0];
  viewing.querySelector('.description').textContent = items[item][1];
  viewing.querySelector('.position').textContent = (item + 1) + ' / ' + items.length;
  viewing.querySelector('.previous').disabled = item === 0;
  viewing.querySelector('.next').disabled = item === items.length - 1;
  if (!viewing.open) viewing.showModal();
}
function stepPiece(delta) {
  const next = currentItem + delta;
  if (next >= 0 && next < drawers[currentGroup][2].length) showPiece(currentGroup, next);
}
viewing.querySelector('.close-view').onclick = () => viewing.close();
viewing.querySelector('.previous').onclick = () => stepPiece(-1);
viewing.querySelector('.next').onclick = () => stepPiece(1);
viewing.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    stepPiece(e.key === 'ArrowLeft' ? -1 : 1);
  }
});
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
  for (const [item, [title]] of items.entries()) {
    const card = element('article', 'card');
    const button = element('button', 'piece');
    button.type = 'button';
    button.setAttribute('aria-label', title + ' 작품 감상');
    button.setAttribute('aria-haspopup', 'dialog');
    const img = element('img', 'study');
    img.alt = imageSubjects[index][item];
    img.draggable = false;
    img.loading = 'lazy';
    img.dataset.src = imagePath(index, item);
    const caption = element('span', 'caption');
    caption.append(element('strong', '', title), element('small', '', studyTypes[index]));
    button.append(img, caption);
    button.onclick = () => showPiece(index, item);
    card.append(button);
    contents.append(card);
  }
  tray.append(handle, contents);
  row.append(element('div', 'clearance'), tray);
  cabinet.append(row);
  const behavior = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  const sync = () => {
    const opened = row.scrollLeft > 30;
    contents.inert = !opened;
    if (opened && !contents.dataset.loaded) {
      contents.querySelectorAll('img').forEach(img => { img.src = img.dataset.src; });
      contents.dataset.loaded = 'true';
    }
    handle.setAttribute('aria-expanded', String(opened));
    handle.setAttribute('aria-label', name + ' 서랍 ' + (opened ? '닫기' : '열기'));
  };
  sync();
  row.addEventListener('scroll', sync, {passive:true});
  handle.addEventListener('click', () => row.scrollTo({
    left: row.scrollLeft > 30 ? 0 : Math.min(row.scrollWidth - row.clientWidth, row.clientWidth - handle.offsetWidth),
    behavior: behavior()
  }));
  row.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const x = { Home:0, End:row.scrollWidth, ArrowLeft:row.scrollLeft - 220, ArrowRight:row.scrollLeft + 220 }[event.key];
    row.scrollTo({left:x, behavior:behavior()});
  });
  let drag;
  let suppressClick = false;
  row.addEventListener('pointerdown', e => {
    suppressClick = false;
    if (e.pointerType === 'mouse' && e.button === 0 && e.target.closest('.tray')) {
      drag = {start:e.clientX, left:row.scrollLeft};
    }
  });
  row.addEventListener('pointermove', e => {
    if (!drag || !e.buttons) { drag = null; return; }
    const delta = drag.start - e.clientX;
    if (!suppressClick && Math.abs(delta) < 5) return;
    suppressClick = true;
    row.setPointerCapture(e.pointerId);
    row.scrollLeft = drag.left + delta;
  });
  row.addEventListener('click', e => {
    if (suppressClick && e.detail) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    }
  }, true);
  row.addEventListener('pointerup', () => { drag = null; });
  row.addEventListener('pointercancel', () => { drag = null; });
}
