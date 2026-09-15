# Infinity dashboard

Infinity의 `Inbox / Active / Waiting / Archive` 원장을 읽는 정적 대시보드입니다. 화면은 실행 상태를 바꾸지 않으며, 원격 `main`의 `INTENTS.md`와 `GATES.md`를 읽어 표시합니다.

## 사용자 경험

- 상태가 바뀐 레인만 다시 그립니다. 동일한 자동 새로고침 결과는 기존 카드 DOM을 유지합니다.
- Archive 카드의 이전 보강값은 새 폴링의 초기 렌더 전에 다시 합칩니다. 같은 상세 원장으로 인한 초기→보강 이중 갱신을 막습니다.
- Archive 카드의 상세 원장 보강은 백그라운드에서 수집한 뒤 한 번만 반영합니다. 항목마다 레인을 다시 그리지 않으며, 일시적 읽기 실패는 다음 폴링에서 재시도합니다.
- 자동 새로고침 중에도 기존 카드는 남겨 두고 상태 표시에만 `동기화 중...`을 보여줍니다.

## 파일과 데이터 경계

- `dist/index.html` — 배포되는 단일 정적 대시보드
- Infinity `INTENTS.md`, `GATES.md` — 상태의 정본
- Infinity `intents/archive/` — Archive 카드의 상세 보강 입력
- Infinity `data/knowledge-loop.json` — 지식 흐름 모달 입력
- Infinity `data/promotion-index.json` — KL 전체 문서의 상태·명시적 Agent Wiki `outputs/` 연결을 담는 반영 맵 입력

## KL 반영 맵

왼쪽 아래 `KL 반영 맵` 플로팅 버튼은 Knowledge Lab의 ingest 문서 전체를 한 화면의 점 필드로 표시합니다. 점 하나는 KL 문서 하나입니다.

- 초록: 실제 Agent Wiki `outputs/` 출처 링크 또는 ingest의 유효 outputs target이 있는 문서(`reflected`)
- 노랑: `selected`지만 아직 유효한 outputs 연결이 없는 문서(`pending_promotion`)
- 회색: 로그·일지·원문 보관처럼 Agent Wiki 승격 대상이 아닌 KL 자료(`not_applicable`)

이 화면의 “반영됨”은 파일명이나 의미 유사도로 추정하지 않고, `promotion-index.json`의 `promotion_targets` 또는 명시적 ingest target이 있을 때만 표시합니다. 읽기 모델은 Knowledge Lab의 `source/openclaw-system/scripts/build_promotion_index.mjs`가 `ingest/manifest.jsonl`, `ingest/INDEX.md`, Agent Wiki `outputs/**/*.mdx`를 대조해 생성합니다.

## 검증과 배포

1. `dist/index.html`의 인라인 스크립트 문법을 확인합니다.
2. 모바일(390px)과 데스크톱에서 자동 새로고침 전후 카드가 유지되고, `KL 반영 맵`에서 점·필터·문서 링크가 동작하는지 확인합니다.
3. Space 저장소에서 이 경로만 커밋·push하고, `https://infinity.aws.shdkej.com`의 실제 동작을 확인합니다.

## 한계

- GitHub raw/API의 캐시와 rate limit 때문에 원격 반영은 즉시 보이지 않을 수 있습니다.
- 이 대시보드는 원격 원장을 읽기만 합니다. 작업 상태 전환은 Infinity dispatcher가 소유합니다.
