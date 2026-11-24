# 에이전트 지표 지도 운영

운영 URL: `https://metrics.oracle.shdkej.com/`. 4개 조직층 × 각 8칸에서 기준·목적·측정 정의를 편집하고, 자연어 AI 제안과 연결한 데이터의 실측을 봅니다.

소스·테스트·Dockerfile·개발 방법은 비공개 독립 저장소 `shdkej/agent-metrics`와 `/home/ubuntu/workspace/apps/agent-metrics/README.md`가 소유합니다. Space는 이 폴더의 Deployment/Service/Ingress와 `argocd/apps/agent-metrics.yaml`만 소유합니다. 미게시 Sites 초안이나 Space 내부 소스 복사본은 배포에 사용하지 않습니다.

## 배포와 확인

1. 소스 테스트·브라우저 검증 후 main push. GitHub Actions가 source SHA의 arm64 이미지를 GHCR와 비공개 OCI artifact로 함께 만듭니다.
2. 이미지 빌드 성공과 SHA를 확인하고 소스의 `scripts/import-image.sh <Actions run ID> <source SHA>`를 실행합니다. 현재 클러스터에는 비공개 GHCR pull 자격증명이 없으므로, 인증된 Actions artifact의 **동일 이미지**를 oracle-arm-1의 containerd에 가져옵니다. 임시 importer Pod는 종료 후 삭제합니다. `IfNotPresent`이므로 노드 이미지가 제거되면 재가져오기가 필요합니다. 새로 빌드하거나 소스·이미지를 공개하지 않습니다.
3. `deployment.yaml`의 두 이미지 참조를 갱신합니다. 세 앱 manifest와 Argo Application을 `kubectl apply --dry-run=server`로 확인하고 Space main에 push합니다.
4. Argo sync가 정상이라면 해당 revision까지 기다립니다. 2026-11-14 현재 다른 비공개 서브모듈 system-dashboard의 인증 오류로 Space repo의 manifest 생성이 막혀 있습니다. 같은 원격 manifest만 대상으로 직접 apply하며 전역 Argo 설정은 바꾸지 않습니다.
5. rollout Ready, 실행 imageID, HTTPS 인증, `/api/health`의 source revision, 실제 브라우저 저장·재열기·AI 제안·수치 조회를 확인합니다. Pod 교체 후 SQLite 값 보존도 확인합니다.

첫 배포는 사용자의 “배포는 space에서 참고해서” 지시에 포함됩니다. 이후 배포도 해당 요청의 승인 범위를 확인합니다.

## 인증·데이터·복구

