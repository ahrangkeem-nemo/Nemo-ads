/**
 * 구글 시트 연동 스크립트
 *
 * 연결 시트:
 * https://docs.google.com/spreadsheets/d/1LA7HJED44hUexKFIrISoWuslbIGF7gIPYllpMTImMF8/edit
 *
 * 사용 방법:
 * 1. 위 시트 → 확장 프로그램 → Apps Script
 * 2. 이 코드 전체를 붙여넣기
 * 3. setupSheetHeaders() 한 번 실행(1행 헤더 확인)
 * 4. 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 계정: 나
 *    - 액세스: 모든 사용자
 * 5. 배포 URL을 config.js → NEMO_CONFIG.ads.publishUrl 과 script.js → GOOGLE_SCRIPT_URL 에 입력
 */

const SHEET_ID = '1LA7HJED44hUexKFIrISoWuslbIGF7gIPYllpMTImMF8';

const HEADERS = [
  '제출일시',
  '문의 주체',
  '소속 회사',
  '희망 예산(만원)',
  '집행 일정',
  '캠페인 목적',
  '유선 문의 가능 시간대',
  '소재 갯수',
  '연락 가능한 이메일',
  '필수 개인정보 동의',
  '광고성 정보 수신 동의',
  '마케팅 활용 동의',
];

function getInquirySheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'adsConfig') {
    return serveAdsConfig(e);
  }

  if (action === 'gaReport') {
    return serveGaReport(e);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', actions: ['adsConfig', 'gaReport', 'sendLeadSlackDm'] }))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheetHeaders() {
  const sheet = getInquirySheet();
  ensureHeaders(sheet);
}

// ════════════════════════════════════════════════
//  메일 알림 발송 (캠페인 종료 7일 전)
//  POST { action: "sendCampaignEndNotice", to, subject, body }
// ════════════════════════════════════════════════

function handleSendCampaignEndNotice(data) {
  const to      = data.to;
  const subject = data.subject;
  const body    = data.body;

  if (!to || !subject || !body) {
    return { success: false, error: 'to, subject, body 필드가 필요합니다.' };
  }

  MailApp.sendEmail({ to, subject, body });

  // 발송 로그를 시트 두 번째 탭에 기록 (없으면 생성)
  const ss       = SpreadsheetApp.openById(SHEET_ID);
  let logSheet   = ss.getSheetByName('메일발송로그');
  if (!logSheet) {
    logSheet = ss.insertSheet('메일발송로그');
    logSheet.getRange(1, 1, 1, 4).setValues([['발송일시', '받는 사람', '제목', '본문(축약)']]);
    logSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  logSheet.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    to,
    subject,
    body.slice(0, 200),
  ]);

  return { success: true };
}

// ════════════════════════════════════════════════
//  슬랙 DM — 리드 확인 · 세금계산서 요청
//  POST { action: "sendLeadSlackDm", recipientName, messages: ["...", "..."] }
//  Script Properties: SLACK_BOT_TOKEN, SLACK_DM_USER_ID
// ════════════════════════════════════════════════

function getSlackBotToken_() {
  return PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN') || '';
}

function getSlackDmUserId_() {
  return PropertiesService.getScriptProperties().getProperty('SLACK_DM_USER_ID') || '';
}

function openSlackDmChannel_(token, userId) {
  const res = UrlFetchApp.fetch('https://slack.com/api/conversations.open', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ users: userId }),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  if (!json.ok) {
    throw new Error(json.error || 'conversations.open failed');
  }
  return json.channel.id;
}

function postSlackMessage_(token, channel, text) {
  const res = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ channel, text }),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  if (!json.ok) {
    throw new Error(json.error || 'chat.postMessage failed');
  }
}

function handleSendLeadSlackDm(data) {
  const token = getSlackBotToken_();
  const userId = getSlackDmUserId_();
  const messages = Array.isArray(data.messages) ? data.messages.filter(Boolean) : [];

  if (!token) {
    return { success: false, error: 'SLACK_BOT_TOKEN이 설정되지 않았습니다.' };
  }
  if (!userId) {
    return { success: false, error: 'SLACK_DM_USER_ID가 설정되지 않았습니다.' };
  }
  if (!messages.length) {
    return { success: false, error: '전송할 메시지가 없습니다.' };
  }

  try {
    const channel = openSlackDmChannel_(token, userId);
    messages.forEach(function (text) {
      postSlackMessage_(token, channel, text);
    });
    return { success: true, sent: messages.length, recipientName: data.recipientName || '' };
  } catch (err) {
    return { success: false, error: String(err.message || err) };
  }
}

