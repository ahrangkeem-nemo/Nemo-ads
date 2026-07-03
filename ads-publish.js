/**
 * ads-publish.js — 개발/실서버 분리 배포
 * - 개발: 시작·종료일 기준 자동 (GAS 시간 트리거 + 저장 시 동기화)
 * - 실서버: 캠페인별 「실서버 배포」 버튼으로만 반영
 */

const ADS_PUBLISH_META_DEV_KEY  = 'nemo_ads_publish_meta_dev_v1';
const ADS_PUBLISH_META_PROD_KEY = 'nemo_ads_publish_meta_prod_v1';

function adsConfigRoot() {
  return typeof NEMO_CONFIG !== 'undefined' && NEMO_CONFIG.ads ? NEMO_CONFIG.ads : {};
}

function publishUrl() {
  return adsConfigRoot().publishUrl || '';
}

function isUrlConfigured(url) {
  return url && !url.includes('YOUR_');
}

function parseCampaignDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 개발 서버 노출 여부 — 시작일 ≤ now ≤ 종료일, 종료 상태 제외 */
function shouldShowOnDev(c, now = Date.now()) {
  if (!c || c.status === 'ended') return false;
  const start = parseCampaignDate(c.startDate);
  const end = parseCampaignDate(c.endDate);
  if (start && start.getTime() > now) return false;
  if (end && end.getTime() < now) return false;
  return true;
}

/** 실서버 노출 — 실서버 배포한 적 있고 + 기간 내 */
function shouldShowOnProd(c, now = Date.now()) {
  if (!c || !c.prodPublished) return false;
  return shouldShowOnDev(c, now);
}

function resolveAssetUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  if (String(src).startsWith('data:')) return '';
  const base = adsConfigRoot().assetBaseUrl || '';
  if (!base) return src;
  return `${base.replace(/\/$/, '')}/${String(src).replace(/^\//, '')}`;
}

function accountLabel(accounts, accountId) {
  const a = (accounts || []).find(x => String(x.id) === String(accountId));
  return a ? a.name : '';
}

function filterCampaignsForEnv(campaigns, env, now = Date.now()) {
  const pick = env === 'prod' ? shouldShowOnProd : shouldShowOnDev;
  return (campaigns || []).filter(c => pick(c, now));
}

/** @returns {object} AdsConfigResponse */
function buildAdsConfig(campaigns, accounts, env = 'dev', now = Date.now()) {
  const slots = {};
  filterCampaignsForEnv(campaigns, env, now).forEach(c => {
    const slot = c.product;
    if (!slot) return;
    if (!slots[slot]) slots[slot] = { web: [], app: [] };

    const itemBase = {
      id: c.id,
      name: c.name || '',
      accountName: accountLabel(accounts, c.accountId),
      trackingId: c.trackingId || '',
      trackingIdApp: c.trackingId || '',
      link: c.ctaUrl || '',
      ctaLabel: c.ctaLabel || '자세히 보기',
      priority: Number(c.id) || 0,
      env,
    };

    const webUrl = resolveAssetUrl(c.webImage || c.appImage);
    const appUrl = resolveAssetUrl(c.appImage || c.webImage);
    if (webUrl) slots[slot].web.push({ ...itemBase, imageUrl: webUrl });
    if (appUrl) slots[slot].app.push({ ...itemBase, imageUrl: appUrl });
  });

  Object.values(slots).forEach(slot => {
    slot.web.sort((a, b) => a.priority - b.priority);
    slot.app.sort((a, b) => a.priority - b.priority);
  });

  return {
    version: 1,
    env,
    updatedAt: new Date().toISOString(),
    slots,
  };
}

function prepareRegistryPayload(campaigns, accounts) {
  return {
    campaigns: (campaigns || []).map(c => ({
      ...c,
      webImage: resolveAssetUrl(c.webImage) || c.webImage || '',
      appImage: resolveAssetUrl(c.appImage) || c.appImage || '',
    })),
    accounts: (accounts || []).map(a => ({ id: a.id, name: a.name })),
    syncedAt: new Date().toISOString(),
  };
}

function loadPublishMeta(env) {
  const key = env === 'prod' ? ADS_PUBLISH_META_PROD_KEY : ADS_PUBLISH_META_DEV_KEY;
  try { return JSON.parse(localStorage.getItem(key)) || null; }
  catch { return null; }
}

