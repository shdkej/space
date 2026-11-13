# Reel Room 운영

소스·테스트·Dockerfile은 독립 저장소 `/home/ubuntu/workspace/video-automation` (`shdkej/video-automation`, 기본 master)가 소유합니다. 이 폴더는 Kubernetes 배포 선언만 소유합니다. 운영 주소는 `https://reel.oracle.shdkej.com/`, 기존 Basic Auth를 유지합니다.

2026-11-13 통합 스튜디오는 사람 대본 → 키워드/후킹 → 첨부·추천 소재/AI 이미지 후보 → 장면·직접 녹음/AI 음성 → MP4/JPG/SRT 흐름입니다. Instagram Maker의 타이틀·스타일 편집을 스튜디오로 옮기며 기존 자동 컷은 `?mode=cut`로 유지합니다. UI·기능·API 상세는 소스 README와 `docs/STUDIO.md`를 따릅니다.

## 준비와 반영 경계

소스 master push는 GHCR 이미지 빌드입니다. Argo CD는 이 폴더의 `deployment.yaml`, `service.yaml`, `ingress.yaml` 세 파일만 읽습니다. 사용자는 2026-11-13 “ㅇㅇ ㄱㄱ”로 통합 운영 배포·두 기존 주소 전환·실제 AI 검증(이미지 2장·음성 1개·추천 1회)을 승인했습니다. 적용한 배포 선언과 정적 진입 파일이 정본입니다. 준비 패치는 적용 후 제거했으며 Git 이력에서 확인할 수 있습니다.

운영 배포 승인 후:

1. 소스의 pytest·UI build·브라우저/실제 MP4 증거 및 GHCR `:<source SHA>` 빌드 성공을 확인합니다.
2. 현재 배포 image tag/revision을 복구 기록으로 남깁니다.
3. `deployment.yaml`은 source SHA `b5d8b42e49280ff68fc45c078ada23916c8b5efa`를 지정합니다. 해당 이미지 빌드 성공과 manifest diff를 확인합니다. 호스트 경로 `/var/lib/reel-room/studio`를 `/app/web/studio-data`에 마운트합니다. 기존 jobs emptyDir와 음악 hostPath를 유지합니다.
4. 변경 diff·Kubernetes server dry-run을 확인한 뒤 승인 범위에서 Space main commit/push합니다. 정상 Argo CD 동기화는 기존 단일 Pod를 Recreate로 교체합니다. 아래의 현재 동기화 제약이 남아 있으면 원격에 게시한 동일 `deployment.yaml`만 `/usr/local/bin/kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml apply -f apps/reel-room/deployment.yaml`로 적용하고 rollout/imageID를 검증합니다.
5. 인증된 운영 주소의 스튜디오·업로드·저장/재열기·실제 릴스·기존 `?mode=cut`를 확인합니다. 프로젝트가 Pod 재시작 뒤에도 남는지 확인합니다.
6. Instagram Maker의 두 정적 진입(`sites/instagram-maker/dist`, `sites/infinity/dist/instagram-maker`)은 스튜디오 이동 문서를 제공합니다. Infinity의 `dist/instagram-maker.html`은 기존 AWS workflow가 확장자 없는 `/instagram-maker` 객체로도 게시하여 슬래시 없는 주소를 지원합니다. 정적 변경은 별도의 public 사이트 배포이므로 승인 범위를 확인하고 실제 URL 이동을 검증합니다.

## 데이터·비밀·복구

`OPENAI_API_KEY`는 기존 `reel-room-env` Secret을 재사용합니다. 키를 코드·브라우저·Terraform에 저장하지 않습니다. 모델 환경변수와 선택적 `YOUTUBE_API_KEY`는 소스 README를 따릅니다. Commons 검색에는 키가 없습니다.

운영 이미지 모델은 `VIDAUTO_STUDIO_IMAGE_MODEL=gpt-image-1.5`로 명시합니다. 초기 구현의 기본값 gpt-image-1은 종료된 모델이므로 사용하지 않습니다. 계정 모델 목록과 OpenAI 공식 Image API에서 1.5의 지원 및 기존 low·1024×1536·복수 후보 인자를 확인했습니다.

프로젝트/소재/생성 후보/완성 출력은 영구 hostPath에 보존합니다. 자동 삭제하지 않으므로 용량·백업을 관리합니다. 작업자는 oracle-arm-1에 고정되며 노드 이전 시 이 디렉터리도 이전해야 합니다. 기존 영상 작업과 새 렌더는 동시 작업 세마포어를 공유합니다.

문제 시 직전 검증 이미지 SHA로 되돌리고 영구 볼륨은 보존합니다. 구 버전이 스튜디오 데이터를 읽지 않아도 삭제하지 않습니다. `VIDAUTO_UI=legacy`는 이전 정적 화면 복구용이며 통합 스튜디오 운영 진입이 아닙니다. 기존 Instagram Maker 정적 코드는 전환 전까지 유지하며 새로운 기능의 정본으로 수정하지 않습니다.

## 2026-11-13 운영 확인

- 복구 기준: 배포 revision 71, 실제 이미지 `ghcr.io/shdkej/video-automation@sha256:b14727a531e797063e8677883ba09c4e10e528275f9177edb74681ec81cde44c`. 문제가 생기면 이 digest로 Deployment의 image를 되돌리고 영구 studio 볼륨을 보존합니다.
- Argo CD는 2026-11-06부터 Space의 다른 비공개 서브모듈 `system-dashboard`를 인증하지 못해 `ComparisonError`입니다. Reel Room은 그 서브모듈을 사용하지 않습니다. 이번 배포는 같은 Git manifest의 대상 Deployment만 직접 적용하며 전역 Argo 설정·권한은 바꾸지 않습니다. Git 자동 동기화 복구는 별도 운영 과제입니다.
- 운영 키를 사용한 OpenAI 추천·이미지·내레이션 검증은 모두 HTTP 429(사용 한도/요청 빈도)로 실패했습니다. 성공 생성물은 없으며 계정 한도 확인 전 추가 유료 검증을 반복하지 않습니다.
- 사용자 요청으로 유료 AI 실호출 검증을 보류했습니다. 추가 생성 호출 없이 운영 배포·수동 제작·무료 참고 검색·파일 보존 검증을 마무리합니다.
- 첫 이미지의 httpx 직접 의존성 누락은 소스 b5d8b42에서 수정했습니다. OpenAI 2.44.0/httpx 0.28.1을 명시하고 Docker import 검증을 추가했습니다. 새 이미지 빌드 성공 후 교체·최종 보존 검증을 진행하며, 실제 revision은 Infinity `reel-room-studio-20261113`에 기록합니다.
