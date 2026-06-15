// 아래 URL을 실제 주소로 교체하세요
const LINKS = {
  guide: 'https://drive.google.com/file/d/14_5bEXSv8vpDSojEJogYMc6WXZPDSIQX/view?usp=sharing',
  performanceSheet: 'https://docs.google.com/spreadsheets/d/1ShNC8OVesR1ywX-9P0iFrbWpLxbPOxX3YyTbtXPPbeA/edit?gid=1057949698#gid=1057949698',
  login: 'https://www.nemoapp.kr/login',
};

document.addEventListener('DOMContentLoaded', () => {
  const guideLink = document.getElementById('guideLink');
  const performanceLink = document.getElementById('performanceLink');
  const stickyGuideLink = document.getElementById('stickyGuideLink');

  if (guideLink && LINKS.guide !== 'YOUR_GUIDE_URL') {
    guideLink.href = LINKS.guide;
  }

  if (stickyGuideLink && LINKS.guide !== 'YOUR_GUIDE_URL') {
    stickyGuideLink.href = LINKS.guide;
  }

  if (performanceLink && LINKS.performanceSheet !== 'YOUR_PERFORMANCE_SHEET_URL') {
    performanceLink.href = LINKS.performanceSheet;
  }

  const stickyInquiryLink = document.getElementById('stickyInquiryLink');
  if (stickyInquiryLink && LINKS.login) {
    stickyInquiryLink.href = LINKS.login;
  }
});