function savePublishMeta(env, meta) {
  const key = env === 'prod' ? ADS_PUBLISH_META_PROD_KEY : ADS_PUBLISH_META_DEV_KEY;
  localStorage.setItem(key, JSON.stringify(meta));
}

function renderPublishStatus() {
  const el = document.getElementById('adsPublishStatus');
  if (!el) return;
  const dev = loadPublishMeta('dev');
  const prod = loadPublishMeta('prod');
  const devLabel = dev?.ok
    ? `개발 ${dev.updatedAtLabel || '반영됨'}`
    : (dev?.error ? `개발 실패` : '개발 미동기화');
  const prodLabel = prod?.ok
    ? `실서버 ${prod.updatedAtLabel || '반영됨'}`
    : '실서버 수동 배포';
  el.textContent = `${devLabel} · ${prodLabel}`;
  el.className = `ads-publish-status ${dev?.ok ? 'ads-publish-status--ok' : 'ads-publish-status--idle'}`;
}

function showPublishToast(message, isError) {
  let toast = document.getElementById('adsPublishToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adsPublishToast';
    toast.className = 'ads-publish-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `ads-publish-toast${isError ? ' is-error' : ' is-ok'}`;
  toast.hidden = false;
  clearTimeout(showPublishToast._timer);
  showPublishToast._timer = setTimeout(() => { toast.hidden = true; }, 4000);
}

async function postToGas(body) {
  const url = publishUrl();
  if (!isUrlConfigured(url)) {
    throw new Error('config.js에 Google Apps Script 발행 URL을 설정해 주세요.');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/** 캠페인 목록을 GAS에 저장 + 개발 설정 자동 재계산 */
async function syncCampaignRegistry(campaigns, accounts) {
  try {
    const data = await postToGas({
      action: 'syncCampaignRegistry',
      registry: prepareRegistryPayload(campaigns, accounts),
    });
    const label = new Date().toLocaleString('ko-KR', { hour12: false });
    savePublishMeta('dev', {
      ok: true,
      updatedAt: data.updatedAt || new Date().toISOString(),
      updatedAtLabel: label,
      campaignCount: data.devCampaignCount || 0,
    });
    renderPublishStatus();
    return { success: true, ...data };
  } catch (err) {
    const msg = String(err.message || err);
    savePublishMeta('dev', { ok: false, error: msg, updatedAt: new Date().toISOString() });
    renderPublishStatus();
    return { success: false, error: msg };
  }
}

/** 실서버 설정 발행 (prodPublished 캠페인만) */
async function publishAdsToProd(campaigns, accounts) {
  const config = buildAdsConfig(campaigns, accounts, 'prod');
  try {
    const data = await postToGas({
      action: 'publishAdsConfig',
      env: 'prod',
      config,
    });
    const label = new Date().toLocaleString('ko-KR', { hour12: false });
    savePublishMeta('prod', {
      ok: true,
      updatedAt: data.updatedAt || config.updatedAt,
      updatedAtLabel: label,
      campaignCount: filterCampaignsForEnv(campaigns, 'prod').length,
    });
    renderPublishStatus();
    return { success: true, config };
  } catch (err) {
    const msg = String(err.message || err);
    savePublishMeta('prod', { ok: false, error: msg, updatedAt: new Date().toISOString() });
    renderPublishStatus();
    return { success: false, error: msg };
  }
}

/** 단일 캠페인 실서버 배포 */
async function deployCampaignToProd(campaignId, campaigns, accounts) {
  const idx = campaigns.findIndex(c => c.id === campaignId);
  if (idx === -1) return { success: false, error: '캠페인을 찾을 수 없습니다.' };

  if (!shouldShowOnDev(campaigns[idx])) {
    return { success: false, error: '노출 기간이 아니거나 종료된 캠페인입니다.' };
  }

  campaigns[idx] = {
    ...campaigns[idx],
    prodPublished: true,
    prodPublishedAt: new Date().toISOString(),
  };

  const sync = await syncCampaignRegistry(campaigns, accounts);
  if (!sync.success) return sync;

  const pub = await publishAdsToProd(campaigns, accounts);
  return pub;
}

function getDeployUiState(c) {
  const onDev = shouldShowOnDev(c);
  const onProd = shouldShowOnProd(c);
  const canProdDeploy = shouldShowOnDev(c) && c.status !== 'ended';
  return { onDev, onProd, canProdDeploy };
}
