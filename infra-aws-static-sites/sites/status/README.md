# Status Static Site

## 목적

Space Status 대시보드와 UI 재질 테스트 화면을 보관하는 정적 사이트입니다. 운영 화면과 시각 실험 화면은 서로 다른 경로로 분리합니다.

## 경로

- 운영 화면: `dist/index.html`
- UI 재질 테스트: `dist/ui-material-test.html`
- 배포 도메인: `https://status.aws.shdkej.com`

배포 후 테스트 화면은 `https://status.aws.shdkej.com/ui-material-test.html`에서 확인합니다.

## UI 재질 테스트 범위

`ui-material-test.html`은 다음 표현을 별도 의존성 없이 CSS와 인라인 SVG로 재현합니다.

- 반투명 표면: `rgba()` + `backdrop-filter: blur()` + 내부 하이라이트
- 아이콘 버튼: Lucide/Phosphor 계열의 얇은 선형 SVG 문법
- 중앙 실행 목록: 상태 클래스, 연결선, 단계별 `padding-left`를 사용하는 커스텀 trace 컴포넌트
- 결과 표면: 읽기 안정성을 위한 낮은 투명도 테이블과 결과 입력 영역

## 로컬 확인

```bash
cd /home/ubuntu/workspace/space/infra-aws-static-sites/sites/status
python3 -m http.server 8080 --directory dist
```

브라우저에서 `http://localhost:8080/ui-material-test.html`을 열고 390px 모바일과 데스크톱 폭을 확인합니다.

## 검증

Chrome headless로 데스크톱 렌더를 확인했습니다. 모바일에서는 620px 이하에서 세 패널이 세로로 쌓이도록 반응형 전환합니다. 외부 폰트 CDN이 실패해도 시스템 폰트로 화면은 유지됩니다.

## 알려진 한계

이 화면은 실제 제품의 의존성을 판별하는 것이 아니라, 스크린샷에서 관찰한 재질·아이콘·단계 표현을 비교하기 위한 시각 테스트입니다. 실제 컴포넌트 라이브러리 사용 여부는 원본 저장소의 `package.json` 확인이 필요합니다.
