# Minimal Collector

미니멀에 관심 있는 방문자가 운영자의 취향을 서랍 하나씩 열어 살펴보는 개인 랜딩페이지입니다. 도서관 목문을 클릭하거나 키보드로 열면 흰 스튜디오로 이동합니다. 오른쪽의 작은 목제 손잡이를 누르거나 수평으로 당기면 다섯 칸의 앤티크 서랍이 개별적으로 열립니다. 왼쪽 책상의 수집 도록을 누르면 라우렌치아나 도서관 모형이 양쪽 지면에 걸쳐 펼쳐집니다. 계단 위의 표시를 가리키거나 누르면 오른쪽 지면에서 계단 곡면을 확대해 볼 수 있습니다. 서랍 속 작품을 누르면 해당 작품의 펼침면으로 이동합니다. 페이지 모서리를 누르거나 끌어서 넘길 수 있고, 아래 화살표와 좌우 방향키로도 같은 서랍 안의 작품을 탐색합니다. 도록 덮기 또는 Escape로 돌아오면 처음 선택한 책이나 작품에 포커스가 돌아갑니다. 세로 스크롤로 마지막 칸까지 이동합니다.

## 실행과 편집

이 디렉터리에서 `python3 -m http.server 8000 --directory dist`를 실행하고 브라우저로 localhost의 8000번 포트를 엽니다. 빌드 단계나 백엔드가 없습니다. 책의 양면과 투영 그림자는 `dist/book.js`의 WebGL 메시로 그립니다. WebGL을 사용할 수 없으면 이미지와 설명, 작품 이동 버튼이 있는 감상 창을 표시합니다. 공개용 이름과 설명은 `dist/studio.js`의 배열에 있습니다. 노트 원문을 배포하지 않습니다.

## 이미지

입구의 [Biblioteca medicea laurenziana, vestibolo e scala di Michelangelo, 03](https://commons.wikimedia.org/wiki/File:Biblioteca_medicea_laurenziana,_vestibolo_e_scala_di_michelangelo,_03.jpg)는 Francesco Bini(Sailko)의 사진입니다. 화면 비율에 맞춰 크롭하고 WebP로 변환했습니다. 사진 및 목문을 겹친 편집 장면은 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)으로 제공합니다. 목문 레이어와 목재 표면은 생성 이미지입니다. `dist/exhibits/`의 WebP 40개는 기존 수집 주제를 해석한 AI 정물·모형 이미지입니다. 작품 감상 창에 이미지 성격을 표기합니다. 첨부된 가구 사진은 디자인 참조로만 사용했습니다.

## 배포와 확인

`shdkej/space`의 main에 이 앱의 dist 변경을 푸시하면 정적 사이트 워크플로가 서울 리전의 전용 비공개 S3 버킷 `static-minimalcollector-com`을 동기화하고 CloudFront `E21JW8J4ZVYGY5`를 무효화합니다. Cloudflare의 루트 레코드가 전용 배포를 가리킵니다. 레지스트리의 `dedicated-cloudfront`는 공유 Terraform이 이 리소스를 생성하거나 갱신하는 것을 방지합니다.

배포 후 https://minimalcollector.com/ 에서 스크롤 없는 첫 화면, 문 안쪽의 빛이 일렁이며 확대되는 전환, 뒤로 가기, 마지막 서랍까지의 세로 탐색, 각 서랍의 개별 가로 탐색을 데스크톱과 모바일 너비에서 확인합니다. 동작 줄이기 설정에서는 문 애니메이션을 건너뜁니다. 스튜디오의 조작에는 자바스크립트가 필요합니다.
