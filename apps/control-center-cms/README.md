# Control Center CMS

## 목적

운영 상태와 콘텐츠 관리 화면을 한 곳에서 제공하는 Next.js 앱입니다. System 탭은 수집기가 저장한 시스템 스냅샷을 읽어 Infinity 작업 흐름과 에이전트 운영 상태를 보여 줍니다.

## 사용자 문제와 핵심 기능

- 크론·인텐트·백로그·산출물 상태를 한 화면에서 확인합니다.
- Infinity Backlog 후보에 **등록 이유**, **다음 행동**, **근거 경로 수**를 함께 표시해 왜 태스크가 생겼고 무엇을 판단해야 하는지 알 수 있습니다.
- 제한된 크론 켜기/끄기와 수집기 즉시 실행 요청을 액션 큐에 기록합니다.

## 실행·개발

```bash
pnpm install
pnpm dev
```

기본 포트는 `3000`이며 `PORT` 환경변수로 변경할 수 있습니다.

## 데이터·외부 의존성

- Supabase `system_snapshots`, `system_actions`, `control_center_*` 테이블
- 로컬 수집기 `/home/ubuntu/workspace/system-dashboard/collector/`
- 기본 인증 미들웨어와 Supabase service key 환경변수

## 테스트·배포

```bash
pnpm build
```

Space 저장소의 배포 선언(`deployment.yaml`, `service.yaml`, `ingress.yaml`)을 통해 배포하며, 변경 후 라이브 System 탭에서 실제 스냅샷과 카드 렌더를 확인합니다.

## 알려진 한계

화면은 최신 Supabase 스냅샷만 읽으므로 수집기 실행 주기만큼 지연될 수 있습니다. 카드의 등록 이유와 다음 행동은 원장에 값이 있을 때 표시되며, 값이 없는 레거시 일반 인텐트는 제목과 진행 정보만 표시됩니다.
