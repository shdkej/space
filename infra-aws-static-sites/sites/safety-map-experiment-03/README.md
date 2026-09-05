# Safety Map — Experiment 03

독립된 전역 지도 UX 재실험용 정적 사이트 경로입니다. 기존 `sites/safety-map/`은 legacy이며 이 실험의 구현 기반이나 수정 대상으로 사용하지 않습니다.

## 목적

전체 화면의 Mapbox 지도를 중심으로 장소·도로 탐색, 검색, zoom/pan, basemap 전환을 제공하는 Spatial Type 경험을 만듭니다. 안전 판단을 자동화하거나 단정하지 않습니다.

## 사용자 경계

- 장소 탐색과 공개 안전 정보의 **부재**를 명확히 안내합니다.
- 안전 점수, 안전 경로, 실시간 사건, 위치 수집, 개인정보 전송을 만들지 않습니다.
- 신뢰할 수 있는 공개 데이터가 연결되기 전에는 no-data 상태를 유지합니다.

## 구조

- `src/`: 사람이 편집하는 소스
- `dist/`: 정적 배포 산출물

다음 leaf에서 full-viewport Mapbox canvas, Typography Rail, 검색과 접근성 상태를 추가합니다. 새 app slug·도메인·Terraform registry·Mapbox origin allowlist는 별도 운영 검증이 끝나기 전까지 만들거나 변경하지 않습니다.

## 토큰·배포

`MAPBOX_PUBLIC_TOKEN` 값은 저장소, 소스, 테스트 출력, 보고서에 넣지 않습니다. 필요 시 e03 전용 protected runtime config를 배포 환경에서 생성하며, 새 domain allowlist와 Terraform apply는 별도 승인·운영 게이트입니다.

## 검증

T3.1에서는 새 경로만 존재하는지와 legacy `sites/safety-map/**`가 변경되지 않았는지만 검사합니다. 이후 leaf에서 smoke, desktop/390px 상호작용, Red 직접 시각 검증, live proof를 추가합니다.
