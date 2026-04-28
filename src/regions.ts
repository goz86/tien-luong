export interface Region {
  ko: string;
  en: string;
}

export const koreanRegions: Region[] = [
  // === 서울특별시 (Seoul) ===
  { ko: '서울 강남구', en: 'Seoul Gangnam-gu' },
  { ko: '서울 강동구', en: 'Seoul Gangdong-gu' },
  { ko: '서울 강북구', en: 'Seoul Gangbuk-gu' },
  { ko: '서울 강서구', en: 'Seoul Gangseo-gu' },
  { ko: '서울 관악구', en: 'Seoul Gwanak-gu' },
  { ko: '서울 광진구', en: 'Seoul Gwangjin-gu' },
  { ko: '서울 구로구', en: 'Seoul Guro-gu' },
  { ko: '서울 금천구', en: 'Seoul Geumcheon-gu' },
  { ko: '서울 노원구', en: 'Seoul Nowon-gu' },
  { ko: '서울 도봉구', en: 'Seoul Dobong-gu' },
  { ko: '서울 동대문구', en: 'Seoul Dongdaemun-gu' },
  { ko: '서울 동작구', en: 'Seoul Dongjak-gu' },
  { ko: '서울 마포구', en: 'Seoul Mapo-gu' },
  { ko: '서울 서대문구', en: 'Seoul Seodaemun-gu' },
  { ko: '서울 서초구', en: 'Seoul Seocho-gu' },
  { ko: '서울 성동구', en: 'Seoul Seongdong-gu' },
  { ko: '서울 성북구', en: 'Seoul Seongbuk-gu' },
  { ko: '서울 송파구', en: 'Seoul Songpa-gu' },
  { ko: '서울 양천구', en: 'Seoul Yangcheon-gu' },
  { ko: '서울 영등포구', en: 'Seoul Yeongdeungpo-gu' },
  { ko: '서울 용산구', en: 'Seoul Yongsan-gu' },
  { ko: '서울 은평구', en: 'Seoul Eunpyeong-gu' },
  { ko: '서울 종로구', en: 'Seoul Jongno-gu' },
  { ko: '서울 중구', en: 'Seoul Jung-gu' },
  { ko: '서울 중랑구', en: 'Seoul Jungnang-gu' },

  // === 부산광역시 (Busan) ===
  { ko: '부산 중구', en: 'Busan Jung-gu' },
  { ko: '부산 서구', en: 'Busan Seo-gu' },
  { ko: '부산 동구', en: 'Busan Dong-gu' },
  { ko: '부산 영도구', en: 'Busan Yeongdo-gu' },
  { ko: '부산 부산진구', en: 'Busan Busanjin-gu' },
  { ko: '부산 동래구', en: 'Busan Dongnae-gu' },
  { ko: '부산 남구', en: 'Busan Nam-gu' },
  { ko: '부산 북구', en: 'Busan Buk-gu' },
  { ko: '부산 해운대구', en: 'Busan Haeundae-gu' },
  { ko: '부산 사하구', en: 'Busan Saha-gu' },
  { ko: '부산 금정구', en: 'Busan Geumjeong-gu' },
  { ko: '부산 강서구', en: 'Busan Gangseo-gu' },
  { ko: '부산 연제구', en: 'Busan Yeonje-gu' },
  { ko: '부산 수영구', en: 'Busan Suyeong-gu' },
  { ko: '부산 사상구', en: 'Busan Sasang-gu' },
  { ko: '부산 기장군', en: 'Busan Gijang-gun' },

  // === 인천광역시 (Incheon) ===
  { ko: '인천 중구', en: 'Incheon Jung-gu' },
  { ko: '인천 동구', en: 'Incheon Dong-gu' },
  { ko: '인천 미추홀구', en: 'Incheon Michuhol-gu' },
  { ko: '인천 연수구', en: 'Incheon Yeonsu-gu' },
  { ko: '인천 남동구', en: 'Incheon Namdong-gu' },
  { ko: '인천 부평구', en: 'Incheon Bupyeong-gu' },
  { ko: '인천 계양구', en: 'Incheon Gyeyang-gu' },
  { ko: '인천 서구', en: 'Incheon Seo-gu' },
  { ko: '인천 강화군', en: 'Incheon Ganghwa-gun' },
  { ko: '인천 옹진군', en: 'Incheon Ongjin-gun' },

  // === 대구광역시 (Daegu) ===
  { ko: '대구 중구', en: 'Daegu Jung-gu' },
  { ko: '대구 동구', en: 'Daegu Dong-gu' },
  { ko: '대구 서구', en: 'Daegu Seo-gu' },
  { ko: '대구 남구', en: 'Daegu Nam-gu' },
  { ko: '대구 북구', en: 'Daegu Buk-gu' },
  { ko: '대구 수성구', en: 'Daegu Suseong-gu' },
  { ko: '대구 달서구', en: 'Daegu Dalseo-gu' },
  { ko: '대구 달성군', en: 'Daegu Dalseong-gun' },

  // === 대전광역시 (Daejeon) ===
  { ko: '대전 동구', en: 'Daejeon Dong-gu' },
  { ko: '대전 중구', en: 'Daejeon Jung-gu' },
  { ko: '대전 서구', en: 'Daejeon Seo-gu' },
  { ko: '대전 유성구', en: 'Daejeon Yuseong-gu' },
  { ko: '대전 대덕구', en: 'Daejeon Daedeok-gu' },

  // === 광주광역시 (Gwangju) ===
  { ko: '광주 동구', en: 'Gwangju Dong-gu' },
  { ko: '광주 서구', en: 'Gwangju Seo-gu' },
  { ko: '광주 남구', en: 'Gwangju Nam-gu' },
  { ko: '광주 북구', en: 'Gwangju Buk-gu' },
  { ko: '광주 광산구', en: 'Gwangju Gwangsan-gu' },

  // === 울산광역시 (Ulsan) ===
  { ko: '울산 중구', en: 'Ulsan Jung-gu' },
  { ko: '울산 남구', en: 'Ulsan Nam-gu' },
  { ko: '울산 동구', en: 'Ulsan Dong-gu' },
  { ko: '울산 북구', en: 'Ulsan Buk-gu' },
  { ko: '울산 울주군', en: 'Ulsan Ulju-gun' },

  // === 세종특별자치시 (Sejong) ===
  { ko: '세종시', en: 'Sejong City' },

  // === 경기도 (Gyeonggi-do) ===
  { ko: '수원시', en: 'Suwon' },
  { ko: '성남시', en: 'Seongnam' },
  { ko: '고양시', en: 'Goyang' },
  { ko: '용인시', en: 'Yongin' },
  { ko: '부천시', en: 'Bucheon' },
  { ko: '안산시', en: 'Ansan' },
  { ko: '안양시', en: 'Anyang' },
  { ko: '남양주시', en: 'Namyangju' },
  { ko: '화성시', en: 'Hwaseong' },
  { ko: '평택시', en: 'Pyeongtaek' },
  { ko: '의정부시', en: 'Uijeongbu' },
  { ko: '시흥시', en: 'Siheung' },
  { ko: '파주시', en: 'Paju' },
  { ko: '김포시', en: 'Gimpo' },
  { ko: '광명시', en: 'Gwangmyeong' },
  { ko: '광주시', en: 'Gwangju (Gyeonggi)' },
  { ko: '군포시', en: 'Gunpo' },
  { ko: '이천시', en: 'Icheon' },
  { ko: '오산시', en: 'Osan' },
  { ko: '하남시', en: 'Hanam' },
  { ko: '양주시', en: 'Yangju' },
  { ko: '구리시', en: 'Guri' },
  { ko: '안성시', en: 'Anseong' },
  { ko: '포천시', en: 'Pocheon' },
  { ko: '의왕시', en: 'Uiwang' },
  { ko: '여주시', en: 'Yeoju' },
  { ko: '양평군', en: 'Yangpyeong' },
  { ko: '동두천시', en: 'Dongducheon' },
  { ko: '과천시', en: 'Gwacheon' },
  { ko: '가평군', en: 'Gapyeong' },
  { ko: '연천군', en: 'Yeoncheon' },

  // === 강원특별자치도 (Gangwon) ===
  { ko: '춘천시', en: 'Chuncheon' },
  { ko: '원주시', en: 'Wonju' },
  { ko: '강릉시', en: 'Gangneung' },
  { ko: '동해시', en: 'Donghae' },
  { ko: '속초시', en: 'Sokcho' },
  { ko: '삼척시', en: 'Samcheok' },
  { ko: '태백시', en: 'Taebaek' },

  // === 충청북도 (Chungcheongbuk-do) ===
  { ko: '청주시', en: 'Cheongju' },
  { ko: '충주시', en: 'Chungju' },
  { ko: '제천시', en: 'Jecheon' },

  // === 충청남도 (Chungcheongnam-do) ===
  { ko: '천안시', en: 'Cheonan' },
  { ko: '공주시', en: 'Gongju' },
  { ko: '아산시', en: 'Asan' },
  { ko: '서산시', en: 'Seosan' },
  { ko: '논산시', en: 'Nonsan' },
  { ko: '당진시', en: 'Dangjin' },

  // === 전라북도 (Jeollabuk-do) ===
  { ko: '전주시', en: 'Jeonju' },
  { ko: '군산시', en: 'Gunsan' },
  { ko: '익산시', en: 'Iksan' },
  { ko: '정읍시', en: 'Jeongeup' },
  { ko: '남원시', en: 'Namwon' },
  { ko: '김제시', en: 'Gimje' },

  // === 전라남도 (Jeollanam-do) ===
  { ko: '목포시', en: 'Mokpo' },
  { ko: '여수시', en: 'Yeosu' },
  { ko: '순천시', en: 'Suncheon' },
  { ko: '나주시', en: 'Naju' },
  { ko: '광양시', en: 'Gwangyang' },

  // === 경상북도 (Gyeongsangbuk-do) ===
  { ko: '포항시', en: 'Pohang' },
  { ko: '경주시', en: 'Gyeongju' },
  { ko: '김천시', en: 'Gimcheon' },
  { ko: '안동시', en: 'Andong' },
  { ko: '구미시', en: 'Gumi' },
  { ko: '영주시', en: 'Yeongju' },
  { ko: '영천시', en: 'Yeongcheon' },
  { ko: '상주시', en: 'Sangju' },

  // === 경상남도 (Gyeongsangnam-do) ===
  { ko: '창원시', en: 'Changwon' },
  { ko: '진주시', en: 'Jinju' },
  { ko: '통영시', en: 'Tongyeong' },
  { ko: '사천시', en: 'Sacheon' },
  { ko: '김해시', en: 'Gimhae' },
  { ko: '밀양시', en: 'Miryang' },
  { ko: '거제시', en: 'Geoje' },
  { ko: '양산시', en: 'Yangsan' },

  // === 제주특별자치도 (Jeju) ===
  { ko: '제주시', en: 'Jeju City' },
  { ko: '서귀포시', en: 'Seogwipo' },
];
