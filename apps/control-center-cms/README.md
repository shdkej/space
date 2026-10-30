# Control Center CMS

## 목적

운영 상태와 콘텐츠 관리 화면을 제공하는 Next.js 앱입니다. 상태 구성·Surface Registry·원본 이미지·활동 기록을 관리합니다. System·Flow 요약은 공개 Status 대시보드에서 확인하며, 이 CMS에서는 원본 스냅샷 화면을 노출하지 않습니다. 헤더의 `Status` 링크에서 `https://status.aws.shdkej.com`을 엽니다.

## 사용자 문제와 핵심 기능

- CMS에는 System·Flow 상세 탭을 두지 않습니다. 공개 Status 대시보드가 운영 레이어와 실행 흐름의 집계 상태만 보여 줍니다.
- CMS는 Status 구성, Surface Registry, 원본 이미지, 활동 기록을 관리합니다.
- 공개 Status 상세 화면은 운영 레이어와 역할 관찰 수만 집계합니다. 원본 시스템 스냅샷, 프롬프트, 인텐트 내용, 개별 실행 로그는 CMS에서 공개 Status로 복사하지 않습니다.

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

Space 저장소의 배포 선언(`deployment.yaml`, `service.yaml`, `ingress.yaml`)을 통해 배포합니다. 운영 요약 UI는 `infra-aws-static-sites/sites/status/dashboard/`에서 빌드해 정적 Status 사이트에 배포합니다.

## 알려진 한계

Status 공개 요약은 라이브 피드 갱신 주기만큼 지연될 수 있습니다. 세부 운영 데이터가 필요하면 권한이 있는 운영 경로에서 확인합니다.
