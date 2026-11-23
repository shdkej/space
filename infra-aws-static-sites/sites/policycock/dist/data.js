/* Policy archive: affiliation and status refer to the cited historical event. */
const POLICY_DATA = [
{id:'lee',name:'이재명',group:'democratic',party:'더불어민주당',year:'2019',stage:'시행 사례',policy:'청년기본소득',category:'청년·복지',region:'경기',summary:'경기도 청년의 생활과 지역 경제를 함께 지원하기 위해 지역화폐로 소득을 지원한 정책입니다.',source:'https://gnews.gg.go.kr/news/news_detail.do?number=201812041024027055C059&s_code=C059',sourceLabel:'경기도 공식 설명',news:'https://www.yna.co.kr/view/AKR20190901005800061',law:'경기도 청년기본소득 지급 조례'},
{id:'kim-dongyeon',name:'김동연',group:'democratic',party:'더불어민주당',year:'2023',stage:'시행 사례',policy:'예술인 기회소득',category:'문화·복지',region:'경기',summary:'소득 요건을 충족하는 예술인이 창작 활동을 이어갈 수 있도록 지원하는 정책입니다.',source:'https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=s017&number=55553',sourceLabel:'경기도 예산 보도자료',news:'https://www.yna.co.kr/amp/view/AKR20230614082551061',law:'경기도 예술인 기회소득 지급 조례'},
{id:'kim-kyungsoo',name:'김경수',group:'democratic',party:'더불어민주당',year:'2021',stage:'추진 사례',policy:'부울경 메가시티',category:'지역·교통',region:'부산·울산·경남',summary:'부산·울산·경남의 교통, 산업과 생활권을 연결하는 광역 협력을 추진한 사례입니다.',source:'https://council.gyeongnam.go.kr/record/recordView.do?key=067b32375db7d4ac4df84dcf0f20a2ca59172014d2146b61327c9fa12b1988fde350fafcbabec262',sourceLabel:'경남도의회 회의록',news:'https://www.viva100.com/article/202104093644775',law:'지방자치법',sourceNote:'회의록 링크는 수록했으나 직접 응답은 확인하지 못했습니다. 관련 보도도 함께 확인하세요.'},
{id:'park',name:'박주민',group:'democratic',party:'더불어민주당',year:'2021',stage:'법안 발의',policy:'평등에 관한 법률안',category:'권리·법률',region:'전국',summary:'여러 생활 영역에서 차별을 금지하고 피해 구제 절차를 마련하기 위해 발의한 법률안입니다.',source:'https://opinion.lawmaking.go.kr/gcom/nsmLmSts/out/2111964/detailRP',sourceLabel:'법안 원문 · 의안 2111964',news:'https://www.yna.co.kr/amp/view/AKR20210809138900001',law:'국가인권위원회법'},
{id:'moon',name:'문재인',group:'democratic',party:'더불어민주당',year:'2017~2018',stage:'공약·도입 사례',policy:'아동수당',category:'돌봄·복지',region:'전국',summary:'아동을 양육하는 가구의 부담을 줄이기 위한 현금 수당으로, 2017년 공약 이후 2018년 도입됐습니다.',source:'https://www.mohw.go.kr/upload/content_data/2018/pop180503-01.pdf',sourceLabel:'보건복지부 정책 자료',news:'https://www.newsis.com/view/NISX20170414_0014831376',law:'아동수당법'},
{id:'oh',name:'오세훈',group:'conservative',party:'국민의힘',year:'2024',stage:'시행 사례',policy:'기후동행카드',category:'기후·교통',region:'서울',summary:'서울 대중교통을 정액으로 이용할 수 있도록 만든 통합 이용권 정책입니다.',source:'https://www.seoul.go.kr/news/news_report.do?nttNo=414644&tr_code=snews',sourceLabel:'서울시 공식 보도자료',news:'https://www.yna.co.kr/view/AKR20240129086000004',law:'대중교통의 육성 및 이용촉진에 관한 법률'},
{id:'hong',name:'홍준표',group:'conservative',party:'국민의힘',year:'2023',stage:'시행 사례',policy:'어르신 통합 무임교통',category:'교통·복지',region:'대구',summary:'대구 어르신의 이동을 돕기 위해 버스와 도시철도 이용을 지원한 정책입니다.',source:'https://www.gaok.or.kr/T_Newsletter_2021/2023_11/1/Vol111.pdf',sourceLabel:'시도지사협의회 정책 자료',news:'https://www.newsis.com/view/NISX20231227_0002572679',law:'대구광역시 어르신 무임교통 지원에 관한 조례'},
{id:'yoo',name:'유승민',group:'conservative',party:'국민의힘',year:'2021',stage:'공약',policy:'육아휴직 3년',category:'돌봄·노동',region:'전국',summary:'민간 부문 육아휴직 기간을 늘리고 휴직 급여를 지원하자는 공약입니다. 시행 여부와 구분해 살펴보세요.',source:'https://www.yna.co.kr/view/AKR20210805037800001',sourceLabel:'공약 발표 보도',news:'https://www.ytn.co.kr/_ln/0101_202108050906381757',law:'남녀고용평등과 일·가정 양립 지원에 관한 법률'},
{id:'na',name:'나경원',group:'conservative',party:'국민의힘',year:'2024',stage:'법안 발의',policy:'신혼부부 주거 지원',category:'주거·돌봄',region:'전국',summary:'신혼부부의 주택자금 저리 대출과 출산에 연계한 지원을 제안한 주거기본법 개정안입니다.',source:'https://likms.assembly.go.kr/bill/billDetail.do?billId=PRC_A2Z4O0U5R3E0L1H1P2U4S1R1Q8X4W8',sourceLabel:'주거기본법 개정안 · 의안 2200054',news:'https://www.newsis.com/view/NISX20240531_0002757021',law:'주거기본법'},
{id:'han',name:'한동훈',group:'conservative',party:'국민의힘',year:'2024',stage:'정책 주장',policy:'금융투자소득세 폐지',category:'경제·세제',region:'전국',summary:'금융투자소득세 도입을 폐지하자는 당시의 정책 주장입니다. 현재 세제 안내와는 구분됩니다.',source:'https://www.peoplepowerparty.kr/news/comment_view/BBSDD0001/102690',sourceLabel:'국민의힘 공식 발표',news:'https://imnews.imbc.com/news/2024/politics/article/6624859_36431.html',law:'소득세법'}
];

