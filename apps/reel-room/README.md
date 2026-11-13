# Reel Room 운영

소스·테스트·Dockerfile은 독립 저장소 `/home/ubuntu/workspace/video-automation` (`shdkej/video-automation`, 기본 master)가 소유합니다. 이 폴더는 Kubernetes 배포 선언만 소유합니다. 운영 주소는 `https://reel.oracle.shdkej.com/`, 기존 Basic Auth를 유지합니다.

2026-11-13 통합 스튜디오는 사람 대본 → 키워드/후킹 → 첨부·추천 소재/AI 이미지 후보 → 장면·직접 녹음/AI 음성 → MP4/JPG/SRT 흐름입니다. Instagram Maker의 타이틀·스타일 편집을 스튜디오로 옮기며 기존 자동 컷은 `?mode=cut`로 유지합니다. UI·기능·API 상세는 소스 README와 `docs/STUDIO.md`를 따릅니다.

## 준비와 반영 경계

소스 master push는 GHCR 이미지 빌드입니다. Argo CD는 이 폴더의 `deployment.yaml`, `service.yaml`, `ingress.yaml` 세 파일만 읽습니다. 아래의 `studio-release.patch`와 `instagram-entry.patch`는 승인 전 준비 자료이며 자동 적용하지 않습니다.

운영 배포 승인 후:

1. 소스의 pytest·UI build·브라우저/실제 MP4 증거 및 GHCR `:<source SHA>` 빌드 성공을 확인합니다.
2. 현재 배포 image tag/revision을 복구 기록으로 남깁니다.
3. `studio-release.patch`는 검증한 source SHA `a6c01640e17c766287a81ef888e9f58394c7c9c2`를 지정합니다. 해당 이미지 빌드 성공을 확인하고 Space 루트에서 `git apply --check` 후 적용합니다. 호스트 경로 `/var/lib/reel-room/studio`를 `/app/web/studio-data`에 마운트합니다. 기존 jobs emptyDir와 음악 hostPath를 유지합니다.
4. 변경 diff·Kubernetes server dry-run을 확인한 뒤 승인 범위에서 Space main commit/push합니다. Argo CD가 기존 단일 Pod를 Recreate로 교체합니다.
5. 인증된 운영 주소의 스튜디오·업로드·저장/재열기·실제 릴스·기존 `?mode=cut`를 확인합니다. 프로젝트가 Pod 재시작 뒤에도 남는지 확인합니다.
6. 운영 확인 후 Instagram Maker의 두 정적 진입(`sites/instagram-maker/dist`, `sites/infinity/dist/instagram-maker`)을 `instagram-entry.patch`로 스튜디오 링크로 전환합니다. 먼저 `git apply --check`로 현재 내용과 일치하는지 확인합니다. 이 정적 변경은 별도의 public 사이트 배포를 발생시키므로 승인에 포함돼 있어야 합니다.

## 데이터·비밀·복구

`OPENAI_API_KEY`는 기존 `reel-room-env` Secret을 재사용합니다. 키를 코드·브라우저·Terraform에 저장하지 않습니다. 모델 환경변수와 선택적 `YOUTUBE_API_KEY`는 소스 README를 따릅니다. Commons 검색에는 키가 없습니다.

프로젝트/소재/생성 후보/완성 출력은 영구 hostPath에 보존합니다. 자동 삭제하지 않으므로 용량·백업을 관리합니다. 작업자는 oracle-arm-1에 고정되며 노드 이전 시 이 디렉터리도 이전해야 합니다. 기존 영상 작업과 새 렌더는 동시 작업 세마포어를 공유합니다.

문제 시 직전 검증 이미지 SHA로 되돌리고 영구 볼륨은 보존합니다. 구 버전이 스튜디오 데이터를 읽지 않아도 삭제하지 않습니다. `VIDAUTO_UI=legacy`는 이전 정적 화면 복구용이며 통합 스튜디오 운영 진입이 아닙니다. 기존 Instagram Maker 정적 코드는 전환 전까지 유지하며 새로운 기능의 정본으로 수정하지 않습니다.

현재 문서는 배포 준비 상태입니다. 운영 배포·유료 AI 실제 호출 검증은 아직 수행하지 않았습니다.