// ════════════════════════════════════════════════
//  운영 광고 설정 — 개발(dev) / 실서버(prod) 분리
//  GET  ?action=adsConfig&env=dev|prod
//  POST { action: "syncCampaignRegistry", registry: {...} }
//  POST { action: "publishAdsConfig", env: "prod", config: {...} }
//  setupAutoDeployTriggers() — 시간 트리거(매시간 개발 자동 반영) 1회 실행
// ════════════════════════════════════════════════

const ADS_CONFIG_PROP_DEV     = 'NEMO_ADS_CONFIG_DEV_JSON';
const ADS_CONFIG_PROP_PROD    = 'NEMO_ADS_CONFIG_PROD_JSON';
const ADS_CONFIG_META_DEV      = 'NEMO_ADS_CONFIG_META_DEV_JSON';
const ADS_CONFIG_META_PROD     = 'NEMO_ADS_CONFIG_META_PROD_JSON';
const ADS_REGISTRY_PROP        = 'NEMO_CAMPAIGNS_REGISTRY_JSON';
const ADS_CONFIG_PROP_LEGACY   = 'NEMO_ADS_CONFIG_JSON';

function getAdsConfigProp(env) {
  return env === 'prod' ? ADS_CONFIG_PROP_PROD : ADS_CONFIG_PROP_DEV;
}

function getRegistry_() {
  const raw = PropertiesService.getScriptProperties().getProperty(ADS_REGISTRY_PROP);
  if (!raw) return { campaigns: [], accounts: [] };
  try { return JSON.parse(raw); }
  catch { return { campaigns: [], accounts: [] }; }
}

function saveRegistry_(registry) {
  PropertiesService.getScriptProperties().setProperty(ADS_REGISTRY_PROP, JSON.stringify(registry));
}

