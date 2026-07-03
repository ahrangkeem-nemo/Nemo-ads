const ACCT_KEY     = 'nemo_ad_accounts_v4';
const CAMPAIGN_KEY = 'nemo_campaigns_v4';
const REPORT_KEY = 'nemo_reports_v1';

const MANUAL_METRICS_PRODUCTS = ['channel-talk', 'app-push'];
const REPORT_HINT_PENDING = '입력 예정중';
const APP_PUSH_METRIC_LABEL = '1회 발송';
const ACCOUNT_TYPE_LABELS = { agency: '광고대행사', partner: '광고주' };
const PRODUCTS = {
  'main-popup': '메인팝업', 'main-banner': '메인배너',
  'list-feed': '리스트피드', 'channel-talk': '채널톡',
  'position-marker': '포지션마커', 'discovery': '디스커버리',
  'endpoint': '엔드포인트', 'app-push': '앱푸시',
};

// 예시 데이터 (제공된 수치 기반 · 일자별)
const DEFAULT_ROWS = [
  { id: 1, accountId: 2, product: 'main-banner', campaignName: '토스플레이스 메인배너', reportDate: '2026-06-28', unitPrice: 2500000, impression: 26573, clicks: 4 },
  { id: 2, accountId: 2, product: 'main-banner', campaignName: '토스플레이스 메인배너', reportDate: '2026-06-29', unitPrice: 2500000, impression: 29432, clicks: 8 },
  { id: 3, accountId: 2, product: 'main-popup',  campaignName: '토스플레이스 메인팝업', reportDate: '2026-06-29', unitPrice: 3000000, impression: 41200, clicks: 52 },
  { id: 4, accountId: 2, product: 'discovery',   campaignName: '토스플레이스 디스커버리', reportDate: '2026-06-30', unitPrice: 1500000, impression: 18900, clicks: 31 },
  { id: 5, accountId: 2, product: 'endpoint',    campaignName: '토스플레이스 엔드포인트', reportDate: '2026-06-30', unitPrice: 1200000, impression: 15300, clicks: 19 },
  { id: 6, accountId: 3, product: 'main-popup',  campaignName: '인테리어 젠틀맨 메인팝업', reportDate: '2026-06-28', unitPrice: 3000000, impression: 38700, clicks: 47 },
  { id: 7, accountId: 3, product: 'main-banner', campaignName: '인테리어 젠틀맨 메인배너', reportDate: '2026-06-29', unitPrice: 2500000, impression: 27100, clicks: 6  },
  { id: 8, accountId: 3, product: 'discovery',   campaignName: '인테리어 젠틀맨 디스커버리', reportDate: '2026-06-30', unitPrice: 1500000, impression: 16200, clicks: 28 },
  { id: 9, accountId: 3, product: 'endpoint',    campaignName: '인테리어 젠틀맨 엔드포인트', reportDate: '2026-06-30', unitPrice: 1200000, impression: 13800, clicks: 22 },
  { id:10, accountId: 4, product: 'endpoint',    campaignName: '무촌철거 엔드포인트', reportDate: '2026-06-28', unitPrice: 1200000, impression: 11500, clicks: 14 },
  { id:11, accountId: 4, product: 'discovery',   campaignName: '무촌철거 디스커버리', reportDate: '2026-06-29', unitPrice: 1500000, impression: 14700, clicks: 25 },
  { id:12, accountId: 4, product: 'position-marker', campaignName: '무촌철거 포지션마커', reportDate: '2026-06-29', unitPrice: 800000, impression: 9800, clicks: 11 },
  { id:13, accountId: 4, product: 'main-popup',  campaignName: '무촌철거 메인팝업', reportDate: '2026-06-30', unitPrice: 3000000, impression: 35400, clicks: 43 },
  { id:14, accountId: 4, product: 'main-banner', campaignName: '무촌철거 메인배너', reportDate: '2026-06-30', unitPrice: 2500000, impression: 24600, clicks: 5  },
  { id: 15, accountId: 2, product: 'channel-talk', campaignName: '토스플레이스 채널톡', reportDate: '2026-06-30', unitPrice: 0, impression: 0, clicks: 0, manualEntered: false },
  { id: 16, accountId: 2, product: 'app-push', campaignName: '토스플레이스 앱푸시', reportDate: '2026-06-30', unitPrice: 800000, impression: 0, clicks: 0 },
];

