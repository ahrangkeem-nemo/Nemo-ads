// ─── 정산 관리 ───────────────────────────────────────────

const SETTLEMENT_KEY = 'nemo_settlements_v1';
const LEAD_SLACK_RECIPIENT = '현아님';

const SETTLE_CYCLE = {
  month_start: { label: '매월 초', day: 1 },
  month_end:   { label: '매월 말', day: 'last' },
};

const TAX_STATUS = {
  needed:   { label: '발행 필요', cls: 'settle-status--warn' },
  issued:   { label: '발행 완료', cls: 'settle-status--done' },
  pending:  { label: '발행 예정', cls: 'settle-status--pending' },
};

const PAY_STATUS = {
  paid:     { label: '입금 완료', cls: 'settle-status--done' },
  waiting:  { label: '입금 대기', cls: 'settle-status--warn' },
  partial:  { label: '부분 입금', cls: 'settle-status--pending' },
};

const SETTLE_TYPE_LABELS = { agency: '광고대행사', partner: '광고주' };

function isAgencySettleRow(row) {
  return row.accountType === 'agency';
}

const SETTLE_FILTERS = {
  lead: {
    label: '리드 확인 필요',
    cls: 'settlement-filter-tab--lead',
    match: row => !isAgencySettleRow(row) && row.taxStatus === 'needed' && !row.leadSlackConfirmed,
    actionId: 'leadSlackOpenBtn',
  },
  tax: {
    label: '세금계산서 발행 필요',
    cls: 'settlement-filter-tab--tax',
    match: row => row.taxStatus === 'needed' && (isAgencySettleRow(row) || row.leadSlackConfirmed),
    actionId: 'settleBulkTaxIssued',
  },
  pay: {
    label: '입금 확인 필요',
    cls: 'settlement-filter-tab--pay',
    match: row => (isAgencySettleRow(row) || row.leadSlackConfirmed)
      && row.taxStatus === 'issued'
      && (row.payStatus === 'waiting' || row.payStatus === 'partial'),
    actionId: 'settleBulkPayPaid',
  },
};

let settlementRows = [];
let selectedMonth = getCurrentMonthKey();
let selectedSettleFilter = 'all';
let filterSettleAccountId = null;
let selectedSettleAccountType = '';
let selectedRowKeys = new Set();

function enrichSettlementRow(raw) {
  const profile = getSettlementAccountProfile(raw.accountId);
  return {
    ...profile,
    ...raw,
    accountType: profile.accountType,
  };
}

const DEFAULT_SETTLEMENT_ROWS = [
  { accountId: 2, settleMonth: '2026-05', requestAmount: 550000, supplyAmount: 500000, taxAmount: 50000, taxStatus: 'issued', payStatus: 'paid' },
  { accountId: 3, settleMonth: '2026-05', requestAmount: 22000, supplyAmount: 20000, taxAmount: 2000, taxStatus: 'issued', payStatus: 'paid' },
  { accountId: 4, settleMonth: '2026-05', requestAmount: 88000, supplyAmount: 80000, taxAmount: 8000, taxStatus: 'issued', payStatus: 'paid' },
  { accountId: 2, settleMonth: '2026-06', requestAmount: 550000, supplyAmount: 500000, taxAmount: 50000, taxStatus: 'issued', payStatus: 'paid' },
  { accountId: 3, settleMonth: '2026-06', requestAmount: 20000, supplyAmount: 20000, taxAmount: 2000, taxStatus: 'needed', payStatus: 'paid' },
  { accountId: 4, settleMonth: '2026-06', requestAmount: 110000, supplyAmount: 100000, taxAmount: 10000, taxStatus: 'pending', payStatus: 'waiting' },
  { accountId: 2, settleMonth: '2026-07', requestAmount: 550000, supplyAmount: 500000, taxAmount: 50000, taxStatus: 'needed', payStatus: 'paid', leadSlackConfirmed: false },
  { accountId: 3, settleMonth: '2026-07', requestAmount: 22000, supplyAmount: 20000, taxAmount: 2000, taxStatus: 'needed', payStatus: 'paid', leadSlackConfirmed: false },
  { accountId: 4, settleMonth: '2026-07', requestAmount: 110000, supplyAmount: 100000, taxAmount: 10000, taxStatus: 'needed', payStatus: 'waiting', leadSlackConfirmed: false },
];

function rowKey(row) {
  return `${row.accountId}-${row.settleMonth}`;
}

const SETTLEMENT_DEMO_SYNC_KEYS = new Set(['2-2026-07', '3-2026-07', '4-2026-07']);
const SETTLEMENT_DEMO_SYNC_FIELDS = [
  'taxStatus',
  'payStatus',
  'requestAmount',
  'supplyAmount',
  'taxAmount',
  'leadSlackConfirmed',
  'leadSlackConfirmedAt',
];

function getSettlementSeedValue(seed, field) {
  if (field === 'leadSlackConfirmed') return !!seed.leadSlackConfirmed;
  return seed[field] ?? '';
}

