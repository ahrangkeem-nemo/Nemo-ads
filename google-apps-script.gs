/**
 * 구글 시트 연동 스크립트
 *
 * 사용 방법:
 * 1. 시트 열기 → 확장 프로그램 → Apps Script
 * 2. 이 코드 전체를 붙여넣기
 * 3. 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 계정: 나
 *    - 액세스: 모든 사용자
 * 4. 배포 URL을 script.js의 GOOGLE_SCRIPT_URL에 입력
 */

const SHEET_ID = '10J83aP59XeG9adDUmeUiUvtRl3eCVhX9_RCz52zxuJo';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];

    const row = [
      Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      data.inquiryType || '',
      data.company || '',
      data.budget || '',
      data.schedule || '',
      data.purpose || '',
      data.materialCount || '',
      data.contactEmail || '',
      data.consentRequired || '',
      data.consentMarketingAds || '',
      data.consentMarketingUse || '',
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheetHeaders() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const headers = [
    '제출일시',
    '문의 주체',
    '소속 회사',
    '희망 예산(만원)',
    '집행 일정',
    '캠페인 목적',
    '소재 갯수',
    '연락 가능한 이메일',
    '필수 개인정보 동의',
    '광고성 정보 수신 동의',
    '마케팅 활용 동의',
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}
