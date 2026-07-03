/**
 * 라이브 캠페인 시드 — platform_v3_fe_ads 운영 소스에서 추출
 * (Popup / MainBanner / Discovery / EndPoint 컴포넌트 기준)
 */
const LIVE_CAMPAIGN_URLS = {
  tossplace: 'https://tossplace.com/contact/46175?referrer=bm_internet_nemo_2603&utm_source=nemo&utm_medium=all&utm_campaign=conversion_bm_cpa&utm_term=conversion_internet_banner_260313&utm_content=conversion_internet_banner_260313_all',
  gentleman: 'https://interiorgentleman.com/_nemo2',
  muchon: 'https://muchon.kr/nemo',
  suwon: 'https://www.i-park.com/suwoncity/selling',
};

const LIVE_CAMPAIGN_DEFAULTS = {
  status: 'active',
  startDate: '2026-03-01T00:00',
  endDate: '2026-12-31T23:59',
  desc: '',
  bgColorMode: 'solid',
  bgColor1: '#ffffff',
  bgColor2: '#eeeeee',
  ctaLabel: '자세히 보기',
  ctaLinkType: 'external',
  createdAt: '2026-03-01',
};

function liveCampaign(row) {
  const { advertiserKey, trackingIdApp, ...rest } = row;
  const ctaColor = row.accountId === 2 ? '#0064FF' : '#333333';
  return {
    ...LIVE_CAMPAIGN_DEFAULTS,
    ...rest,
    ctaColor,
    ctaUrl: row.ctaUrl || LIVE_CAMPAIGN_URLS[advertiserKey],
    trackingId: row.trackingId || '',
  };
}

/** @type {Array<object>} */
const LIVE_CAMPAIGNS = [
  // ── 토스플레이스 (accountId: 2) ──
  liveCampaign({
    id: 1, accountId: 2, advertiserKey: 'tossplace',
    name: '토스플레이스 메인팝업', product: 'main-popup',
    webImage: 'assets/campaigns/tossplace/main-popup.jpg',
    appImage: 'assets/campaigns/tossplace/main-popup.jpg',
    trackingId: 'AD0107', trackingIdApp: 'AD0108',
  }),
  liveCampaign({
    id: 2, accountId: 2, advertiserKey: 'tossplace',
    name: '토스플레이스 메인배너', product: 'main-banner',
    webImage: 'assets/campaigns/tossplace/main-banner-web.jpg',
    appImage: 'assets/campaigns/tossplace/main-banner-app.png',
    trackingId: 'AD0105', trackingIdApp: 'AD0106',
  }),
  liveCampaign({
    id: 3, accountId: 2, advertiserKey: 'tossplace',
    name: '토스플레이스 디스커버리', product: 'discovery',
    webImage: 'assets/campaigns/tossplace/discovery.jpg',
    appImage: 'assets/campaigns/tossplace/discovery.jpg',
    trackingId: 'AD0109', trackingIdApp: 'AD0110',
  }),
  liveCampaign({
    id: 4, accountId: 2, advertiserKey: 'tossplace',
    name: '토스플레이스 엔드포인트', product: 'endpoint',
    webImage: 'assets/campaigns/tossplace/endpoint.jpg',
    appImage: 'assets/campaigns/tossplace/endpoint.jpg',
    trackingId: 'AD0111', trackingIdApp: 'AD0112',
  }),

  // ── 인테리어 젠틀맨 (accountId: 3) ──
  liveCampaign({
    id: 5, accountId: 3, advertiserKey: 'gentleman',
    name: '인테리어 젠틀맨 메인팝업', product: 'main-popup',
    webImage: 'assets/campaigns/gentleman/main-popup.jpg',
    appImage: 'assets/campaigns/gentleman/main-popup.jpg',
    trackingId: 'AD0035', trackingIdApp: 'AD0036',
  }),
  liveCampaign({
    id: 6, accountId: 3, advertiserKey: 'gentleman',
    name: '인테리어 젠틀맨 메인배너', product: 'main-banner',
    webImage: 'assets/campaigns/gentleman/main-banner-web.png',
    appImage: 'assets/campaigns/gentleman/main-banner-app.png',
    trackingId: 'AD0029', trackingIdApp: 'AD0030',
  }),
  liveCampaign({
    id: 7, accountId: 3, advertiserKey: 'gentleman',
    name: '인테리어 젠틀맨 디스커버리', product: 'discovery',
    webImage: 'assets/campaigns/gentleman/discovery.jpg',
    appImage: 'assets/campaigns/gentleman/discovery.jpg',
    trackingId: 'AD0031', trackingIdApp: 'AD0032',
  }),
  liveCampaign({
    id: 8, accountId: 3, advertiserKey: 'gentleman',
    name: '인테리어 젠틀맨 엔드포인트', product: 'endpoint',
    webImage: 'assets/campaigns/gentleman/endpoint.jpg',
    appImage: 'assets/campaigns/gentleman/endpoint.jpg',
    trackingId: 'AD0033', trackingIdApp: 'AD0034',
  }),

  // ── 무촌철거 (accountId: 4) ──
  liveCampaign({
    id: 9, accountId: 4, advertiserKey: 'muchon',
    name: '무촌철거 엔드포인트', product: 'endpoint',
    webImage: 'assets/campaigns/muchon/endpoint.jpg',
    appImage: 'assets/campaigns/muchon/endpoint.jpg',
    trackingId: 'AD0134', trackingIdApp: 'AD0135',
  }),
  liveCampaign({
    id: 10, accountId: 4, advertiserKey: 'muchon',
    name: '무촌철거 디스커버리', product: 'discovery',
    webImage: 'assets/campaigns/muchon/discovery.jpg',
    appImage: 'assets/campaigns/muchon/discovery.jpg',
    trackingId: 'AD0132', trackingIdApp: 'AD0133',
  }),
  liveCampaign({
    id: 11, accountId: 4, advertiserKey: 'muchon',
    name: '무촌철거 포지션마커', product: 'position-marker',
    webImage: 'assets/campaigns/muchon/position-marker-web.png',
    appImage: 'assets/campaigns/muchon/position-marker-app.png',
    trackingId: 'AD0128', trackingIdApp: 'AD0129',
  }),
  liveCampaign({
    id: 12, accountId: 4, advertiserKey: 'muchon',
    name: '무촌철거 메인팝업', product: 'main-popup',
    webImage: 'assets/campaigns/muchon/main-popup.jpg',
    appImage: 'assets/campaigns/muchon/main-popup.jpg',
    trackingId: 'AD0130', trackingIdApp: 'AD0131',
  }),
  liveCampaign({
    id: 13, accountId: 4, advertiserKey: 'muchon',
    name: '무촌철거 메인배너', product: 'main-banner',
    webImage: 'assets/campaigns/muchon/main-banner-web.png',
    appImage: 'assets/campaigns/muchon/main-banner-app.png',
    trackingId: 'AD0128', trackingIdApp: 'AD0129',
  }),

];