function applySettlementIssueDate(row) {
  if (!row?.settleMonth) return false;
  const next = getSettlementIssueDate(row.settleMonth, row);
  if (row.issueDate === next) return false;
  row.issueDate = next;
  return true;
}

function normalizeSettlementIssueDates(rows) {
  return rows.some(applySettlementIssueDate);
}

function syncSettlementDemoSeed(merged, defaultByKey) {
  let synced = false;
  merged.forEach(row => {
    if (!SETTLEMENT_DEMO_SYNC_KEYS.has(rowKey(row))) return;
    const seed = defaultByKey.get(rowKey(row));
    if (!seed) return;
    SETTLEMENT_DEMO_SYNC_FIELDS.forEach(field => {
      const seedVal = getSettlementSeedValue(seed, field);
      if (row[field] !== seedVal) {
        row[field] = seedVal;
        synced = true;
      }
    });
  });
  return synced;
}

function purgeUnsettlementRows(rows) {
  const allowed = new Set(getSettlementAccountIds());
  return rows.filter(r => allowed.has(r.accountId));
}

function loadSettlements() {
  const defaultRows = DEFAULT_SETTLEMENT_ROWS.map(r => {
    const row = enrichSettlementRow(r);
    applySettlementIssueDate(row);
    return row;
  });

  let stored = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTLEMENT_KEY));
    if (Array.isArray(parsed) && parsed.length) stored = parsed;
  } catch { /* ignore */ }

  if (!stored.length) {
    settlementRows = defaultRows;
    saveSettlements();
    return;
  }

  let merged = purgeUnsettlementRows(stored.map(r => enrichSettlementRow(r)));
  const existingKeys = new Set(merged.map(rowKey));
  const defaultByKey = new Map(defaultRows.map(r => [rowKey(r), r]));
  let added = false;
  defaultRows.forEach(row => {
    if (!existingKeys.has(rowKey(row))) {
      merged.push(row);
      added = true;
    }
  });

  const synced = syncSettlementDemoSeed(merged, defaultByKey);
  const issueDatesSynced = normalizeSettlementIssueDates(merged);
  const purged = merged.length !== stored.length;

  merged.sort((a, b) => {
    const monthCmp = a.settleMonth.localeCompare(b.settleMonth);
    return monthCmp !== 0 ? monthCmp : a.accountId - b.accountId;
  });

  settlementRows = merged;
  if (added || synced || issueDatesSynced || purged) saveSettlements();
}

function saveSettlements() {
  localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(
    settlementRows.map(r => ({
      accountId: r.accountId,
      accountType: r.accountType || getSettlementAccountProfile(r.accountId).accountType,
      settleMonth: r.settleMonth,
      requestAmount: r.requestAmount,
      supplyAmount: r.supplyAmount,
      taxAmount: r.taxAmount,
      issueDate: getSettlementIssueDate(r.settleMonth, r),
      taxStatus: r.taxStatus,
      payStatus: r.payStatus,
      requestAmountManwon: r.requestAmountManwon || '',
      leadSlackConfirmed: !!r.leadSlackConfirmed,
      leadSlackConfirmedAt: r.leadSlackConfirmedAt || '',
      taxInvoiceFileName: r.taxInvoiceFileName || '',
      taxInvoiceFileData: r.taxInvoiceFileData || '',
      taxInvoiceUploadedAt: r.taxInvoiceUploadedAt || '',
    }))
  ));
}

function findRow(key) {
  return settlementRows.find(r => rowKey(r) === key);
}

