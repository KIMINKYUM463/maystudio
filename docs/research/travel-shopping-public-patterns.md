# 숙소·여행 쇼핑 숏폼 공개 자료 조사

- 확인일: 2026-11-03
- 범위: 공개 판매 페이지, 공개 YouTube 영상·도움말, 공식 파트너 안내
- 제외: 유료 전자책·강의·로그인 전용 자료의 내용

## 반복 확인된 패턴

1. **사진을 짧은 영상으로 바꿔 15~25초 숏폼을 만든다.** 디스이즈머니의 공개 판매 페이지와 공개 인터뷰는 숙소 사진, AI 카메라 움직임, 대본·음성·자막을 조합하는 흐름을 소개한다. 수익 사례 숫자는 판매자 주장으로 독립 검증되지 않았다.
2. **첫 장면은 조건·가격·희소성 같은 한 문장 훅이다.** 이후 객실·뷰·부대시설을 빠르게 보여주고, 마지막에는 댓글이나 링크 행동을 한 가지로 제한한다.
3. **Instagram은 댓글→공개 답글→DM→제휴 링크 흐름을 쓴다.** ManyChat 공식 도움말에 따르면 특정 게시물·릴스와 키워드를 트리거로 쓸 수 있고, 첫 비공개 답장만으로 24시간 메시지 창이 열리지는 않는다. 사용자의 버튼 클릭이나 답장이 필요하다.
4. **YouTube Shorts는 설명·고정 댓글·쇼핑 태그를 함께 쓴다.** YouTube는 명확한 CTA, 스토리텔링, 등장 순서에 맞춘 상품 태그, 수수료 투명 공개를 권장한다.
5. **조회수만으로 판단하지 않고 조회→클릭→예약을 분리한다.** 여행 상품은 가격·날짜·예약 페이지 적합도가 전환에 큰 영향을 주므로 클릭 이후 예약이 막히는 구간도 따로 봐야 한다.
6. **제휴 관계는 눈에 띄게 고지한다.** 제휴 링크 안내 자료는 캡션·설명 상단, DM, 멀티링크 페이지에도 경제적 이해관계를 표시하도록 안내한다.

## MayStudio 반영 결정

- 기존 구현 유지: 숙소 링크·사진 수집, 사진→AI 영상, 훅과 장면 구성, Remotion 자막·로고 모션그래픽, 댓글·DM 문구, 추적 링크, 훅 교체 복제
- 추가: Replicate 일괄 생성 장수 제한과 요금 확인
- 추가: Instagram·YouTube별 업로드 체크리스트와 복사 문구
- 추가: 댓글·저장·예약·수익 입력 및 조회→클릭→예약 단계별 진단
- 보류: 자동 게시·ManyChat 직접 연동은 계정 권한과 외부 API 설정이 필요
- 보류: 제휴사 예약·수익 API 자동 연동은 파트너별 인증 정보와 계약 확인이 필요

## 공개 출처

1. 디스이즈머니, 「1%도 모르는 숙소에 안 가고 숙소 영상으로 돈 버는 법」  
   https://www.thisismoney.kr/courses/suksoebook001
2. YouTube 공개 인터뷰, 「사진 1장으로 여행쇼츠 만들어서 돈 버는 방법」  
   https://www.youtube.com/watch?v=tbUoTgtJGac
3. YouTube 고객센터, 「YouTube Shopping 제휴 프로그램 팁 - Shorts」  
   https://support.google.com/youtube/answer/15814303?co=YOUTUBE._YTVideoType%3Dshorts&hl=ko
4. ManyChat Help, 「Instagram Post and Reel Comments trigger」  
   https://help.manychat.com/hc/en-us/articles/14281316989724-Instagram-Post-and-Reel-Comments-trigger
5. 마이리얼트립, 마케팅 파트너 안내  
   https://partner.myrealtrip.com/welcome/marketing_partner
6. 마이리얼트립 공식 개발자 문서  
   https://docs.myrealtrip.com/llms-full.txt
7. 세시간전, 「제휴링크·코드 콘텐츠 활용 방법」  
   https://help.3hoursahead.com/ko/articles/%EC%A0%9C%ED%9C%B4%EB%A7%81%ED%81%AC--%EC%BD%94%EB%93%9C-%EC%BD%98%ED%85%ED%8A%B8-%ED%99%9C%EC%9A%A9-%EB%B0%A9%EB%B2%95--1464543b