const POLICY_TIMELINES = {
  "lee": [
    {
      "date": "2018-12-04",
      "label": "경기도가 성남의 청년배당을 도 전역으로 확대할 계획을 공개했습니다.",
      "url": "https://gnews.gg.go.kr/news/news_detail.do?number=201812041024027055C059&s_code=C059",
      "summary": "경기도가 성남 청년배당을 도 전역으로 넓히겠다고 발표했습니다.",
      "title": "도 전역 확대 계획"
    },
    {
      "date": "2019-04-08",
      "label": "만 24세 청년을 대상으로 첫 분기 신청을 받기 시작했습니다.",
      "url": "https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=S017&number=40176",
      "title": "첫 분기 신청"
    },
    {
      "date": "2026-11-02",
      "label": "2026년 4분기 신청을 열었습니다. 접수 마감은 12월 1일 오후 6시입니다.",
      "url": "https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=s017&number=71859",
      "summary": "경기도가 2026년 4분기 청년기본소득 신청을 시작했습니다.",
      "title": "4분기 신청 시작",
      "changeSinceFirst": "성남의 청년배당을 경기도 전역으로 넓히겠다는 계획이 실제 분기별 신청으로 이어졌습니다. 마지막 기록은 2026년 4분기 접수입니다."
    },
    {
      "date": "2026-12-01",
      "scheduled": true,
      "scheduleKind": "접수 일정",
      "title": "4분기 신청 마감",
      "label": "12월 1일 오후 6시에 4분기 청년기본소득 신청이 마감됩니다.",
      "url": "https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=s017&number=71859"
    },
    {
      "date": "2026-12-20",
      "scheduled": true,
      "scheduleKind": "공고된 지급 일정",
      "title": "4분기 지급 개시 예정",
      "label": "경기도는 심사에서 선정된 청년에게 12월 20일부터 25만 원을 지역화폐로 지급할 계획입니다.",
      "url": "https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=s017&number=71859"
    }
  ],
  "kim-dongyeon": [
    {
      "date": "2022-12-17",
      "label": "경기도가 예술인 기회소득을 포함한 2023년도 예산 확정을 발표했습니다.",
      "url": "https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=s017&number=55553",
      "summary": "경기도가 2023년 예산에 예술인 기회소득을 반영했습니다.",
      "title": "예산 확정"
    },
    {
      "date": "2023-06-30",
      "label": "안양·파주 등 10개 시군에서 시범사업 신청이 시작됐습니다.",
      "url": "https://gg24.gg.go.kr/svcreqst/selectSvcReqst.do?svc_seq=843",
      "title": "10개 시군 시범사업"
    },
    {
      "date": "2026-05-11",
      "label": "경기도 28개 시군에서 올해 사업 신청을 시작했습니다.",
      "url": "https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=s017&number=70244",
      "title": "28개 시군 신청"
    },
    {
      "date": "2026-09-11",
      "label": "경기도 문화체육관광국장이 도의회에 하반기 지급액을 조정할 수 있다고 설명했습니다.",
      "url": "https://kms.ggc.go.kr/cms/mntsViewer.do?mntsId=15689&spkrId=12203",
      "title": "지급액 조정 가능성"
    },
    {
      "date": "2026-10-15",
      "label": "2차분 지급을 요구하는 도민 청원이 접수됐습니다. 청원은 11월 14일 종료됐습니다.",
      "url": "https://petitions.gg.go.kr/view/?bs=3&uid=28983",
      "summary": "예술인 기회소득 2차분 지급을 요구하는 도민 청원이 접수됐습니다.",
      "title": "2차분 지급 청원",
      "changeSinceFirst": "첫 기록은 예술인 기회소득 예산 확정이었고, 마지막 기록은 2차분을 지급해 달라는 도민 청원 접수였습니다."
    }
  ],
  "kim-kyungsoo": [
    {
      "date": "2021-02-25",
      "label": "부산·울산·경남이 동남권 메가시티 구축 전략을 발표했습니다.",
      "url": "https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/165516/view",
      "summary": "부산·울산·경남이 메가시티 구축 전략을 발표했습니다.",
      "title": "메가시티 전략 발표"
    },
    {
      "date": "2022-04-18",
      "label": "행정안전부가 세 시도의 특별연합 규약을 승인했습니다.",
      "url": "https://www.mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=91586",
      "title": "특별연합 규약 승인"
    },
    {
      "date": "2023-03-29",
      "label": "특별연합 규약 폐지에 따라 부산시가 합동추진단 사무국을 없애는 조례를 공포했습니다.",
      "url": "https://www.busan.go.kr/depart/ablatestll/1561056",
      "title": "추진단 폐지 조례"
    },
    {
      "date": "2026-09-08",
      "label": "세 시도지사가 초광역 협력 공동선언을 채택하고 상설 협의체 가동에 합의했습니다.",
      "url": "https://www.busan.go.kr/nbtnewsBU/1753328",
      "summary": "세 시도지사가 초광역 협력 공동선언을 채택하고 상설 협의체 가동에 합의했습니다.",
      "title": "상설 협의체 합의",
      "changeSinceFirst": "세 시도는 메가시티 구축 전략을 발표했습니다. 이후 특별연합 규약이 폐지됐고, 마지막에는 상설 협의체를 가동하기로 합의했습니다."
    }
  ],
  "park": [
    {
      "date": "2021-08-09",
      "label": "박주민 의원 등 13명이 평등에 관한 법률안(제2111964호)을 발의했습니다.",
      "url": "https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_D2S1N0F8X0O9W1T6U3A4N5W6I2X5A3",
      "summary": "박주민 의원 등이 21대 국회에 평등법안을 발의했습니다.",
      "title": "21대 법안 발의"
    },
    {
      "date": "2022-05",
      "label": "국회에서 이 법안을 포함한 차별금지·평등 관련 법안 심사를 위한 공청회를 열었습니다.",
      "url": "https://www.moj.go.kr/bbs/moj/124/462085/download.do",
      "title": "국회 공청회"
    },
    {
      "date": "2024-05-29",
      "label": "제21대 국회 임기 만료로 해당 법률안이 폐기됐습니다.",
      "url": "https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_D2S1N0F8X0O9W1T6U3A4N5W6I2X5A3",
      "title": "임기 만료로 폐기"
    },
    {
      "date": "2026-11-11",
      "label": "제22대 국회에서 박주민 의원 등 12명이 같은 이름의 법률안을 별도 의안(제2222676호)으로 발의했습니다.",
      "url": "https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_6488C0BAE93D4272946C7A6127C151",
      "title": "22대 새 법안 발의"
    },
    {
      "date": "2026-11-12",
      "label": "새 법안의 국회 입법예고가 시작됐습니다. 의견 접수 기간은 11월 26일까지입니다.",
      "url": "https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_6488C0BAE93D4272946C7A6127C151",
      "summary": "21대 법안 폐기 후 22대에 새로 발의한 평등법안의 입법예고가 시작됐습니다.",
      "title": "새 법안 입법예고",
      "changeSinceFirst": "21대 국회에서 발의한 법안은 임기 만료로 폐기됐습니다. 마지막 기록에서 입법예고된 것은 22대 국회에 새로 발의된 법안입니다."
    }
  ],
  "moon": [
    {
      "date": "2017-04",
      "label": "문재인 후보가 양육 가구에 아동수당을 지급하겠다고 공약했습니다.",
      "url": "https://www.newsis.com/view/NISX20170414_0014831376",
      "summary": "문재인 후보가 양육 가구에 아동수당을 지급하겠다고 공약했습니다.",
      "title": "아동수당 지급 공약"
    },
    {
      "date": "2018-09",
      "label": "아동수당 지급을 시작했습니다.",
      "url": "https://www.mohw.go.kr/menu.es?mid=a10711030100",
      "title": "첫 지급"
    },
    {
      "date": "2026-03",
      "label": "아동수당법 개정으로 2026년 지급 대상을 만 9세 미만으로 넓히고 비수도권·인구감소지역 추가 지급 기준을 마련했습니다.",
      "url": "https://mohw.go.kr/gallery.es?act=view&bid=0003&list_no=380007&mid=a10606030000",
      "title": "만 9세 미만 확대"
    },
    {
      "date": "2026-04",
      "label": "확대된 아동수당 지급을 시작하면서 1월분부터 소급 적용했습니다.",
      "url": "https://www.mohw.go.kr/menu.es?mid=a10716030000",
      "summary": "만 9세 미만으로 확대한 아동수당을 지급하면서 1월분부터 소급 적용했습니다.",
      "title": "1월분부터 소급",
      "changeSinceFirst": "양육 가구에 수당을 지급하겠다는 공약이 시행된 뒤, 지급 대상이 만 9세 미만으로 넓어졌습니다. 확대된 수당은 2026년 1월분부터 소급 적용됐습니다."
    },
    {
      "date": "2027",
      "scheduled": true,
      "title": "만 10세 미만 확대",
      "label": "개정 아동수당법 부칙 제2조에 따라 2027년에는 지급 대상이 만 9세 미만에서 만 10세 미만으로 넓어질 예정입니다.",
      "url": "https://www.mohw.go.kr/board.es?mid=a10503010100&bid=0027&act=view&list_no=1490257"
    }
  ],
  "oh": [
    {
      "date": "2023-09-11",
      "label": "서울시가 버스·지하철·따릉이를 한 장으로 이용하는 정기권 구상을 발표했습니다.",
      "url": "https://mediahub.seoul.go.kr/archives/2009034",
      "summary": "서울시가 버스·지하철·따릉이를 한 달간 무제한으로 이용하는 정기권을 제안했습니다.",
      "title": "통합 정기권 구상"
    },
    {
      "date": "2024-01-27",
      "label": "서울시가 대중교통 정기권 기후동행카드 시범사업을 시작했습니다.",
      "url": "https://www.seoul.go.kr/news/news_report.do?nttNo=414644&tr_code=snews",
      "title": "시범사업 시작"
    },
    {
      "date": "2024-07-01",
      "label": "시범사업에서 본사업으로 전환했습니다.",
      "url": "https://news.seoul.go.kr/traffic/archives/512725",
      "title": "본사업 전환"
    },
    {
      "date": "2026-10-01",
      "label": "30일권 운영과 후불카드 할인 혜택이 종료됐습니다. 1~7일 단기권은 계속 운영합니다.",
      "url": "https://news.seoul.go.kr/traffic/archives/517640?listPage=1",
      "summary": "서울시가 30일권과 후불카드 할인을 종료하고 1~7일 단기권은 유지했습니다.",
      "title": "30일권 운영 종료",
      "changeSinceFirst": "통합 정기권 구상은 기후동행카드로 시행됐습니다. 마지막 기록에서는 30일권과 후불카드 할인 혜택이 종료됐고, 1~7일 단기권은 계속 운영됐습니다."
    }
  ],
  "hong": [
    {
      "date": "2023-07-01",
      "label": "대구시가 어르신 통합 무임교통 지원을 시작했습니다.",
      "url": "https://www.gaok.or.kr/T_Newsletter_2021/2023_11/1/Vol111.pdf",
      "summary": "도입 당시 시내버스는 만 75세부터, 도시철도는 만 65세부터 무료였습니다.",
      "title": "무임교통 지원 시작"
    },
    {
      "date": "2024-10-30",
      "label": "개정 조례 시행으로 무임교통 지원 대상 교통수단에 광역철도와 수요응답형 여객자동차를 명시했습니다.",
      "url": "https://www.law.go.kr/ordinInfoP.do?ordinSeq=1980297",
      "title": "대상 교통수단 명시"
    },
    {
      "date": "2026",
      "label": "조례의 연도별 기준에 따라 시내버스·수요응답형 교통은 만 72세 이상, 도시철도·광역철도는 만 68세 이상이 대상입니다.",
      "url": "https://council.daegu.go.kr/attach/bbs/legislation/90a55576ce1f9c1b113e61781af3df32.pdf",
      "summary": "무임교통 연령이 시내버스는 만 72세, 도시철도는 만 68세부터로 적용됐습니다.",
      "title": "2026년 연령 기준",
      "changeSinceFirst": "통합 무임교통 지원을 시작한 뒤, 2026년에는 시내버스·수요응답형 교통은 만 72세 이상, 도시철도·광역철도는 만 68세 이상으로 이용 기준이 나뉘었습니다."
    },
    {
      "date": "2027",
      "scheduled": true,
      "title": "버스 71세·철도 69세",
      "label": "조례에 따라 2027년에는 시내버스·수요응답형 교통은 만 71세 이상, 도시철도·광역철도는 만 69세 이상부터 무임교통을 이용할 수 있습니다.",
      "url": "https://www.law.go.kr/LSW/ordinInfoP.do?ordinId=2222962"
    },
    {
      "date": "2028",
      "scheduled": true,
      "title": "버스·철도 모두 70세",
      "label": "2028년에는 시내버스·수요응답형 교통과 도시철도·광역철도의 무임교통 연령 기준이 만 70세 이상으로 같아집니다.",
      "url": "https://www.law.go.kr/LSW/ordinInfoP.do?ordinId=2222962"
    }
  ],
  "yoo": [
    {
      "date": "2021-08-05",
      "label": "유승민은 민간 근로자의 육아휴직을 3년까지 늘리겠다고 공약했습니다.",
      "url": "https://www.yna.co.kr/view/AKR20210805037800001",
      "summary": "유승민 후보가 민간 근로자의 육아휴직을 3년으로 늘리겠다고 공약했습니다.",
      "title": "3년 육아휴직 공약"
    },
    {
      "date": "2025-02-23",
      "label": "별도로 개정된 법에 따라 같은 자녀에 대해 부모가 각각 3개월 이상 휴직한 경우, 한부모 또는 중증 장애아동의 부모는 육아휴직을 최대 1년 6개월까지 쓸 수 있게 됐습니다.",
      "url": "https://1350.moel.go.kr/rtmview.do?id=1000325546",
      "title": "조건부 기간 연장"
    },
    {
      "date": "2026-08-20",
      "label": "자녀의 방학이나 질병 등으로 돌봄이 필요할 때 육아휴직을 1주 또는 2주 단위로 사용할 수 있게 됐습니다.",
      "url": "https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21373&ancYd=20260219&efYd=20260820&lsiSeq=283455",
      "summary": "민간 육아휴직 제도에서 자녀의 방학·질병 등에는 1주 또는 2주 단위 사용이 가능해졌습니다.",
      "title": "단기 육아휴직",
      "changeSinceFirst": "처음 공약은 육아휴직 기간을 3년까지 늘리는 것이었습니다. 마지막 기록은 별도 법 개정에 따라 돌봄이 필요할 때 1주 또는 2주 단위로 휴직할 수 있게 된 내용입니다."
    }
  ],
  "na": [
    {
      "date": "2024-05-31",
      "label": "나경원 의원 등 18인이 신혼부부 주택자금 저리 대출과 출산에 따른 원리금 지원을 담은 주거기본법 개정안을 발의했습니다.",
      "url": "https://likms.assembly.go.kr/bill/billDetail.do?billId=PRC_A2Z4O0U5R3E0L1H1P2U4S1R1Q8X4W8",
      "summary": "신혼부부 저리 대출과 출산 시 원리금 지원을 담은 법안이 발의됐습니다.",
      "title": "개정안 발의"
    },
    {
      "date": "2024-06-11",
      "label": "법안이 국회 국토교통위원회에 회부됐습니다.",
      "url": "https://likms.assembly.go.kr/bill/billDetail.do?billId=PRC_A2Z4O0U5R3E0L1H1P2U4S1R1Q8X4W8",
      "title": "상임위 회부"
    },
    {
      "date": "2024-08-21",
      "label": "국토교통위원회가 법안을 상정하고 토론을 거쳐 소위원회로 넘겼습니다.",
      "url": "https://likms.assembly.go.kr/bill/billDetail.do?billId=PRC_A2Z4O0U5R3E0L1H1P2U4S1R1Q8X4W8",
      "summary": "국회 국토교통위원회가 개정안을 심사할 소위원회로 넘겼습니다.",
      "title": "소위원회 회부",
      "changeSinceFirst": "신혼부부 주거 지원을 담은 개정안이 발의된 뒤, 마지막 기록에서는 상임위 토론을 거쳐 소위원회 심사 단계로 넘어갔습니다."
    }
  ],
  "han": [
    {
      "date": "2024-08-07",
      "label": "한동훈 국민의힘 대표가 국회에서 금융투자소득세 폐지를 주장했습니다.",
      "url": "https://imnews.imbc.com/news/2024/politics/article/6624859_36431.html",
      "summary": "한동훈 대표가 금융투자소득세 폐지를 주장했습니다.",
      "title": "금투세 폐지 주장"
    },
    {
      "date": "2024-12-31",
      "label": "금융투자소득세를 폐지하는 소득세법 개정안이 법률 제20615호로 공포됐습니다.",
      "url": "https://www.law.go.kr/lsRvsRsnListP.do?lsId=003956",
      "title": "개정법 공포"
    },
    {
      "date": "2025-01-01",
      "label": "개정 소득세법이 시행돼 금융투자소득세 도입이 취소되고 기존 양도소득세 체계가 유지됐습니다.",
      "url": "https://www.law.go.kr/lsRvsRsnListP.do?lsId=003956",
      "summary": "개정 소득세법이 시행되면서 금융투자소득세 도입이 취소됐습니다.",
      "title": "개정법 시행",
      "changeSinceFirst": "금융투자소득세 폐지 주장이 나온 뒤 소득세법이 개정됐습니다. 마지막 기록에서는 개정법 시행으로 금투세 도입이 취소되고 기존 양도소득세 체계가 유지됐습니다."
    }
  ]
};