function updateRowField(key, field, value) {
  const row = findRow(key);
  if (!row) return;
  row[field] = value;
  saveSettlements();
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCurrentMonthKey(refDate = new Date()) {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

function formatMonthLabel(key) {
  const { year, month } = parseMonthKey(key);
  return `${year}년 ${month}월`;
}

function shiftMonthKey(key, delta) {
  const { year, month } = parseMonthKey(key);
  const d = new Date(year, month - 1 + delta, 1);
  return getCurrentMonthKey(d);
}

function getRowsByMonth(monthKey) {
  return settlementRows
    .filter(r => r.settleMonth === monthKey)
    .filter(r => !selectedSettleAccountType || r.accountType === selectedSettleAccountType)
    .filter(r => !filterSettleAccountId || r.accountId === filterSettleAccountId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function getSettleTypeCounts(monthKey = selectedMonth) {
  const rows = settlementRows.filter(r => r.settleMonth === monthKey);
  return {
    all: rows.length,
    agency: rows.filter(r => r.accountType === 'agency').length,
    partner: rows.filter(r => r.accountType === 'partner').length,
  };
}

function rowMatchesAnyActionFilter(row) {
  return Object.values(SETTLE_FILTERS).some(filter => filter.match(row));
}

function getActionRequiredRows(monthKey = selectedMonth) {
  return getRowsByMonth(monthKey).filter(rowMatchesAnyActionFilter);
}

function getFilteredRows(monthKey = selectedMonth) {
  if (selectedSettleFilter === 'all') {
    return getActionRequiredRows(monthKey);
  }
  const rows = getRowsByMonth(monthKey);
  const filter = SETTLE_FILTERS[selectedSettleFilter];
  if (!filter) return rows;
  return rows.filter(filter.match);
}

function getSelectedRowsInMonth() {
  return getFilteredRows().filter(r => selectedRowKeys.has(rowKey(r)));
}

function formatWonShort(n) {
  if (n >= 10000 && n % 10000 === 0) return `${n / 10000}만원`;
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function formatWonDetail(n) {
  if (n >= 10000 && n % 10000 === 0) return `${n / 10000}만원`;
  if (n >= 1000 && n % 1000 === 0) {
    const man = Math.floor(n / 10000);
    const cheon = (n % 10000) / 1000;
    return `${man > 0 ? `${man}만 ` : ''}${cheon}천원`.replace(/^ /, '');
  }
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function getNextSettleDate(cycle, refDate = new Date()) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);

  if (cycle === 'month_start') {
    let d = new Date(y, m, 1);
    if (d < today) d = new Date(y, m + 1, 1);
    return d;
  }

  let d = new Date(y, m + 1, 0);
  if (d < today) d = new Date(y, m + 2, 0);
  return d;
}

function daysUntilSettle(cycle, refDate = new Date()) {
  const next = getNextSettleDate(cycle, refDate);
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
}

function formatSettleDateShort(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getSettleCycleLabel(cycle) {
  return SETTLE_CYCLE[cycle]?.label || cycle;
}

function enrichRow(row) {
  const nextDate = getNextSettleDate(row.settleCycle);
  const days = daysUntilSettle(row.settleCycle);
  return { ...row, nextSettleDate: nextDate, daysUntilSettle: days };
}

function renderStatusSelect(map, field, row) {
  const key = rowKey(row);
  const current = row[field];
  const cls = map[current]?.cls || 'settle-status--pending';
  const options = Object.entries(map).map(([value, meta]) =>
    `<option value="${value}"${value === current ? ' selected' : ''}>${escHtml(meta.label)}</option>`
  ).join('');
  return `
    <select class="settle-status-select ${cls}" data-row-key="${escHtml(key)}" data-field="${field}" aria-label="${field === 'taxStatus' ? '세금계산서 발행 현황' : '입금 현황'}">
      ${options}
    </select>`;
}

function getRowRequestAmountBreakdown(row) {
  const manwon = parseAmountManwon(row.requestAmountManwon);
  if (!manwon) return null;
  const requestWon = manwon * 10000;
  const { supply, tax } = calcTaxBreakdownFromRequestWon(requestWon);
  return { requestWon, supply, tax };
}

function renderAmountCell(row) {
  const breakdown = getRowRequestAmountBreakdown(row);
  if (!breakdown) {
    return '<span class="settle-amount-empty">—</span>';
  }
  return `
    <div class="settle-amount">
      <strong class="settle-amount-main">${escHtml(formatWonShort(breakdown.requestWon))}</strong>
      <span class="settle-amount-sub">(공급가액 ${escHtml(formatWonDetail(breakdown.supply))} + 세액 ${escHtml(formatWonDetail(breakdown.tax))})</span>
    </div>`;
}

function renderSettleDateCell(row) {
  const enriched = enrichRow(row);
  const urgent = enriched.daysUntilSettle <= 7;
  const daysLabel = enriched.daysUntilSettle === 0 ? 'D-Day' : `D-${enriched.daysUntilSettle}`;
  return `
    <div class="settle-date-cell">
      <strong>${escHtml(getSettleCycleLabel(row.settleCycle))}</strong>
      <span class="settle-date-sub">다음 ${escHtml(formatSettleDateShort(enriched.nextSettleDate))}</span>
      ${urgent ? `<span class="settle-date-alarm">${daysLabel}</span>` : ''}
    </div>`;
}

function renderTaxInvoiceCell(row) {
  if (row.taxStatus !== 'needed') {
    return '<span class="settle-cell-empty">—</span>';
  }

  const key = rowKey(row);
  const inputId = `settleTaxFile-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const dropAttrs = `class="settle-tax-invoice-cell settle-tax-dropzone" data-row-key="${escHtml(key)}"`;
  if (row.taxInvoiceFileData) {
    return `
      <div ${dropAttrs}>
        <span class="settle-tax-file-name" title="${escHtml(row.taxInvoiceFileName || '세금계산서.pdf')}">${escHtml(row.taxInvoiceFileName || '세금계산서.pdf')}</span>
        <a class="settle-tax-download" href="${row.taxInvoiceFileData}" download="${escHtml(row.taxInvoiceFileName || '세금계산서.pdf')}">미리보기</a>
        <button type="button" class="settle-tax-upload-btn" data-settle-action="tax-upload" data-input-id="${escHtml(inputId)}">교체</button>
        <span class="settle-tax-drop-hint">PDF를 끌어다 놓아도 교체됩니다</span>
        <input type="file" class="settle-tax-file-input" id="${escHtml(inputId)}" data-row-key="${escHtml(key)}" accept=".pdf,application/pdf" hidden>
      </div>`;
  }
  return `
    <div ${dropAttrs}>
      <p class="settle-tax-drop-hint">세금계산서 발행 후, 끌어다 넣어주세요</p>
      <button type="button" class="settle-tax-upload-btn settle-tax-upload-btn--primary" data-settle-action="tax-upload" data-input-id="${escHtml(inputId)}">파일 선택</button>
      <input type="file" class="settle-tax-file-input" id="${escHtml(inputId)}" data-row-key="${escHtml(key)}" accept=".pdf,application/pdf" hidden>
    </div>`;
}

function applyTaxInvoiceFile(rowKey, file) {
  if (!file || !rowKey) return;

  const row = findRow(rowKey);
  if (!row || row.taxStatus !== 'needed') return;

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    showSettleToast('PDF 파일만 업로드할 수 있습니다.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showSettleToast('5MB 이하 PDF만 업로드할 수 있습니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = ev => {
    const targetRow = findRow(rowKey);
    if (!targetRow) return;
    targetRow.taxInvoiceFileName = file.name;
    targetRow.taxInvoiceFileData = ev.target.result;
    targetRow.taxInvoiceUploadedAt = new Date().toISOString();
    saveSettlements();
    renderTable(getFilteredRows());
    showSettleToast('세금계산서가 등록되었습니다.');
  };
  reader.readAsDataURL(file);
}

function handleTaxInvoiceUpload(input) {
  applyTaxInvoiceFile(input.dataset.rowKey, input.files?.[0]);
  input.value = '';
}

function clearTaxDropzoneHighlight() {
  document.querySelectorAll('.settle-tax-dropzone.is-dragover').forEach(el => {
    el.classList.remove('is-dragover');
  });
}

function initTaxInvoiceUpload() {
  const table = document.getElementById('settlementTable');
  if (!table || table.dataset.taxUploadBound) return;
  table.dataset.taxUploadBound = '1';

  table.addEventListener('click', e => {
    const uploadBtn = e.target.closest('[data-settle-action="tax-upload"]');
    if (!uploadBtn) return;
    const input = document.getElementById(uploadBtn.dataset.inputId);
    input?.click();
  });

  table.addEventListener('change', e => {
    const input = e.target.closest('.settle-tax-file-input');
    if (input) handleTaxInvoiceUpload(input);
  });

  table.addEventListener('dragover', e => {
    const zone = e.target.closest('.settle-tax-dropzone');
    if (!zone) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    clearTaxDropzoneHighlight();
    zone.classList.add('is-dragover');
  });

  table.addEventListener('dragleave', e => {
    const zone = e.target.closest('.settle-tax-dropzone');
    if (!zone || zone.contains(e.relatedTarget)) return;
    zone.classList.remove('is-dragover');
  });

  table.addEventListener('drop', e => {
    const zone = e.target.closest('.settle-tax-dropzone');
    if (!zone) return;
    e.preventDefault();
    clearTaxDropzoneHighlight();
    applyTaxInvoiceFile(zone.dataset.rowKey, e.dataTransfer?.files?.[0]);
  });

  document.addEventListener('dragend', clearTaxDropzoneHighlight);
}

function renderExternalLink(url, label, cls) {
  if (!url) return '<span class="settle-sheet-empty">—</span>';
  return `
    <a class="settle-sheet-link settle-sheet-link--compact ${cls || ''}" href="${escHtml(url)}" target="_blank" rel="noopener">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      ${escHtml(label)}
    </a>`;
}

function renderFilterTabs(monthRows) {
  const el = document.getElementById('settlementSummary');
  if (!el) return;
  el.className = 'settlement-filter-tabs';
  el.setAttribute('role', 'tablist');
  const allCount = monthRows.filter(rowMatchesAnyActionFilter).length;
  const allActive = selectedSettleFilter === 'all' ? ' is-active' : '';
  const allTab = `
    <button type="button" class="settlement-filter-tab settlement-filter-tab--all${allActive}" data-filter="all" role="tab" aria-selected="${selectedSettleFilter === 'all'}">
      <span class="settlement-filter-tab-label">전체</span>
      <strong class="settlement-filter-tab-count">${allCount}건</strong>
    </button>`;
  const statusTabs = Object.entries(SETTLE_FILTERS).map(([key, filter]) => {
    const count = monthRows.filter(filter.match).length;
    const active = selectedSettleFilter === key ? ' is-active' : '';
    return `
      <button type="button" class="settlement-filter-tab ${filter.cls}${active}" data-filter="${key}" role="tab" aria-selected="${selectedSettleFilter === key}">
        <span class="settlement-filter-tab-label">${escHtml(filter.label)}</span>
        <strong class="settlement-filter-tab-count">${count}건</strong>
      </button>`;
  }).join('');
  el.innerHTML = allTab + statusTabs;
  syncSettleBulkActions();
  syncSettleTableColumns();
}

function initSettleFilterTabs() {
  const el = document.getElementById('settlementSummary');
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1';
  el.addEventListener('click', e => {
    const tab = e.target.closest('.settlement-filter-tab');
    if (!tab) return;
    const next = tab.dataset.filter;
    if (!next || next === selectedSettleFilter) return;
    selectedSettleFilter = next;
    selectedRowKeys.clear();
    renderMonthView();
  });
}

function shouldShowLeadShareColumn() {
  return selectedSettleAccountType !== 'agency';
}

function shouldShowTaxInvoiceColumn() {
  return selectedSettleFilter === 'tax';
}

function syncSettleTableColumns() {
  const showTax = shouldShowTaxInvoiceColumn();
  const showLead = shouldShowLeadShareColumn();
  document.querySelectorAll('.settle-col-tax-invoice').forEach(el => {
    el.hidden = !showTax;
  });
  document.querySelectorAll('.settle-col-lead-share').forEach(el => {
    el.hidden = !showLead;
  });
}

function renderSettleTypeBar() {
  const counts = getSettleTypeCounts();
  const allEl = document.getElementById('settleStatAll');
  const agencyEl = document.getElementById('settleStatAgency');
  const partnerEl = document.getElementById('settleStatPartner');
  if (allEl) allEl.textContent = counts.all;
  if (agencyEl) agencyEl.textContent = counts.agency;
  if (partnerEl) partnerEl.textContent = counts.partner;
  document.querySelectorAll('#settleTypeTabs .acct-type-tab').forEach(btn => {
    const active = btn.dataset.type === selectedSettleAccountType;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function initSettleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const accountId = Number(params.get('accountId'));
  if (!accountId) return;

  filterSettleAccountId = accountId;
  const profile = getSettlementAccountProfile(accountId);
  selectedSettleAccountType = profile.accountType || '';

  const topbar = document.querySelector('.manage-topbar-title');
  if (topbar && profile.name) {
    const note = document.createElement('p');
    note.className = 'manage-topbar-note';
    note.textContent = `${profile.name} (${SETTLE_TYPE_LABELS[profile.accountType] || '계정'}) 정산만 보고 있습니다.`;
    topbar.appendChild(note);
  }
}

function initSettleTypeTabs() {
  const el = document.getElementById('settleTypeTabs');
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1';
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    const next = btn.dataset.type;
    if (next === selectedSettleAccountType) return;
    selectedSettleAccountType = next;
    selectedRowKeys.clear();
    if (selectedSettleAccountType === 'agency' && selectedSettleFilter === 'lead') {
      selectedSettleFilter = 'all';
    }
    renderMonthView();
  });
}

function syncLeadSlackOpenBtn() {
  const btn = document.getElementById('leadSlackOpenBtn');
  if (!btn) return;
  const count = getSelectedLeadSlackRows().length;
  btn.disabled = selectedSettleFilter === 'lead' && count === 0;
  btn.textContent = count > 0 ? `리드 확인 완료 (${count})` : '리드 확인 완료';
}

function syncSettleBulkActions() {
  Object.entries(SETTLE_FILTERS).forEach(([key, filter]) => {
    const btn = document.getElementById(filter.actionId);
    if (!btn) return;
    const show = selectedSettleFilter === key;
    btn.hidden = !show;
    btn.classList.toggle('is-hidden', !show);
    btn.style.display = show ? '' : 'none';
  });
}

function updateBulkBar() {
  const countEl = document.getElementById('settleSelectedCount');
  const count = getSelectedRowsInMonth().length;
  if (countEl) {
    countEl.textContent = `${count}건 선택`;
    countEl.hidden = count === 0;
  }

  syncSettleBulkActions();
  syncSettleTableColumns();
  syncLeadSlackOpenBtn();

  const visibleRows = getFilteredRows();
  const checkAll = document.getElementById('settleCheckAll');
  if (checkAll && visibleRows.length) {
    checkAll.checked = count > 0 && count === visibleRows.length;
    checkAll.indeterminate = count > 0 && count < visibleRows.length;
  } else if (checkAll) {
    checkAll.checked = false;
    checkAll.indeterminate = false;
  }
}

function applyBulkUpdate(field, value) {
  const selected = getSelectedRowsInMonth();
  if (!selected.length) return;
  selected.forEach(row => {
    row[field] = value;
  });
  saveSettlements();
  selectedRowKeys.clear();
  renderMonthView();
}

function syncSelectStyle(select) {
  const map = select.dataset.field === 'taxStatus' ? TAX_STATUS : PAY_STATUS;
  select.className = 'settle-status-select ' + (map[select.value]?.cls || 'settle-status--pending');
}

function renderTable(rows) {
  const tbody = document.getElementById('settlementTbody');
  const empty = document.getElementById('settlementEmpty');
  const table = document.getElementById('settlementTable');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    empty.style.display = '';
    const emptyText = empty.querySelector('p');
    if (emptyText) {
      const label = selectedSettleFilter === 'all'
        ? '처리 필요'
        : (SETTLE_FILTERS[selectedSettleFilter]?.label || '해당');
      emptyText.textContent = `${label} 건이 없습니다.`;
    }
    updateBulkBar();
    syncSettleTableColumns();
    return;
  }

  table.style.display = '';
  empty.style.display = 'none';
  const showTaxInvoiceCol = shouldShowTaxInvoiceColumn();
  const showLeadShareCol = shouldShowLeadShareColumn();
  tbody.innerHTML = rows.map(row => {
    const key = rowKey(row);
    const checked = selectedRowKeys.has(key);
    return `
    <tr class="${checked ? 'settle-row--selected' : ''}">
      <td class="settle-td-check">
        <input type="checkbox" class="settle-row-check" data-row-key="${escHtml(key)}"${checked ? ' checked' : ''} aria-label="${escHtml(row.name)} 선택">
      </td>
      <td class="manage-td-name">
        <span class="manage-campaign-name">${escHtml(row.name)}</span>
      </td>
      <td><a class="settle-email" href="mailto:${escHtml(row.email)}">${escHtml(row.email)}</a></td>
      ${showLeadShareCol ? `<td class="settle-col-lead-share">${renderExternalLink(row.leadShareUrl, '리드 공유', 'settle-lead-link')}</td>` : ''}
      ${showTaxInvoiceCol ? `<td class="settle-col-tax-invoice">${renderTaxInvoiceCell(row)}</td>` : ''}
      <td>${renderAmountCell(row)}</td>
      <td class="settle-address">${escHtml(row.address)}</td>
      <td>${renderSettleDateCell(row)}</td>
      <td class="manage-td-date">${escHtml(getSettlementIssueDate(row.settleMonth, row))}</td>
      <td>${renderStatusSelect(TAX_STATUS, 'taxStatus', row)}</td>
      <td>${renderStatusSelect(PAY_STATUS, 'payStatus', row)}</td>
    </tr>`;
  }).join('');
  updateBulkBar();
}

function updateMonthPickerUI() {
  const label = document.getElementById('settleMonthLabel');
  const sub = document.getElementById('settleMonthSub');
  const todayBtn = document.getElementById('settleMonthToday');
  if (label) label.textContent = formatMonthLabel(selectedMonth);
  if (sub) {
    sub.textContent = selectedMonth === getCurrentMonthKey() ? '이번 달' : '선택한 달';
  }
  if (todayBtn) {
    todayBtn.hidden = selectedMonth === getCurrentMonthKey();
  }
}

function renderMonthView() {
  renderSettleTypeBar();
  const monthRows = getRowsByMonth(selectedMonth);
  updateMonthPickerUI();
  renderFilterTabs(monthRows);
  renderTable(getFilteredRows());
}

function initMonthPicker() {
  document.getElementById('settleMonthPrev')?.addEventListener('click', () => {
    selectedMonth = shiftMonthKey(selectedMonth, -1);
    selectedRowKeys.clear();
    renderMonthView();
  });
  document.getElementById('settleMonthNext')?.addEventListener('click', () => {
    selectedMonth = shiftMonthKey(selectedMonth, 1);
    selectedRowKeys.clear();
    renderMonthView();
  });
  document.getElementById('settleMonthToday')?.addEventListener('click', () => {
    selectedMonth = getCurrentMonthKey();
    selectedRowKeys.clear();
    renderMonthView();
  });
}

function initBulkActions() {
  document.getElementById('settleCheckAll')?.addEventListener('change', e => {
    const monthRows = getFilteredRows();
    if (e.target.checked) {
      monthRows.forEach(r => selectedRowKeys.add(rowKey(r)));
    } else {
      monthRows.forEach(r => selectedRowKeys.delete(rowKey(r)));
    }
    renderTable(getFilteredRows());
  });

  document.getElementById('settleBulkTaxIssued')?.addEventListener('click', () => {
    applyBulkUpdate('taxStatus', 'issued');
  });
  document.getElementById('settleBulkPayPaid')?.addEventListener('click', () => {
    applyBulkUpdate('payStatus', 'paid');
  });

  document.getElementById('settlementTbody')?.addEventListener('change', e => {
    const check = e.target.closest('.settle-row-check');
    if (check) {
      const key = check.dataset.rowKey;
      if (check.checked) selectedRowKeys.add(key);
      else selectedRowKeys.delete(key);
      renderTable(getFilteredRows());
      return;
    }

    const select = e.target.closest('.settle-status-select');
    if (select) {
      updateRowField(select.dataset.rowKey, select.dataset.field, select.value);
      syncSelectStyle(select);
      renderFilterTabs(getRowsByMonth(selectedMonth));
      renderTable(getFilteredRows());
    }
  });
}

function initMasterSheetLink() {
  const btn = document.getElementById('masterSalesSheetBtn');
  if (!btn) return;
  const url = (typeof LINKS !== 'undefined' && LINKS.salesSheet) || '#';
  btn.href = url;
}

function showSettleToast(message) {
  let toast = document.getElementById('settleCopyToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'settleCopyToast';
    toast.className = 'booking-copy-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function copyTextToClipboard(text, successMessage) {
  navigator.clipboard.writeText(text).then(() => {
    showSettleToast(successMessage);
  }).catch(() => {
    window.prompt('아래 내용을 복사해 주세요.', text);
  });
}

function getLeadSlackApiUrl() {
  const root = typeof NEMO_CONFIG !== 'undefined' ? NEMO_CONFIG : {};
  const url = root.slack?.dmUrl || root.ads?.publishUrl || '';
  if (!url || url.includes('YOUR_')) return '';
  return url;
}

function getSelectedLeadSlackRows() {
  return getSelectedRowsInMonth().filter(SETTLE_FILTERS.lead.match);
}

function parseAmountManwon(val) {
  const num = Number(String(val ?? '').replace(/,/g, ''));
  return Number.isNaN(num) ? 0 : num;
}

function formatWonPlain(n) {
  return Number(n).toLocaleString('ko-KR');
}

function calcTaxBreakdownFromRequestWon(requestWon) {
  const supply = Math.round(requestWon / 1.1);
  const tax = requestWon - supply;
  return { supply, tax };
}

function getLeadShareLink(row) {
  if (!row) return '';
  return row.leadShareUrl || getSettlementAccountProfile(row.accountId).leadShareUrl || '';
}

function renderLeadShareLinkHtml(row, label = '리드 공유') {
  const url = getLeadShareLink(row);
  if (!url) return '<span class="lead-slack-link-empty">리드 공유 링크 없음</span>';
  return `<a class="settle-sheet-link settle-sheet-link--compact settle-lead-link" href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(label)}</a>`;
}

function buildLeadSlackPreviewText(row, amountManwon) {
  const manwon = parseAmountManwon(amountManwon);
  const leadLink = getLeadShareLink(row) || '링크 없음';
  const address = row.address || '—';
  const issueDate = getSettlementIssueDate(row.settleMonth, row);

  if (!manwon) {
    return `리드 확인 : ${leadLink}
요청금액(만원, VAT 포함)을 입력하면 나머지 항목이 생성됩니다.`;
  }

  const requestWon = manwon * 10000;
  const { supply, tax } = calcTaxBreakdownFromRequestWon(requestWon);

  return `리드 확인 : ${leadLink}
요청 금액 : ${formatWonPlain(requestWon)}원
공급가액 : ${formatWonPlain(supply)} 원 + 세액 ${formatWonPlain(tax)} 원
사업자 주소 : ${address}
발행일자 : ${issueDate}`;
}

function collectLeadSlackFormItems() {
  const list = document.getElementById('leadSlackList');
  if (!list) return [];
  return [...list.querySelectorAll('.lead-slack-item')].map(rowEl => {
    const key = rowEl.dataset.rowKey;
    const row = findRow(key);
    if (!row) return null;
    const amountInput = rowEl.querySelector('.lead-slack-amount-input');
    const amountManwon = amountInput?.value.trim() || row.requestAmountManwon || '';
    return {
      rowKey: key,
      company: row.name || '—',
      amountManwon,
      previewText: buildLeadSlackPreviewText(row, amountManwon),
    };
  }).filter(Boolean);
}

function updateLeadSlackPreviews() {
  document.querySelectorAll('.lead-slack-item').forEach(rowEl => {
    const preview = rowEl.querySelector('.lead-slack-item-preview');
    if (!preview) return;

    const key = rowEl.dataset.rowKey;
    const row = findRow(key);
    const amountInput = rowEl.querySelector('.lead-slack-amount-input');
    const amountManwon = amountInput?.value.trim() || '';
    if (row) preview.value = buildLeadSlackPreviewText(row, amountManwon);
  });
}

function renderLeadSlackList(rows) {
  const list = document.getElementById('leadSlackList');
  const empty = document.getElementById('leadSlackEmpty');
  if (!list || !empty) return;

  if (!rows.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = rows.map(row => {
    const key = rowKey(row);
    const amountValue = row.requestAmountManwon || '';
    const refAmount = row.requestAmount
      ? `표 요청금액 ${formatWonShort(row.requestAmount)}`
      : '표 요청금액 —';
    const previewText = buildLeadSlackPreviewText(row, amountValue);
    return `
      <div class="lead-slack-item" data-row-key="${escHtml(key)}">
        <div class="lead-slack-item-row lead-slack-item-row--selected">
          <div class="lead-slack-item-main">
            <span class="lead-slack-item-name">${escHtml(row.name || '—')}</span>
            <span class="lead-slack-item-meta">${escHtml(refAmount)} · 참고용</span>
            <span class="lead-slack-item-link">${renderLeadShareLinkHtml(row)}</span>
          </div>
          <span class="lead-slack-item-amount">
            <span class="lead-slack-item-amount-label-wrap">
              <span class="lead-slack-item-amount-label">요청금액</span>
              <span class="lead-slack-item-amount-hint">VAT 포함</span>
            </span>
            <input type="number" class="lead-slack-amount-input" data-row-key="${escHtml(key)}" value="${escHtml(String(amountValue))}" min="0" step="1" placeholder="250">
            <span class="lead-slack-item-amount-unit">만원</span>
          </span>
        </div>
        <div class="lead-slack-item-preview-block">
          <span class="lead-slack-preview-label">슬랙 DM 미리보기</span>
          <textarea class="lead-slack-item-preview" rows="5" readonly>${escHtml(previewText)}</textarea>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.lead-slack-amount-input').forEach(el => {
    el.addEventListener('input', updateLeadSlackPreviews);
    el.addEventListener('change', updateLeadSlackPreviews);
  });
  updateLeadSlackPreviews();
}

function openLeadSlackModalFromSelection() {
  const selected = getSelectedLeadSlackRows();
  if (!selected.length) {
    showSettleToast('리드 확인할 광고주를 테이블에서 선택해 주세요.');
    return;
  }

  const sub = document.getElementById('leadSlackModalSub');
  if (sub) {
    sub.textContent = `선택 ${selected.length}건 · ${LEAD_SLACK_RECIPIENT}에게 보낼 슬랙 DM을 확인하세요.`;
  }
  renderLeadSlackList(selected);

  const overlay = document.getElementById('leadSlackModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

function closeLeadSlackModal() {
  const overlay = document.getElementById('leadSlackModalOverlay');
  overlay.classList.remove('is-open');
  window.setTimeout(() => {
    overlay.style.display = 'none';
  }, 220);
}

function markLeadSlackConfirmed(items) {
  const now = new Date().toISOString();
  items.forEach(item => {
    const row = findRow(item.rowKey);
    if (!row) return;
    row.requestAmountManwon = item.amountManwon;
    const breakdown = getRowRequestAmountBreakdown(row);
    if (breakdown) {
      row.requestAmount = breakdown.requestWon;
      row.supplyAmount = breakdown.supply;
      row.taxAmount = breakdown.tax;
    }
    row.leadSlackConfirmed = true;
    row.leadSlackConfirmedAt = now;
    selectedRowKeys.delete(item.rowKey);
  });
  saveSettlements();
  renderMonthView();
}

async function sendLeadSlackRequest() {
  const items = collectLeadSlackFormItems();
  if (!items.length) {
    showSettleToast('요청할 광고주를 하나 이상 선택해 주세요.');
    return;
  }

  for (const item of items) {
    if (!parseAmountManwon(item.amountManwon)) {
      showSettleToast(`${item.company} 요청금액(만원)을 입력해 주세요.`);
      return;
    }
  }

  const btn = document.getElementById('leadSlackSendBtn');
  const url = getLeadSlackApiUrl();
  const messages = items.map(item => item.previewText);

  if (btn) {
    btn.disabled = true;
    btn.textContent = '전송 중…';
  }

  try {
    if (!url) {
      throw new Error('슬랙 연동 URL이 설정되지 않았습니다. config.js를 확인해 주세요.');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sendLeadSlackDm',
        recipientName: LEAD_SLACK_RECIPIENT,
        messages,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || '슬랙 전송에 실패했습니다.');
    }

    markLeadSlackConfirmed(items);
    showSettleToast(`${LEAD_SLACK_RECIPIENT}에게 슬랙 DM ${messages.length}건을 보냈습니다.`);
    closeLeadSlackModal();
  } catch (err) {
    showSettleToast(err.message || '슬랙 전송에 실패했습니다.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '슬랙 요청';
    }
  }
}

function initLeadSlackUi() {
  document.getElementById('leadSlackOpenBtn')?.addEventListener('click', openLeadSlackModalFromSelection);
  document.getElementById('leadSlackCancelBtn')?.addEventListener('click', closeLeadSlackModal);
  document.getElementById('leadSlackModalCloseBtn')?.addEventListener('click', closeLeadSlackModal);
  document.getElementById('leadSlackModalOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLeadSlackModal();
  });
  document.getElementById('leadSlackSendBtn')?.addEventListener('click', sendLeadSlackRequest);
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettlements();
  initSettleUrlParams();
  initMasterSheetLink();
  initMonthPicker();
  initSettleTypeTabs();
  initSettleFilterTabs();
  initBulkActions();
  initTaxInvoiceUpload();
  initLeadSlackUi();
  renderMonthView();
});
