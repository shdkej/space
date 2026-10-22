# Status

운영 상태와 콘텐츠 신호를 한 화면에서 확인하는 정적 대시보드입니다.

## 핵심 기능

- 서비스·에이전트·산출물 상태를 모바일 우선으로 표시합니다.
- `Content` 메뉴에서 `minimal_collector` Threads 계정의 최근 글, 조회수, 좋아요 지표를 표시할 수 있는 영역을 제공합니다.
- 검증된 원자료가 없을 때는 수치를 추정하지 않고 `수집 대기`로 표시합니다.

## 실행·개발

React 소스는 `src/`에 있고, `pnpm build`가 정적 산출물을 `dist/`로 만듭니다. 로컬 확인은 `pnpm dev` 또는 빌드 뒤 `python3 -m http.server 8080 --directory dist`로 합니다.

화면은 shadcn/ui의 기본 Card·Badge 패턴과 Radix Tabs를 기준으로 구성합니다. 운영 데이터 계약은 기존 `status.json`과 선택적 `agents-live.json`을 유지하며, Monitoring은 L1 비즈니스부터 L5 리소스까지 라이브 데이터를 그대로 읽습니다.

## 데이터·외부 의존성

- 기본 운영 데이터: `dist/status.json`, 선택적 라이브 데이터: `dist/agents-live.json`
- 콘텐츠 데이터 연결 전까지 `Content` 섹션은 no-data 상태입니다.
- Pretendard는 jsDelivr에서 로드합니다.

## 검증·배포

HTML 정적 문법과 모바일·데스크톱 렌더를 확인한 뒤 Space의 정적 사이트 배포 절차로 반영합니다.

## 알려진 한계

Threads 원자료 수집기와 콘텐츠 데이터 파일은 아직 연결되지 않았습니다. 따라서 현재 콘텐츠 수치는 표시하지 않습니다.
