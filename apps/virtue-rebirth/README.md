# virtue-rebirth

덕 쌓기 · 환생 모바일 웹앱의 이전 Kubernetes 배포 매니페스트.

- Canonical URL: https://virtue.aws.shdkej.com
- Legacy URL: https://virtue.oracle.shdkej.com -> https://virtue.aws.shdkej.com
- Source: https://github.com/shdkej/virtue-rebirth-app
- Runtime: `node:22-alpine` pod가 repo를 clone 후 `pnpm install/build/start`
- Current mode: `NEXT_PUBLIC_SCORING_MODE=mock`
- Storage: 브라우저 localStorage only. 외부 사진/DB 저장소 없음.

현재 정본은 AWS S3/CloudFront 정적판입니다. 이 Kubernetes 앱은 중복 표면을 피하기 위해
0 replicas로 두고, ingress는 canonical AWS 도메인으로 영구 리다이렉트합니다.
