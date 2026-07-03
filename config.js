/**
 * NEMO_CONFIG — 운영 연동·GA 설정
 * Google Apps Script 웹앱 배포 URL을 publishUrl / configUrl에 동일하게 넣으세요.
 * assetBaseUrl: 캠페인 이미지(assets/campaigns/...)가 공개 접근 가능한 사이트 주소
 */
const NEMO_CONFIG = {
  ads: {
    publishUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
    /** 개발 ads SPA (nemoapp.net) */
    devConfigUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL?action=adsConfig&env=dev',
    /** 실서버 ads SPA (nemoapp.kr) */
    prodConfigUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL?action=adsConfig&env=prod',
    assetBaseUrl: '',
    platformDevConfigUrl: 'https://www.nemoapp.net/api/ads-config',
    platformProdConfigUrl: 'https://www.nemoapp.kr/api/ads-config',
  },
  ga: {
    /** 다음 단계: GA4 Data API 프록시 (동일 GAS 웹앱, action=getGaReport) */
    reportSyncUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
    propertyId: 'YOUR_GA4_PROPERTY_ID',
  },
  /** 슬랙 DM — GAS 웹앱 POST action=sendLeadSlackDm (미설정 시 publishUrl 사용) */
  slack: {
    dmUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
  },
};

const LINKS = {
  guide: 'https://drive.google.com/file/d/14_5bEXSv8vpDSojEJogYMc6WXZPDSIQX/view?usp=sharing',
  performanceSheet: 'https://docs.google.com/spreadsheets/d/1ShNC8OVesR1ywX-9P0iFrbWpLxbPOxX3YyTbtXPPbeA/edit?gid=1057949698#gid=1057949698',
  salesSheet: 'https://docs.google.com/spreadsheets/d/1scxyUuU1ReUR6TCvSP5MTvOrH1XbVTt0UPDQZcrL2no/edit?gid=405175726#gid=405175726',
  login: 'https://www.nemoapp.kr/login',
  loginPage: 'account.html',
  campaignCreatePage: 'campaign-create.html',
  loginRedirect: 'https://www.nemoapp.kr/login',
  findAccount: 'https://www.nemoapp.kr',
  signup: 'signup.html',
  advertiserCenterPage: 'account.html',
  signupTerms: {
    memberTerms: 'terms-member.html',
    memberPrivacy: 'terms-member-privacy.html',
    serviceTerms: 'marketing-use-consent.html',
    servicePrivacy: 'marketing-ads-consent.html',
  },
  bookingFlows: {
    mediaMix: 'https://docs.google.com/spreadsheets/d/19r-Npy2dVCCUStHQrhvoE-tlTI0B-MUUPWVQWJYGMLA/edit?gid=263859084#gid=263859084',
  },
};

/** 회원가입 직후 로그인 화면 이메일 자동 입력용 */
const SIGNUP_EMAIL_KEY = 'nemo_signup_email_v1';

document.addEventListener('DOMContentLoaded', () => {
  const guideLink = document.getElementById('guideLink');
  const performanceLink = document.getElementById('performanceLink');

  if (guideLink && LINKS.guide !== 'YOUR_GUIDE_URL') {
    guideLink.href = LINKS.guide;
  }

  if (performanceLink && LINKS.performanceSheet !== 'YOUR_PERFORMANCE_SHEET_URL') {
    performanceLink.href = LINKS.performanceSheet;
  }

  const stickyInquiryLink = document.getElementById('stickyInquiryLink');
  if (stickyInquiryLink && LINKS.campaignCreatePage) {
    stickyInquiryLink.href = LINKS.campaignCreatePage;
    stickyInquiryLink.removeAttribute('target');
    stickyInquiryLink.removeAttribute('rel');
  }
});
