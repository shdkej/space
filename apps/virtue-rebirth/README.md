# virtue-rebirth

덕 쌓기 · 환생 모바일 웹앱 배포 매니페스트.

- URL: https://virtue.oracle.shdkej.com
- Source: https://github.com/shdkej/virtue-rebirth-app
- Runtime: `node:22-alpine` pod가 repo를 clone 후 `pnpm install/build/start`
- Current mode: `NEXT_PUBLIC_SCORING_MODE=mock`
- Storage: 브라우저 localStorage only. 외부 사진/DB 저장소 없음.

초기 MVP라 별도 Docker image build 없이 pod start 시 빌드합니다. 추후 트래픽/재시작 비용이 커지면 GHCR 이미지 빌드로 전환하세요.