let accounts      = [];
let campaigns     = [];
let rows          = [];
let filterAccount = '';
let filterAccountType = '';
let filterProduct = '';
let filterDateFrom = '';
let filterDateTo = '';
let editingRowId  = null;
let deletingRowId = null;
let manualFormMode = false;
let nextId        = 100;

// 현재 로그인 세션 (auth.js 의존)
let currentSession = null;

// ─── 로드/저장 ──────────────────────────────────────────
function loadAccounts() {
  if (typeof getSyncedManagerAccounts === 'function') {
    accounts = getSyncedManagerAccounts();
  } else if (typeof getReportFilterPartnerAccounts === 'function') {
    accounts = getReportFilterPartnerAccounts();
  } else {
    try { accounts = JSON.parse(localStorage.getItem(ACCT_KEY)) || []; }
    catch { accounts = []; }
    accounts = accounts.filter(a => a.type === 'partner');
  }
}

function accountTypeLabel(type) {
  return ACCOUNT_TYPE_LABELS[type] || '광고주';
}

function formatAccountOptionLabel(account) {
  return `${account.name} (${accountTypeLabel(account.type)})`;
}

function accountsForReportFilter() {
  let list = accounts;
  if (filterAccountType) list = list.filter(a => a.type === filterAccountType);
  return list;
}

function populateRowAccountSelect() {
  const el = document.getElementById('rfAccount');
  if (!el) return;
  const prev = el.value;
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  el.innerHTML = '<option value="">운영 계정 선택</option>'
    + sorted.map(a => `<option value="${a.id}">${escHtml(formatAccountOptionLabel(a))}</option>`).join('');
  if (prev && sorted.some(a => String(a.id) === String(prev))) el.value = prev;
}

function loadCampaigns() {
  try { campaigns = JSON.parse(localStorage.getItem(CAMPAIGN_KEY)) || []; }
  catch { campaigns = []; }
  if (!campaigns.length && typeof LIVE_CAMPAIGNS !== 'undefined') {
    campaigns = LIVE_CAMPAIGNS.map(c => ({ ...c }));
  }
}

function findCampaignForReportRow(row) {
  if (!row) return null;
  if (row.campaignId) {
    const byId = campaigns.find(c => c.id === row.campaignId);
    if (byId) return byId;
  }
  const name = String(row.campaignName || '').trim();
  if (name) {
    const byName = campaigns.find(c =>
      c.accountId === row.accountId &&
      c.product === row.product &&
      (c.name === name || name.includes(c.name) || c.name.includes(name))
    );
    if (byName) return byName;
  }
  return campaigns.find(c => c.accountId === row.accountId && c.product === row.product) || null;
}

function resolveTrackingId(row) {
  const campaign = findCampaignForReportRow(row);
  return (campaign?.trackingId || row.trackingId || '').trim();
}

function enrichReportRow(row) {
  const campaign = findCampaignForReportRow(row);
  return {
    ...row,
    campaignId: campaign?.id ?? row.campaignId ?? null,
    trackingId: (campaign?.trackingId || row.trackingId || '').trim(),
  };
}
function todayDateStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeReportRow(row, index) {
  const product = row.product || 'main-banner';
  const dayOffsets = [0, 1, 1, 2, 2, 0, 1, 2, 2, 0, 1, 1, 2, 2];
  const base = new Date('2026-06-28');
  base.setDate(base.getDate() + (dayOffsets[index] ?? 2));
  const fallbackDate = base.toISOString().slice(0, 10);
  const fallbackName = row.campaignName
    || `${acctName(row.accountId) !== '—' ? acctName(row.accountId) + ' ' : ''}${PRODUCTS[product] || product}`.trim();

  return {
    ...row,
    product,
    campaignName: fallbackName,
    reportDate: row.reportDate || fallbackDate,
  };
}

function loadRows() {
  loadCampaigns();
  try { rows = JSON.parse(localStorage.getItem(REPORT_KEY)); }
  catch { rows = null; }
  if (!Array.isArray(rows) || !rows.length) {
    rows = DEFAULT_ROWS.map(r => ({ ...r }));
  } else {
    rows = rows.map((r, i) => normalizeReportRow(r, i));
  }
  rows = rows.map(enrichReportRow);
  ensureManualDemoRows();
  nextId = Math.max(...rows.map(r => r.id), 0) + 1;
  saveRows();
}
function saveRows() { localStorage.setItem(REPORT_KEY, JSON.stringify(rows)); }

