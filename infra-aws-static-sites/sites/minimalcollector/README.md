# Minimal Collector

미니멀에 관심 있는 방문자가 운영자의 취향을 서랍 하나씩 열어 살펴보는 개인 랜딩페이지입니다. 도서관 목문을 클릭하거나 키보드로 열면 흰 스튜디오로 이동합니다. 오른쪽 이름표를 누르거나 각 서랍을 가로로 스크롤하면 주제별 카드가 보입니다. 세로 스크롤로 마지막 칸까지 이동합니다.

## 실행과 편집

이 디렉터리에서 `python3 -m http.server 8000 --directory dist`를 실행하고 브라우저로 localhost의 8000번 포트를 엽니다. 빌드 단계나 백엔드가 없습니다. 공개용 이름과 설명은 `dist/studio.js`의 배열에 있습니다. 노트 원문을 배포하지 않습니다.

## 이미지

입구의 [Biblioteca medicea laurenziana, vestibolo e scala di Michelangelo, 03](https://commons.wikimedia.org/wiki/File:Biblioteca_medicea_laurenziana,_vestibolo_e_scala_di_michelangelo,_03.jpg)는 Francesco Bini(Sailko)의 사진입니다. 화면 비율에 맞춰 크롭하고 WebP로 변환했습니다. 사진 및 목문을 겹친 편집 장면은 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)으로 제공합니다. 목문 레이어와 참나무 표면은 생성 이미지입니다.

## 배포와 확인

`shdkej/space`의 main에 이 앱의 dist 변경을 푸시하면 정적 사이트 워크플로가 서울 리전의 전용 비공개 S3 버킷 `static-minimalcollector-com`을 동기화하고 CloudFront `E21JW8J4ZVYGY5`를 무효화합니다. Cloudflare의 루트 레코드가 전용 배포를 가리킵니다. 레지스트리의 `dedicated-cloudfront`는 공유 Terraform이 이 리소스를 생성하거나 갱신하는 것을 방지합니다.

배포 후 https://minimalcollector.com/ 에서 스크롤 없는 첫 화면, 문 열림, 뒤로 가기, 마지막 서랍까지의 세로 탐색, 각 서랍의 개별 가로 탐색을 데스크톱과 모바일 너비에서 확인합니다. 동작 줄이기 설정에서는 문 애니메이션을 건너뜁니다. 스튜디오의 조작에는 자바스크립트가 필요합니다.