function parseCampaignDate_(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function shouldShowOnDev_(c, now) {
  if (!c || c.status === 'ended') return false;
  const start = parseCampaignDate_(c.startDate);
  const end = parseCampaignDate_(c.endDate);
  if (start && start.getTime() > now.getTime()) return false;
  if (end && end.getTime() < now.getTime()) return false;
  return true;
}

function shouldShowOnProd_(c, now) {
  if (!c || !c.prodPublished) return false;
  return shouldShowOnDev_(c, now);
}

function accountName_(accounts, accountId) {
  const a = (accounts || []).find(function(x) { return String(x.id) === String(accountId); });
  return a ? a.name : '';
}

function buildAdsConfigFromRegistry_(env, now) {
  now = now || new Date();
  var registry = getRegistry_();
  var campaigns = registry.campaigns || [];
  var accounts = registry.accounts || [];
  var pick = env === 'prod' ? shouldShowOnProd_ : shouldShowOnDev_;
  var slots = {};

  campaigns.forEach(function(c) {
    if (!pick(c, now)) return;
    var slot = c.product;
    if (!slot) return;
    if (!slots[slot]) slots[slot] = { web: [], app: [] };

    var itemBase = {
      id: c.id,
      name: c.name || '',
      accountName: accountName_(accounts, c.accountId),
      trackingId: c.trackingId || '',
      trackingIdApp: c.trackingId || '',
      link: c.ctaUrl || '',
      ctaLabel: c.ctaLabel || '자세히 보기',
      priority: Number(c.id) || 0,
      env: env,
    };

    var webUrl = c.webImage || c.appImage || '';
    var appUrl = c.appImage || c.webImage || '';
    if (webUrl) slots[slot].web.push(Object.assign({}, itemBase, { imageUrl: webUrl }));
    if (appUrl) slots[slot].app.push(Object.assign({}, itemBase, { imageUrl: appUrl }));
  });

  Object.keys(slots).forEach(function(key) {
    slots[key].web.sort(function(a, b) { return a.priority - b.priority; });
    slots[key].app.sort(function(a, b) { return a.priority - b.priority; });
  });

  return {
    version: 1,
    env: env,
    updatedAt: Utilities.formatDate(now, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss"),
    slots: slots,
  };
}

function saveAdsConfig_(env, config) {
  var prop = getAdsConfigProp(env);
  var metaProp = env === 'prod' ? ADS_CONFIG_META_PROD : ADS_CONFIG_META_DEV;
  PropertiesService.getScriptProperties().setProperty(prop, JSON.stringify(config));
  PropertiesService.getScriptProperties().setProperty(metaProp, JSON.stringify({
    updatedAt: config.updatedAt,
    env: env,
    publishedBy: config.publishedBy || 'system',
  }));
}

function rebuildDevFromRegistry_(source) {
  var config = buildAdsConfigFromRegistry_('dev');
  config.publishedBy = source || 'auto-schedule';
  saveAdsConfig_('dev', config);
  return config;
}

function handleSyncCampaignRegistry(data) {
  var registry = data.registry;
  if (!registry || !Array.isArray(registry.campaigns)) {
    return { success: false, error: 'registry.campaigns 배열이 필요합니다.' };
  }
  saveRegistry_(registry);
  var devConfig = rebuildDevFromRegistry_('syncCampaignRegistry');
  return {
    success: true,
    updatedAt: devConfig.updatedAt,
    devCampaignCount: countSlotItems_(devConfig),
  };
}

function countSlotItems_(config) {
  var n = 0;
  Object.keys(config.slots || {}).forEach(function(k) {
    n += (config.slots[k].web || []).length;
  });
  return n;
}

function handlePublishAdsConfig(data) {
  var env = data.env === 'prod' ? 'prod' : 'dev';
  var config = data.config;

  if (env === 'prod') {
    if (!config || !config.slots) {
      config = buildAdsConfigFromRegistry_('prod');
    }
    config.publishedBy = data.publishedBy || 'campaign-manage-prod';
    saveAdsConfig_('prod', config);
    return { success: true, updatedAt: config.updatedAt, env: 'prod' };
  }

  if (!config || !config.slots) {
    return { success: false, error: 'config.slots 가 필요합니다.' };
  }
  var updatedAt = config.updatedAt || Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss");
  config.updatedAt = updatedAt;
  config.env = 'dev';
  saveAdsConfig_('dev', config);
  return { success: true, updatedAt: updatedAt, env: 'dev' };
}

function serveAdsConfig(e) {
  var env = (e && e.parameter && e.parameter.env === 'prod') ? 'prod' : 'dev';
  var prop = getAdsConfigProp(env);
  var raw = PropertiesService.getScriptProperties().getProperty(prop);

  if (!raw && env === 'dev') {
    raw = PropertiesService.getScriptProperties().getProperty(ADS_CONFIG_PROP_LEGACY);
  }

  if (!raw) {
    return ContentService
      .createTextOutput(JSON.stringify({ version: 1, env: env, updatedAt: null, slots: {} }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(raw)
    .setMimeType(ContentService.MimeType.JSON);
}

/** Apps Script 편집기에서 1회 실행 → 매시간 개발 자동 배포 트리거 생성 */
function setupAutoDeployTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runScheduledDevDeploy') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('runScheduledDevDeploy')
    .timeBased()
    .everyHours(1)
    .create();
  return { success: true, message: '매시간 개발 자동 배포 트리거가 설정되었습니다.' };
}

/** 시작일·종료일 도래 시 개발 설정 자동 갱신 */
function runScheduledDevDeploy() {
  var config = rebuildDevFromRegistry_('hourly-trigger');
  logDeploy_('개발 자동배포', config.updatedAt, countSlotItems_(config) + '건');
  return config;
}

function logDeploy_(type, updatedAt, note) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var logSheet = ss.getSheetByName('배포로그');
  if (!logSheet) {
    logSheet = ss.insertSheet('배포로그');
    logSheet.getRange(1, 1, 1, 4).setValues([['일시', '유형', '반영 시각', '비고']]);
    logSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  logSheet.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    type,
    updatedAt,
    note,
  ]);
}

// ════════════════════════════════════════════════
//  GA 성과 (다음 단계 — Data API 연동 전 스텁)
//  GET ?action=gaReport&accountId=2&from=2026-06-01&to=2026-06-30
// ════════════════════════════════════════════════

function serveGaReport(e) {
  const params = (e && e.parameter) || {};
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      error: 'GA4 Data API 연동 전입니다. 다음 단계에서 Property ID·서비스 계정을 설정하세요.',
      query: {
        accountId: params.accountId || '',
        from: params.from || '',
        to: params.to || '',
      },
      rows: [],
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// doPost 확장 — 기존 문의 저장 로직과 분기
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'sendCampaignEndNotice') {
      const result = handleSendCampaignEndNotice(data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'syncCampaignRegistry') {
      const result = handleSyncCampaignRegistry(data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'publishAdsConfig') {
      const result = handlePublishAdsConfig(data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'sendLeadSlackDm') {
      const result = handleSendLeadSlackDm(data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 기존 문의 저장
    const sheet = getInquirySheet();
    ensureHeaders(sheet);

    const row = [
      Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      data.inquiryType || '',
      data.company || '',
      data.budget || '',
      data.schedule || '',
      data.purpose || '',
      data.phoneInquiryTime || '',
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
