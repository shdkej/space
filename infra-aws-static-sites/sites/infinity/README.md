# Infinity dashboard

Infinity의 `Inbox / Active / Waiting / Archive` 원장을 읽는 정적 대시보드입니다. 화면은 실행 상태를 바꾸지 않으며, 원격 `main`의 `INTENTS.md`와 `GATES.md`를 읽어 표시합니다.

## 사용자 경험

- 상태가 바뀐 레인만 다시 그립니다. 동일한 자동 새로고침 결과는 기존 카드 DOM을 유지합니다.
- Archive 카드의 상세 원장 보강은 백그라운드에서 수집한 뒤 한 번만 반영합니다. 항목마다 레인을 다시 그리지 않습니다.
- 자동 새로고침 중에도 기존 카드는 남겨 두고 상태 표시에만 `동기화 중...`을 보여줍니다.

## 파일과 데이터 경계

- `dist/index.html` — 배포되는 단일 정적 대시보드
- Infinity `INTENTS.md`, `GATES.md` — 상태의 정본
- Infinity `intents/archive/` — Archive 카드의 상세 보강 입력
- Agent Wiki의 `knowledge-loop.json`, `promotion-index.json` — 지식 흐름 모달 입력

## 검증과 배포

1. `dist/index.html`의 인라인 스크립트 문법을 확인합니다.
2. 모바일(390px)과 데스크톱에서 자동 새로고침 전후 카드가 유지되는지 확인합니다.
3. Space 저장소에서 이 경로만 커밋·push하고, `https://infinity.aws.shdkej.com`의 실제 동작을 확인합니다.

## 한계

- GitHub raw/API의 캐시와 rate limit 때문에 원격 반영은 즉시 보이지 않을 수 있습니다.
- 이 대시보드는 원격 원장을 읽기만 합니다. 작업 상태 전환은 Infinity dispatcher가 소유합니다.