function ensureManualDemoRows() {
  DEFAULT_ROWS
    .filter(r => MANUAL_METRICS_PRODUCTS.includes(r.product))
    .forEach(defaultRow => {
      if (!rows.some(r => r.id === defaultRow.id)) {
        rows.push(enrichReportRow({ ...defaultRow }));
      }
    });
  rows = rows.map(r => {
    if (r.product === 'channel-talk' && r.manualEntered !== true) {
      return enrichReportRow({ ...r, manualEntered: false });
    }
    return enrichReportRow(r);
  });
}

// ─── 유틸 ───────────────────────────────────────────────
function acctName(id) {
  const a = accounts.find(a => a.id === id);
  return a ? a.name : '—';
}
function fmtNum(n) { return Number(n).toLocaleString('ko-KR'); }
function calcMetrics(impression, clicks, unitPrice) {
  const imp  = Number(impression) || 0;
  const clk  = Number(clicks) || 0;
  const unit = Number(unitPrice) || 0;
  const ctr  = imp > 0 ? ((clk / imp) * 100).toFixed(2) + '%' : '—';
  const cpc  = clk > 0 ? fmtNum(Math.round(unit / clk)) : '—';
  const cpm  = imp > 0 ? fmtNum(Math.round((unit / imp) * 1000)) : '—';
  return { ctr, cpc, cpm };
}
function isManagerView() {
  return currentSession?.role !== 'advertiser';
}

function isAppPushRow(row) {
  return row?.product === 'app-push';
}

function isChannelTalkRow(row) {
  return row?.product === 'channel-talk';
}

function isChannelTalkPending(row) {
  return isChannelTalkRow(row) && row.manualEntered !== true;
}

function contributesToImpClkTotals(row) {
  if (isAppPushRow(row)) return false;
  if (isChannelTalkPending(row)) return false;
  return true;
}

function renderPendingHintCell() {
  return `<td class="text-right"><span class="report-cell-hint">${REPORT_HINT_PENDING}</span></td>`;
}

function isManualInputProduct(product) {
  return MANUAL_METRICS_PRODUCTS.includes(product);
}

function renderReportActionsCell(r) {
  if (!isManagerView()) return '';

  if (isChannelTalkPending(r)) {
    return `
        <td class="report-table-col-actions">
          <button type="button" class="btn btn-primary btn--xs" data-action="edit" data-id="${r.id}">입력하기</button>
        </td>`;
  }

  if (isAppPushRow(r)) {
    return `
        <td class="report-table-col-actions">
          <div class="report-row-actions">
            <button type="button" class="btn btn-outline btn--xs" data-action="edit" data-id="${r.id}">발송 정보 수정</button>
            <button type="button" class="manage-action-btn manage-action-btn--danger" data-action="delete" data-id="${r.id}" aria-label="삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </td>`;
  }

  const editLabel = isChannelTalkRow(r) ? '성과 수정' : '편집';
  return `
        <td class="report-table-col-actions">
          <div class="report-row-actions">
            <button type="button" class="btn btn-outline btn--xs" data-action="edit" data-id="${r.id}">${editLabel}</button>
            <button type="button" class="manage-action-btn manage-action-btn--danger" data-action="delete" data-id="${r.id}" aria-label="삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </td>`;
}

function renderReportRowHtml(r) {
  const baseCells = `
        <td>${escHtml(acctName(r.accountId))}</td>
        <td><span class="report-campaign-name">${escHtml(campaignLabel(r))}</span></td>
        <td><span class="report-tracking-id">${escHtml(r.trackingId || '—')}</span></td>`;

  if (isAppPushRow(r)) {
    return `
      <tr class="report-row report-row--app-push">
        ${baseCells}
        <td class="text-right">${fmtNum(r.unitPrice)}</td>
        <td colspan="5" class="report-app-push-metric">${APP_PUSH_METRIC_LABEL}</td>
        ${renderReportActionsCell(r)}
      </tr>`;
  }

  if (isChannelTalkPending(r)) {
    return `
      <tr class="report-row report-row--channel-talk-pending">
        ${baseCells}
        ${renderPendingHintCell()}
        ${renderPendingHintCell()}
        ${renderPendingHintCell()}
        ${renderPendingHintCell()}
        ${renderPendingHintCell()}
        ${renderPendingHintCell()}
        ${renderReportActionsCell(r)}
      </tr>`;
  }

  const m = calcMetrics(r.impression, r.clicks, r.unitPrice);
  return `
      <tr class="report-row">
        ${baseCells}
        <td class="text-right">${fmtNum(r.unitPrice)}</td>
        <td class="text-right">${fmtNum(r.impression)}</td>
        <td class="text-right">${fmtNum(r.clicks)}</td>
        <td class="text-right report-ctr">${m.ctr}</td>
        <td class="text-right">${m.cpc}</td>
        <td class="text-right">${m.cpm}</td>
        ${renderReportActionsCell(r)}
      </tr>`;
}

function setManagerSectionVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  if (visible) el.removeAttribute('hidden');
}

function applyReportRoleUi() {
  const isAdvertiser = currentSession?.role === 'advertiser';
  document.body.classList.toggle('report-view--advertiser', isAdvertiser);
  document.body.classList.toggle('report-view--manager', !isAdvertiser);

  setManagerSectionVisible(document.getElementById('reportManagerBar'), !isAdvertiser);
  setManagerSectionVisible(document.getElementById('reportTypeTabs'), !isAdvertiser);
}

function initReportTypeTabs() {
  const tabs = document.getElementById('reportTypeTabs');
  if (!tabs || !isManagerView()) return;

  tabs.addEventListener('click', e => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    filterAccountType = btn.dataset.type || '';
    tabs.querySelectorAll('.acct-type-tab').forEach(tab => {
      const active = tab.dataset.type === filterAccountType;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    populateAccountSelects();
    renderTable();
  });
}

function setProductSelectOptions(productSelect, manualOnly) {
  if (!productSelect) return;
  Array.from(productSelect.options).forEach(opt => {
    if (!opt.value) {
      opt.hidden = false;
      return;
    }
    opt.hidden = manualOnly && !isManualInputProduct(opt.value);
  });
}

function updateRowFormLayout() {
  const product = document.getElementById('rfProduct')?.value || '';
  const notice = document.getElementById('rfManualNotice');
  const metricsSection = document.getElementById('rfMetricsSection');
  const appPushSection = document.getElementById('rfAppPushSection');
  const manualMeta = document.getElementById('rfManualMetaSection');
  const saveBtn = document.getElementById('rowModalSaveBtn');
  const productSelect = document.getElementById('rfProduct');
  const isManual = isManualInputProduct(product);
  const isAppPush = product === 'app-push';
  const isChannelTalk = product === 'channel-talk';

  setProductSelectOptions(productSelect, manualFormMode && !editingRowId);

  if (manualMeta) manualMeta.hidden = !isManual;
  if (metricsSection) metricsSection.hidden = isAppPush;
  if (appPushSection) appPushSection.hidden = !isAppPush;

  const accountHint = document.getElementById('rfAccountHint');
  if (accountHint) accountHint.hidden = !isManual;

  if (isManual) populateRowAccountSelect();

  if (notice) {
    if (isAppPush) {
      notice.hidden = false;
      notice.textContent = '앱푸시는 1회 발송 기준입니다. 단가와 발송 정보를 입력하면 광고주에게 「1회 발송」으로 표시됩니다.';
    } else if (isChannelTalk) {
      notice.hidden = false;
      notice.textContent = '채널톡은 GA/빅쿼리에서 수집되지 않습니다. 채널톡 관리자에서 확인한 노출·클릭 수치를 입력하세요.';
    } else {
      notice.hidden = true;
      notice.textContent = '';
    }
  }

  if (saveBtn) {
    if (isAppPush) saveBtn.textContent = '발송 정보 저장';
    else if (isChannelTalk) saveBtn.textContent = '성과 반영';
    else saveBtn.textContent = '저장';
  }

  if (productSelect) productSelect.disabled = Boolean(editingRowId);
  updateCalcPreview();
}

function openManualReportModal(presetProduct = 'channel-talk') {
  manualFormMode = true;
  openRowModal(null, presetProduct);
}

function campaignLabel(row) {
  return row.campaignName || PRODUCTS[row.product] || row.product || '—';
}

function defaultCampaignName(accountId, product) {
  const acct = accounts.find(a => a.id === accountId);
  const prod = PRODUCTS[product] || product;
  return acct ? `${acct.name} ${prod}` : prod;
}

function parseDateStr(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isDateInFilterRange(reportDate) {
  if (!filterDateFrom && !filterDateTo) return true;
  const date = parseDateStr(reportDate);
  if (!date) return false;
  const from = parseDateStr(filterDateFrom);
  const to = parseDateStr(filterDateTo);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function getReportDateRangeLabel() {
  if (filterDateFrom && filterDateTo) {
    if (filterDateFrom === filterDateTo) return fmtReportDate(filterDateFrom);
    return `${fmtReportDate(filterDateFrom)} ~ ${fmtReportDate(filterDateTo)}`;
  }
  if (filterDateFrom) return `${fmtReportDate(filterDateFrom)} ~`;
  if (filterDateTo) return `~ ${fmtReportDate(filterDateTo)}`;
  return '전체 기간';
}

function syncReportDateRangeInputs() {
  const fromEl = document.getElementById('reportFilterDateFrom');
  const toEl = document.getElementById('reportFilterDateTo');
  const maxDate = todayDateStr();
  [fromEl, toEl].forEach(el => {
    if (el) el.max = maxDate;
  });
  if (fromEl && filterDateFrom) fromEl.value = filterDateFrom;
  if (toEl && filterDateTo) toEl.value = filterDateTo;
}

function normalizeReportDateRange() {
  if (!filterDateFrom || !filterDateTo) return;
  if (filterDateFrom > filterDateTo) {
    const tmp = filterDateFrom;
    filterDateFrom = filterDateTo;
    filterDateTo = tmp;
  }
}

function handleReportDateRangeChange() {
  const fromEl = document.getElementById('reportFilterDateFrom');
  const toEl = document.getElementById('reportFilterDateTo');
  filterDateFrom = fromEl?.value || '';
  filterDateTo = toEl?.value || '';
  normalizeReportDateRange();
  syncReportDateRangeInputs();
  renderTable();
}

function getFilteredRows() {
  let filtered = rows;

  if (currentSession && currentSession.role === 'advertiser') {
    filtered = filtered.filter(r => r.accountId === currentSession.accountId);
  } else if (filterAccount) {
    filtered = filtered.filter(r => r.accountId === Number(filterAccount));
  }
  if (filterProduct) filtered = filtered.filter(r => r.product === filterProduct);
  if (filterAccountType) {
    filtered = filtered.filter(r => {
      const acct = accounts.find(a => a.id === r.accountId);
      return acct?.type === filterAccountType;
    });
  }
  filtered = filtered.filter(r => isDateInFilterRange(r.reportDate));

  return filtered.map(enrichReportRow);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtReportDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${y}.${m}.${d}`;
}

// ─── 요약 카드 ──────────────────────────────────────────
function renderSummary(filtered) {
  const metricRows = filtered.filter(contributesToImpClkTotals);
  const totalImp  = metricRows.reduce((s, r) => s + (r.impression || 0), 0);
  const totalClk  = metricRows.reduce((s, r) => s + (r.clicks || 0), 0);
  const totalBudg = filtered.reduce((s, r) => s + (r.unitPrice || 0), 0);
  const avgCtr    = totalImp > 0 ? ((totalClk / totalImp) * 100).toFixed(2) : '0.00';

  document.getElementById('reportSummaryCards').innerHTML = `
    <div class="report-stat-card">
      <p class="report-stat-label">총 Impression</p>
      <p class="report-stat-value">${fmtNum(totalImp)}</p>
    </div>
    <div class="report-stat-card">
      <p class="report-stat-label">총 Clicks</p>
      <p class="report-stat-value">${fmtNum(totalClk)}</p>
    </div>
    <div class="report-stat-card">
      <p class="report-stat-label">평균 CTR</p>
      <p class="report-stat-value">${avgCtr}%</p>
    </div>
    <div class="report-stat-card">
      <p class="report-stat-label">집행 단가 합계</p>
      <p class="report-stat-value">${fmtNum(totalBudg)}원</p>
    </div>`;
}

// ─── 테이블 렌더 ────────────────────────────────────────
function renderTable() {
  const filtered = getFilteredRows();

  renderSummary(filtered);

  const tbody = document.getElementById('reportTbody');
  const empty = document.getElementById('reportEmpty');

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(r => renderReportRowHtml(r)).join('');
}

// ─── 계정 선택 옵션 ─────────────────────────────────────
function populateAccountSelects() {
  const sorted = [...accountsForReportFilter()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const opts = sorted.map(a => `<option value="${a.id}">${escHtml(formatAccountOptionLabel(a))}</option>`).join('');
  const filterEl = document.getElementById('reportFilterAccount');
  if (filterEl) {
    const prev = filterAccount;
    filterEl.innerHTML = '<option value="">전체 계정</option>' + opts;
    if (prev && sorted.some(a => String(a.id) === String(prev))) {
      filterEl.value = prev;
    } else if (prev) {
      filterAccount = '';
    }
  }
  populateRowAccountSelect();
}

// ─── 행 추가/편집 모달 ──────────────────────────────────
function syncCampaignNameField() {
  const accountId = Number(document.getElementById('rfAccount').value);
  const product = document.getElementById('rfProduct').value;
  const nameInput = document.getElementById('rfCampaignName');
  if (!nameInput || !accountId || !product) return;
  if (!nameInput.dataset.userEdited) {
    nameInput.value = defaultCampaignName(accountId, product);
  }
}

function openRowModal(rowId = null, presetProduct = '') {
  const row = rowId ? rows.find(r => r.id === rowId) : null;
  if (rowId && !manualFormMode) manualFormMode = isManualInputProduct(row?.product);

  editingRowId = rowId;
  const campaignInput = document.getElementById('rfCampaignName');
  const enteredByInput = document.getElementById('rfEnteredBy');
  const sourceNoteInput = document.getElementById('rfSourceNote');
  const productSelect = document.getElementById('rfProduct');

  let modalTitle = '성과 데이터 추가';
  if (row) {
    if (isChannelTalkPending(row)) modalTitle = '채널톡 성과 입력';
    else if (isAppPushRow(row)) modalTitle = '앱푸시 발송 정보 수정';
    else if (isChannelTalkRow(row)) modalTitle = '채널톡 성과 수정';
    else modalTitle = '성과 데이터 편집';
  } else if (presetProduct === 'app-push') {
    modalTitle = '앱푸시 발송 등록';
  } else if (presetProduct === 'channel-talk' || manualFormMode) {
    modalTitle = '채널톡 성과 입력';
  }

  document.getElementById('rowModalTitle').textContent = modalTitle;
  document.getElementById('rfReportDate').value = row
    ? row.reportDate
    : (filterDateTo || filterDateFrom || todayDateStr());
  document.getElementById('rfAccount').value = row ? row.accountId : '';
  document.getElementById('rfProduct').value = row
    ? row.product
    : (presetProduct || (manualFormMode ? 'channel-talk' : ''));
  document.getElementById('rfUnitPrice').value = row ? row.unitPrice : '';
  document.getElementById('rfImpression').value = row && !isChannelTalkPending(row) ? row.impression : '';
  document.getElementById('rfClicks').value = row && !isChannelTalkPending(row) ? row.clicks : '';
  if (campaignInput) {
    const product = row?.product || presetProduct || productSelect?.value || '';
    const accountId = row?.accountId || Number(document.getElementById('rfAccount').value);
    campaignInput.value = row
      ? (row.campaignName || defaultCampaignName(row.accountId, row.product))
      : (accountId && product ? defaultCampaignName(accountId, product) : '');
    campaignInput.dataset.userEdited = row ? '1' : '';
  }
  if (sourceNoteInput) sourceNoteInput.value = row?.sourceNote || '';
  if (enteredByInput) {
    enteredByInput.value = row?.enteredBy || currentSession?.name || '';
  }

  updateRowFormLayout();

  const overlay = document.getElementById('rowModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}
function closeRowModal() {
  const overlay = document.getElementById('rowModalOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
  editingRowId = null;
  manualFormMode = false;
  const productSelect = document.getElementById('rfProduct');
  if (productSelect) productSelect.disabled = false;
  setProductSelectOptions(productSelect, false);
}

function updateCalcPreview() {
  const imp  = Number(document.getElementById('rfImpression').value) || 0;
  const clk  = Number(document.getElementById('rfClicks').value) || 0;
  const unit = Number(document.getElementById('rfUnitPrice').value) || 0;
  if (!imp && !clk) { document.getElementById('rfCalcPreview').textContent = '—'; return; }
  const m = calcMetrics(imp, clk, unit);
  document.getElementById('rfCalcPreview').textContent = `CTR ${m.ctr}  CPC ${m.cpc}  CPM ${m.cpm}`;
}

function saveRow() {
  const reportDate = document.getElementById('rfReportDate').value;
  const accountId = Number(document.getElementById('rfAccount').value);
  const product = document.getElementById('rfProduct').value;
  const campaignName = document.getElementById('rfCampaignName').value.trim()
    || defaultCampaignName(accountId, product);
  const unitPrice = Number(document.getElementById('rfUnitPrice').value) || 0;
  const impression = Number(document.getElementById('rfImpression').value) || 0;
  const clicks = Number(document.getElementById('rfClicks').value) || 0;
  const sourceNote = document.getElementById('rfSourceNote')?.value.trim() || '';
  const enteredBy = document.getElementById('rfEnteredBy')?.value.trim()
    || currentSession?.name
    || '';

  if (!reportDate || !accountId || !product || !campaignName) {
    alert('조회 일자, 운영 계정, 광고 캠페인, 캠페인 유형을 입력하세요.');
    return;
  }

  if (!accounts.some(a => a.id === accountId)) {
    alert('운영 계정을 선택해 주세요.');
    return;
  }

  if (product === 'channel-talk' && !impression && !clicks) {
    alert('채널톡은 Impression 또는 Clicks 중 하나 이상 입력해 주세요.');
    return;
  }

  if (product === 'app-push' && !unitPrice) {
    alert('앱푸시 단가를 입력해 주세요.');
    return;
  }

  const draft = {
    reportDate,
    accountId,
    product,
    campaignName,
    unitPrice,
    impression: product === 'app-push' ? 0 : impression,
    clicks: product === 'app-push' ? 0 : clicks,
    sourceNote: isManualInputProduct(product) ? sourceNote : undefined,
    enteredBy: isManualInputProduct(product) ? enteredBy : undefined,
    enteredAt: isManualInputProduct(product) ? new Date().toISOString() : undefined,
    manualEntered: product === 'channel-talk' ? true : undefined,
    appPushSent: product === 'app-push' ? true : undefined,
  };
  const enriched = enrichReportRow(draft);

  if (editingRowId) {
    const idx = rows.findIndex(r => r.id === editingRowId);
    if (idx > -1) {
      rows[idx] = { ...rows[idx], ...enriched };
    }
  } else {
    rows.push({ id: nextId++, ...enriched });
  }
  saveRows();
  renderTable();
  closeRowModal();
}

// ─── 삭제 ───────────────────────────────────────────────
function openDeleteModal(rowId) {
  deletingRowId = rowId;
  const overlay = document.getElementById('rowDeleteOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}
function closeDeleteModal() {
  const overlay = document.getElementById('rowDeleteOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; deletingRowId = null; }, 220);
}
function confirmDelete() {
  rows = rows.filter(r => r.id !== deletingRowId);
  saveRows();
  renderTable();
  closeDeleteModal();
}

// ─── 엑셀 내보내기 (SheetJS) ─────────────────────────────
function exportExcel() {
  const exportRows = getFilteredRows();
  const rangeLabel = getReportDateRangeLabel().replace(/[.~\s]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    || todayDateStr().replace(/-/g, '');

  const sheetData = [
    ['조회 기간', getReportDateRangeLabel()],
    ['광고주', '광고 캠페인', 'Tracking ID', '일자', '단가', 'Impression', 'Clicks', 'CTR(%)', 'CPC', 'CPM'],
    ...exportRows.map(r => {
      if (isAppPushRow(r)) {
        return [
          acctName(r.accountId),
          campaignLabel(r),
          r.trackingId || '—',
          fmtReportDate(r.reportDate),
          r.unitPrice,
          APP_PUSH_METRIC_LABEL,
          '',
          '',
          '',
          '',
        ];
      }
      if (isChannelTalkPending(r)) {
        return [
          acctName(r.accountId),
          campaignLabel(r),
          r.trackingId || '—',
          fmtReportDate(r.reportDate),
          REPORT_HINT_PENDING,
          REPORT_HINT_PENDING,
          REPORT_HINT_PENDING,
          REPORT_HINT_PENDING,
          REPORT_HINT_PENDING,
          REPORT_HINT_PENDING,
        ];
      }
      const m = calcMetrics(r.impression, r.clicks, r.unitPrice);
      return [
        acctName(r.accountId),
        campaignLabel(r),
        r.trackingId || '—',
        fmtReportDate(r.reportDate),
        r.unitPrice,
        r.impression,
        r.clicks,
        m.ctr,
        m.cpc,
        m.cpm,
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '성과보고서');

  const fileName = currentSession?.role === 'advertiser'
    ? `성과보고서_${currentSession.name}_${rangeLabel}.xlsx`
    : `성과보고서_${rangeLabel}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

function renderAdvertiserTaxPanel() {
  const panel = document.getElementById('advertiserTaxPanel');
  const tbody = document.getElementById('advertiserTaxTbody');
  const empty = document.getElementById('advertiserTaxEmpty');
  if (!panel || !tbody || !empty) return;

  if (!currentSession || currentSession.role !== 'advertiser' || !currentSession.accountId) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  const invoices = getAdvertiserTaxInvoices(currentSession.accountId);

  if (!invoices.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = invoices.map(row => `
    <tr>
      <td>${escHtml(formatSettlementMonthLabel(row.settleMonth))}</td>
      <td>${escHtml(formatSettlementWonShort(row.requestAmount))}</td>
      <td>${escHtml(getSettlementIssueDate(row.settleMonth, row))}</td>
      <td>
        <a class="advertiser-tax-download" href="${row.taxInvoiceFileData}" download="${escHtml(row.taxInvoiceFileName || '세금계산서.pdf')}">
          ${escHtml(row.taxInvoiceFileName || '세금계산서.pdf')} 다운로드
        </a>
      </td>
    </tr>`).join('');
}

// ─── 이벤트 ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 세션 로드
  if (typeof getSession === 'function') {
    currentSession = getSession();
  }

  loadAccounts();
  loadCampaigns();
  loadRows();
  populateAccountSelects();

  filterDateTo = todayDateStr();
  filterDateFrom = filterDateTo;
  syncReportDateRangeInputs();

  // 광고주: 조회 전용 UI
  applyReportRoleUi();
  initReportTypeTabs();
  if (currentSession && currentSession.role === 'advertiser') {
    document.getElementById('reportFilterAccount').style.display = 'none';
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadAccounts();
      populateAccountSelects();
      loadCampaigns();
      renderTable();
    }
  });

  renderAdvertiserTaxPanel();
  renderTable();

  document.getElementById('reportFilterAccount').addEventListener('change', e => {
    filterAccount = e.target.value; renderTable();
  });
  document.getElementById('reportFilterProduct').addEventListener('change', e => {
    filterProduct = e.target.value; renderTable();
  });
  document.getElementById('reportFilterDateFrom')?.addEventListener('change', handleReportDateRangeChange);
  document.getElementById('reportFilterDateTo')?.addEventListener('change', handleReportDateRangeChange);

  document.getElementById('rfAccount').addEventListener('change', () => {
    syncCampaignNameField();
    updateRowFormLayout();
  });
  document.getElementById('rfProduct').addEventListener('change', () => {
    syncCampaignNameField();
    updateRowFormLayout();
  });
  document.getElementById('rfCampaignName').addEventListener('input', e => {
    e.target.dataset.userEdited = e.target.value.trim() ? '1' : '';
  });

  document.getElementById('addAppPushBtn')?.addEventListener('click', () => {
    openManualReportModal('app-push');
  });

  document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);

  // 테이블 액션 (매니저만)
  if (isManagerView()) {
    document.getElementById('reportTbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'edit')   openRowModal(id);
      if (btn.dataset.action === 'delete') openDeleteModal(id);
    });
  }

  // 모달 실시간 계산
  ['rfImpression', 'rfClicks', 'rfUnitPrice'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCalcPreview);
  });

  // 저장
  document.getElementById('rowModalSaveBtn').addEventListener('click', saveRow);
  document.getElementById('rowModalCancelBtn').addEventListener('click', closeRowModal);
  document.getElementById('rowModalCloseBtn').addEventListener('click', closeRowModal);
  document.getElementById('rowModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRowModal();
  });

  // 삭제
  document.getElementById('rowDeleteConfirmBtn').addEventListener('click', confirmDelete);
  document.getElementById('rowDeleteCancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('rowDeleteCloseBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('rowDeleteOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeRowModal(); closeDeleteModal(); }
  });
});