- `agent-metrics-basic-auth/auth`는 기존 Reel Room Basic Auth 해시를 복사한 별도 Secret입니다. 앱 서버에서 검증하고 nginx는 TLS·프록시를 담당합니다. nginx Basic Auth를 중복 설정하면 Authorization 헤더를 지우므로 이 앱의 Ingress에는 auth-type을 두지 않습니다. 미인증 화면·데이터 API는 401이며 `/api/health`는 상태·소스 revision만 공개합니다. 사용자명별 지도·연결·관측을 분리합니다. 기존 Reel Room Secret은 수정하지 않습니다. 비밀번호 변경은 두 앱의 별도 Secret에 각각 반영해야 합니다.
- `agent-metrics-env`에는 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_AI_API_TOKEN`, `DATA_ENCRYPTION_KEY`만 보관합니다. 실제 값은 Git·브라우저·로그에 넣지 않습니다.
- 데이터는 oracle-arm-1 `/var/lib/agent-metrics`에 영구 저장합니다. Pod의 `/data`에 마운트하고 Node uid1000으로 실행합니다. 단일 Pod/Recreate 방식입니다.
- 백업은 SQLite `.backup`으로 일관된 DB를 만들고 암호화 키 Secret을 별도로 보존합니다. 실행 중인 SQLite 파일만 복사하지 않습니다. 자동 백업·장애 복제는 아직 없습니다.
- 되돌릴 때 직전 검증 image SHA의 OCI artifact를 가져온 후 Deployment의 이미지 두 곳을 되돌립니다. 데이터 볼륨과 Secret은 보존합니다. 최초 배포에는 이전 앱 revision이 없으므로 필요 시 replicas0으로 서비스만 중단합니다.
- 실제 Instagram 조회는 사용자가 프로페셔널 계정 ID·Insights 권한 토큰을 연결해야 합니다. 이번 배포에서는 실계정 조회를 검증하지 않았습니다. 수치는 버튼으로 조회하며 예약 수집은 없습니다.

## 검증 기록

초기 소스: `b19582f` (정확한 전체 SHA는 deployment.yaml). 테스트 16개, 실제 AI 응답, 320/390/768/1440px 화면, 수동 0·공개 JSON 실측·연결 중 초안 보존·동시 저장 충돌 복구를 사전 확인했습니다. 라이브 결과는 배포 후 아래에 추가합니다.

### 2026-11-14 라이브 확인

- 이미지 빌드: [Actions 43567794759](https://github.com/shdkej/agent-metrics/actions/runs/43567794759) 성공. 실행 source `b19582f8b6ccacce4ef0915073db1c925d99b29a`, OCI manifest `sha256:97d59acf4f02239834d6c96bbd33eb6f76b122ee0110c64bf662343ccc1ffe79`. Pod imageID(config digest)는 `sha256:4718066665773e3f4c7245b7e6e4031683b256ce05a5918d6929ea63aeca9855`다.
- 배포 revision **3**, ready **1**, oracle-arm-1. TLS 발급 완료. 미인증 화면·데이터 API 401, 공개 health의 source revision 일치를 확인했다. nginx의 Basic Auth가 Authorization 헤더를 제거하는 현상은 해당 Ingress의 중복 인증 설정을 제거하여 해결했다. 앱의 Basic Auth 검증은 유지한다.
- 운영 Chromium 320/390/768/1440px에서 넘침·JS 오류 없음. 기준·지표 저장/재열기, 수동 0, 공개 JSON 실측 600, 연결 중 초안 보존, 다른 탭 변경과 명시적 충돌 복구를 확인했다. Pod 교체 후 정의·관측·연결도 유지됐다.
- 운영 AI 실응답은 ‘인스타그램 조회수’, `views`, 후행, 7일, 매주를 반환했다. 인스타 미연결 상태는 유지하며 실제 계정 수치를 검증했다고 보고하지 않는다.
- 별도 검증 계정의 지도·연결·관측을 삭제했고 인증 해시를 기존 계정만 남도록 복구했다. 재시작 후 임시 계정의 401과 원본 Reel Room 인증 해시 일치를 확인했다. 원본 Reel Room Secret은 변경하지 않았다.
- 소스의 `docs/verification.json`이 검증 요약이다. 후속 테스트 스크립트·기록 commit은 실행 이미지와 구분한다. Argo `ComparisonError`는 기존 Space 서브모듈 문제로 남아 있으며 이번 앱은 원격 manifest `2568455`와 동일하게 적용했다.

### 사용자 가이드 추가 (2026-11-14)

사용 안내는 `https://metrics.oracle.shdkej.com/guide.html`이며 앱 상단 ‘사용 가이드’(모바일 책 아이콘)에서 연다. 정본은 소스 `public/guide.html`과 `guide.css`다. 제품층에서 첫 지표 설정, 기준과 지표의 차이, AI 적용/저장, 인스타 예시, 데이터 소스 조건, 상태 해석과 문제 해결을 안내한다. 자동 수집·알림·다음 행동 실행이 없는 현재 기능 경계도 설명한다. README는 안내 진입점을 연결하며 본문을 중복 관리하지 않는다.

변경 source `5cb7a59fa3d4f8b650b5c9c86d0c616c15458355`. 테스트 16개·build, 320/390/768/1440px 지도→가이드→지도 이동과 목차/접기/넘침을 검증했다. 복구 이미지는 최초 배포 source `b19582f8b6ccacce4ef0915073db1c925d99b29a`다. 데이터 모델·저장·인증·AI·수집기는 변경하지 않는다.

가이드 배포 확인: [Actions 43583529867](https://github.com/shdkej/agent-metrics/actions/runs/43583529867) 성공, 운영 revision **4**/ready **1**. 외부 health의 source SHA 일치, 운영 이미지에서 guide HTTP 200과 검증한 HTML의 SHA256 일치, 외부 가이드 URL의 미인증 401을 확인했다. 로컬 실제 브라우저의 4개 너비 렌더·이동 검증과 운영 파일 검증을 구분한다. 배포 전후 기존 지도·연결·관측의 행 수와 내용 해시가 동일하다.

### 2026-11-24 앱별 분석 연동

소스 `f2908387509f6b2b2d4d504f33a813b219122d3c`, Actions `45357369641`의 arm64 이미지를 가져와 배포했습니다. Space manifest는 `814a045`, 배포 revision 5, Ready 1이고 외부 health의 source revision이 일치했습니다. 배포 전 이미지는 `5cb7a59fa3d4f8b650b5c9c86d0c616c15458355`입니다.

Status 릴리스 `44e7a4f`의 Monitoring 화면과 Metrics 운영 Pod의 조회 코드가 같은 공개 집계 3개를 읽었습니다. PostHog 앱/호스트 5개 및 미지정, GA4 속성 4개, Instagram 계정 1개입니다. 운영 Metrics 데이터 API는 인증 없는 요청에 401을 반환했습니다. 원천 수집·범위·게시 명령은 [Status README](../../infra-aws-static-sites/sites/status/README.md)에 있습니다.

실행 기록은 부모 `/root`와 종료된 임시 역할 `/root/planner`, `/root/developer`, `/root/marketer`, `/root/operator`입니다. 범위·구현·지표 정의·배포를 각자 검토한 뒤 공개 집계와 사용자별 연결의 분리, 원천의 관측 시각, 앱 식별 방법을 대조했습니다. 프로젝트 안에 여러 앱이 있는 것을 직접 확인해 앱 ID와 서비스 호스트를 우선순위대로 적용했습니다.

### 2026-11-24 기존 지표 연결 및 자동 갱신

Metrics 이미지 `fd96aab453981ca5b0c7a7adf0975021faf4ee46` (Actions `45398113599`)를 Space manifest `41b0edd`로 배포했습니다. 고객실 ‘유입 확인’에 이미 저장된 ‘인스타그램 조회수’ 정의의 소스를 `analytics:instagram:minimal_collector`로 연결했습니다. 운영 DB에서 해당 칸의 `views`, 7일, 단위 ‘회’, 0회 관측 및 원천 시각을 재확인했습니다. Status `d5d2e14`는 4개 그룹 32개 행으로 표시되며, 390·1440px에서 고객 신규 사용자/세션 각 4속성과 제품 세션 6범주를 확인했습니다.

SAM-PC의 Windows 예약 작업 `Status Metrics Analytics Refresh`는 매일 10:15 KST에 실행됩니다. 21:55 KST에 같은 예약 작업을 호출해 종료 코드 0, 원천 3개 11행 모두 성공, 다음 실행 11월 25일 10:15를 확인했습니다. 수집기 릴리스는 `f7d856b`입니다. 로그인된 Windows 사용자와 Egolite 인증이 필요합니다. 예약 작업이 실패하면 재시도 설정과 [Status 운영 절차](../../infra-aws-static-sites/sites/status/README.md)를 확인합니다.

임시 역할 `autoplanner`, `autodev`, `automarketer`, `autooperator`의 검토를 통합해 수집 기간, 지표 의미, 데이터 소스 연결, Windows 로그인 조건을 대조했습니다. 부모는 운영 지표 바인딩과 배포 revision, 예약 작업의 종료 코드, 공개 피드 및 렌더를 직접 확인했습니다.

### 2026-11-24 데이터 연결 창

지도에서 ‘데이터 연결’을 열어 PostHog 앱 또는 GA4 속성, 측정 항목과 대상 칸을 선택한 뒤 기존 편집기에서 ‘지도에 저장’합니다. 편집 중에 열면 현재 칸과 초안을 사용합니다. 검증용 지도에서 GA4 blog 신규 사용자와 PostHog Infinity 고유 세션을 각각 저장하고 재조회했습니다. 브라우저에서 Instagram 계정 입력, PostHog·GA4 선택, JSON 연결과 초안 보존을 검증했습니다.

운영 이미지 `56d8b77`, Actions `45400065811`, manifest `a9c2bd3`의 rollout과 외부 health revision 일치를 확인했습니다. 배포 전후 운영 지도의 내용과 버전 해시가 동일했습니다. Status 그래프는 `3c3ad72`에서 배포했고 데이터 기간·원천·렌더 확인 기록은 [Status README](../../infra-aws-static-sites/sites/status/README.md)에 있습니다. 부모와 종료된 임시 역할 `connectplan`, `connectdev`, `connectmarket`, `connectops`는 대상 칸 선택·저장 의도, 시계열 단위, 실제 집계 날짜와 운영 검증 경로를 교차 확인했습니다.

### 2026-11-24 달력 기준 집계

Metrics 이미지 `7f70947` (Actions `45401964064`, manifest `fb48188`)를 배포하고 외부 health revision과 대조했습니다. 기존 편집기의 ‘집계 기간’에서 GA4·PostHog의 일간·주간·월간 또는 최근 7일을 선택합니다. 격리된 지도에서 일간 GA4 blog 신규 사용자 0명, 주간 PostHog Infinity 세션 8회를 실제 연결 창으로 저장하고 재조회했습니다. GA4 blog 세션도 공개 피드와 대조해 11월 23일 0회, 11월 16~22일 10회, 10월 43회를 확인했습니다. Status 그래프 릴리스는 `3ee65a4`입니다.

수집기 릴리스 `86bde0d`를 설치하고 기존 Windows 예약 작업을 22:28 KST에 실행했습니다. 종료 코드 0, 다음 예약 11월 25일 10:15 KST입니다. GA4 4속성의 52개 구간과 PostHog 6범주의 78개 구간을 확인했습니다. 390·1440px 운영 그래프에 표시된 일·주·월 점의 수가 각 피드와 일치했습니다. GA4 blog와 afzma는 Data API와 Egolite의 구간별 두 지표가 모두 일치했습니다. 부모와 임시 역할 `periodcollector`, `periodmarket`, `periodui`, `periodbrowser`가 수집 기간 경계, 기존 그래프 호환성, 데이터 원천을 대조했습니다.
