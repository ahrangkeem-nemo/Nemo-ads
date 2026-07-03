// ─── 상수 ────────────────────────────────────────────────
const ACCT_KEY     = 'nemo_ad_accounts_v4';
const CAMPAIGN_KEY = 'nemo_campaigns_v4';

const TYPE_LABELS = { agency: '광고대행사', partner: '광고주' };
const ADVERTISER_SUBTYPE_LABELS = {
  regular_partner: '정기 파트너사',
  general: '일반 광고주',
};
const DEFAULT_ADVERTISER_SUBTYPES = ['regular_partner'];

const PRODUCTS = {
  'main-popup': '메인팝업', 'main-banner': '메인배너',
  'list-feed': '리스트피드', 'channel-talk': '채널톡',
  'position-marker': '포지션마커', 'discovery': '디스커버리',
  'endpoint': '엔드포인트', 'app-push': '앱푸시',
};
const PRODUCT_COLORS = {
  'main-popup': 'pink', 'main-banner': 'blue', 'list-feed': 'green',
  'channel-talk': 'yellow', 'position-marker': 'purple',
  'discovery': 'teal', 'endpoint': 'orange', 'app-push': 'indigo',
};
const STATUS_LABELS = { scheduled: '예정', active: '진행중', ended: '종료' };

const SETOFF_LABELS = { no_setoff: '상계 안함', setoff: '상계함' };
const SETTLE_CYCLE_LABELS = {
  month_start: '매월 초 (1일)',
  month_end: '매월 말',
};

const DEMO_ACCOUNT_NAMES = new Set(['크리에이팁']);

/** 라이브 운영 광고대행사 — 정산 관리 SETTLEMENT_STORE_ACCOUNTS 와 동기화 */
const AGENCY_ACCOUNTS = typeof getAgencyAccountSeedsFromSettlement === 'function'
  ? getAgencyAccountSeedsFromSettlement()
  : [];

/** 라이브 운영 광고주 — 정산 관리 SETTLEMENT_STORE_ACCOUNTS 와 동기화 */
const PARTNER_ACCOUNTS = typeof getPartnerAccountSeedsFromSettlement === 'function'
  ? getPartnerAccountSeedsFromSettlement()
  : [];

function normalizeAdvertiserSubtypes(account) {
  if (account.type !== 'partner') return [];
  const raw = account.advertiserSubtypes;
  if (Array.isArray(raw) && raw.length) return raw.filter(Boolean);
  if (PARTNER_ACCOUNTS.some(p => p.id === account.id || p.name === account.name)) {
    return [...DEFAULT_ADVERTISER_SUBTYPES];
  }
  return ['general'];
}

function formatAccountTypeDisplay(a) {
  if (a.type === 'agency') return TYPE_LABELS.agency;
  const subs = normalizeAdvertiserSubtypes(a)
    .map(k => ADVERTISER_SUBTYPE_LABELS[k] || k)
    .join(' · ');
  return subs ? `${TYPE_LABELS.partner} · ${subs}` : TYPE_LABELS.partner;
}

function formatAccountTypeBadgeHtml(a) {
  if (a.type === 'agency') {
    return `<span class="acct-type-badge acct-type-badge--agency">${TYPE_LABELS.agency}</span>`;
  }
  const subs = normalizeAdvertiserSubtypes(a);
  const subHtml = subs.map(k =>
    `<span class="acct-subtype-chip">${escHtml(ADVERTISER_SUBTYPE_LABELS[k] || k)}</span>`
  ).join('');
  return `<span class="acct-type-badge acct-type-badge--partner">${TYPE_LABELS.partner}</span>${subHtml ? `<span class="acct-subtype-chips">${subHtml}</span>` : ''}`;
}

function updateAdvertiserSubtypePanel() {
  const panel = document.getElementById('acctAdvertiserSubtypePanel');
  if (!panel) return;
  const isPartner = document.getElementById('acctType')?.value === 'partner';
  panel.hidden = !isPartner;
  updateTaxIssuePanel();
}

function isSetoffEnabled() {
  return document.querySelector('input[name="acctSetoff"]:checked')?.value === 'setoff';
}

function updateAgencyFeePanel() {
  const isPartner = document.getElementById('acctType')?.value === 'partner';
  const agencyFeePanel = document.getElementById('acctAgencyFeePanel');
  if (!agencyFeePanel) return;
  const hideFee = isPartner || isSetoffEnabled();
  agencyFeePanel.hidden = hideFee;
  if (hideFee && !isPartner) {
    document.getElementById('acctAgencyFee').value = '';
    document.getElementById('acctFeePaidDate').value = '';
    updateFeePreview();
  }
}

function updateTaxIssuePanel() {
  const isPartner = document.getElementById('acctType')?.value === 'partner';
  const partnerPanel = document.getElementById('acctPartnerSettleCyclePanel');
  const agencyPanel = document.getElementById('acctAgencyTaxDatePanel');
  const sheetUrlRow = document.getElementById('acctSheetUrlRow');
  if (partnerPanel) partnerPanel.hidden = !isPartner;
  if (agencyPanel) agencyPanel.hidden = isPartner;
  if (sheetUrlRow) sheetUrlRow.style.borderBottom = isPartner ? 'none' : '';
  updateAgencyFeePanel();
  if (isPartner) {
    document.getElementById('acctAgencyFee').value = '';
    document.getElementById('acctFeePaidDate').value = '';
    updateFeePreview();
  }
}

function getSelectedSettleCycle() {
  return document.querySelector('input[name="acctSettleCycle"]:checked')?.value || 'month_end';
}

function setSettleCycle(value) {
  const cycle = value === 'month_start' ? 'month_start' : 'month_end';
  const radio = document.querySelector(`input[name="acctSettleCycle"][value="${cycle}"]`);
  if (radio) radio.checked = true;
}

function formatTaxIssueDisplay(a) {
  if (a.type === 'partner') {
    return SETTLE_CYCLE_LABELS[a.settleCycle] || SETTLE_CYCLE_LABELS.month_end;
  }
  if (!a.taxDate) return '—';
  const d = new Date(a.taxDate);
  if (Number.isNaN(d.getTime())) return '—';
  return `매월 ${d.getDate()}일`;
}

function normalizePartnerSettleCycle(account) {
  if (account.type !== 'partner') return account;
  const seed = PARTNER_ACCOUNTS.find(p => p.id === account.id || p.name === account.name);
  let settleCycle = account.settleCycle;
  if (!settleCycle && seed?.settleCycle) settleCycle = seed.settleCycle;
  if (!settleCycle) settleCycle = 'month_end';
  return { ...account, settleCycle, taxDate: '', agencyFee: 0, feePaidDate: '' };
}

function normalizeAgencyTaxDate(account) {
  if (account.type !== 'agency') return account;
  return { ...account, settleCycle: '' };
}

function getSelectedAdvertiserSubtypes() {
  return [...document.querySelectorAll('input[name="advertiserSubtype"]:checked')]
    .map(el => el.value);
}

function setAdvertiserSubtypes(values) {
  const set = new Set(Array.isArray(values) && values.length ? values : DEFAULT_ADVERTISER_SUBTYPES);
  document.querySelectorAll('input[name="advertiserSubtype"]').forEach(el => {
    el.checked = set.has(el.value);
  });
  updateAdvertiserSubtypePanel();
}

function getSeedCampaigns() {
  return typeof LIVE_CAMPAIGNS !== 'undefined' ? LIVE_CAMPAIGNS.map(c => ({ ...c })) : [];
}

// ─── 상태 ────────────────────────────────────────────────
let accounts      = [];
let campaigns     = [];
let filterType    = '';
let searchQuery   = '';
let editingAcctId = null;
let deletingAcctId = null;
let currentAcctId = null;   // 현재 상세 보기 중인 계정 ID
let bizFileData   = '';
let bizFileName   = '';
let bankFileData  = '';
let bankFileName  = '';
let contractFileData = '';
let contractFileName = '';
let editingCampaignId = null;

// ─── 계약 서류 (contract-manage.js 와 같은 키 사용) ──────
const CONTRACT_KEY = 'nemo_contracts_v1';
const DOC_TYPES = [
  { id: 'contract',    label: '표준광고계약서',      color: 'blue'   },
  { id: 'biz-reg',     label: '사업자등록증',         color: 'green'  },
  { id: 'bank',        label: '통장 사본',            color: 'purple' },
  { id: 'tax-invoice', label: '대행수수료 세금계산서', color: 'orange' },
  { id: 'e-tax',       label: '전자세금계산서',        color: 'teal'   },
  { id: 'etc',         label: '기타 서류',             color: 'gray'   },
];

function loadContracts() {
  try { return JSON.parse(localStorage.getItem(CONTRACT_KEY)) || {}; }
  catch { return {}; }
}

function fileExt(name) { return (name.split('.').pop() || '').toLowerCase(); }
function extBadgeColor(ext) {
  if (ext === 'pdf') return 'red';
  if (['doc','docx'].includes(ext)) return 'blue';
  if (['jpg','jpeg','png'].includes(ext)) return 'green';
  return 'gray';
}

function renderDetailContracts(acctId) {
  const contracts  = loadContracts();
  const acctDocs   = contracts[acctId] || {};
  const totalCount = Object.values(acctDocs).reduce((s, arr) => s + arr.length, 0);

  document.getElementById('detailContractCountBadge').textContent = totalCount + '건';

  const grid = document.getElementById('detailContractGrid');
  grid.innerHTML = DOC_TYPES.map(dt => {
    const files = acctDocs[dt.id] || [];
    return `
      <div class="contract-doc-card">
        <div class="contract-doc-card-head">
          <div class="contract-doc-icon contract-doc-icon--${dt.color}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="contract-doc-meta">
            <p class="contract-doc-label">${escHtml(dt.label)}</p>
            <p class="contract-doc-desc">${files.length}건</p>
          </div>
        </div>
        <ul class="contract-file-list">
          ${files.length === 0
            ? `<li class="contract-file-empty">등록된 파일 없음</li>`
            : files.map(f => `
              <li class="contract-file-item">
                <span class="contract-file-ext contract-file-ext--${extBadgeColor(fileExt(f.name))}">${fileExt(f.name).toUpperCase()}</span>
                <span class="contract-file-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
                ${f.dataUrl ? `<a class="contract-file-btn" href="${f.dataUrl}" download="${escHtml(f.name)}" title="다운로드">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </a>` : ''}
              </li>`).join('')
          }
        </ul>
      </div>`;
  }).join('');
}

// ─── 유틸 ────────────────────────────────────────────────
function ensureAgencyAccounts() {
  AGENCY_ACCOUNTS.forEach(agency => {
    const byName = accounts.filter(a => a.name === agency.name);
    const existing = byName.find(a => a.id === agency.id) || byName[0];
    accounts = accounts.filter(a => a.name !== agency.name);
    accounts.push({
      ...(existing || {}),
      ...agency,
      id: agency.id,
      name: agency.name,
      type: 'agency',
      advertiserSubtypes: [],
      email: agency.email || '',
      address: agency.address || '',
      createdAt: existing?.createdAt || agency.createdAt || nowDateStr(),
    });
  });
}

function purgeUnsettlementAgencies() {
  const allowed = new Set(
    typeof getSettlementAgencyAccountIds === 'function'
      ? getSettlementAgencyAccountIds()
      : AGENCY_ACCOUNTS.map(a => a.id)
  );
  accounts = accounts.filter(a => a.type !== 'agency' || allowed.has(a.id));
}

function ensurePartnerAccounts() {
  PARTNER_ACCOUNTS.forEach(partner => {
    const byName = accounts.filter(a => a.name === partner.name);
    const existing = byName.find(a => a.id === partner.id) || byName[0];
    accounts = accounts.filter(a => a.name !== partner.name);
    accounts.push({
      ...(existing || {}),
      ...partner,
      id: partner.id,
      name: partner.name,
      type: 'partner',
      advertiserSubtypes: partner.advertiserSubtypes || [...DEFAULT_ADVERTISER_SUBTYPES],
      email: partner.email || '',
      address: partner.address || '',
      settleCycle: partner.settleCycle || 'month_end',
      taxDate: '',
      agencyFee: 0,
      feePaidDate: '',
      createdAt: existing?.createdAt || partner.createdAt || nowDateStr(),
    });
  });
}

function purgeUnsettlementPartners() {
  const allowed = new Set(
    typeof getSettlementPartnerAccountIds === 'function'
      ? getSettlementPartnerAccountIds()
      : PARTNER_ACCOUNTS.map(p => p.id)
  );
  accounts = accounts.filter(a => a.type !== 'partner' || allowed.has(a.id));
}

function purgeOrphanCampaigns() {
  const allowedAccountIds = new Set(accounts.map(a => a.id));
  const before = campaigns.length;
  campaigns = campaigns.filter(c => allowedAccountIds.has(c.accountId));
  if (campaigns.length !== before) saveCampaigns();
}

function ensurePartnerCampaigns() {
  const seed = getSeedCampaigns();
  if (!seed.length) return;
  let changed = false;
  seed.forEach(def => {
    if (!campaigns.some(c => c.id === def.id)) {
      campaigns.push({ ...def });
      changed = true;
    }
  });
  if (changed) saveCampaigns();
}

function loadAccounts() {
  try { accounts = JSON.parse(localStorage.getItem(ACCT_KEY)) || []; }
  catch { accounts = []; }
  accounts = accounts.filter(a => !DEMO_ACCOUNT_NAMES.has(a.name));
  ensureAgencyAccounts();
  ensurePartnerAccounts();
  purgeUnsettlementAgencies();
  purgeUnsettlementPartners();
  accounts = accounts.map(a => {
    const merged = {
      contractFileName: '', contractFileData: '',
      bankFileName: '', bankFileData: '',
      agencyFee: 0, feePaidDate: '', setoffType: 'no_setoff',
      ...a,
      type: PARTNER_ACCOUNTS.some(p => p.name === a.name) ? 'partner' : a.type,
      advertiserSubtypes: (a.type === 'partner' || PARTNER_ACCOUNTS.some(p => p.name === a.name))
        ? normalizeAdvertiserSubtypes({ ...a, type: PARTNER_ACCOUNTS.some(p => p.name === a.name) ? 'partner' : a.type })
        : [],
    };
    return normalizeAgencyTaxDate(normalizePartnerSettleCycle(merged));
  });
  saveAccounts();
}
function saveAccounts() { localStorage.setItem(ACCT_KEY, JSON.stringify(accounts)); }

function loadCampaigns() {
  try { campaigns = JSON.parse(localStorage.getItem(CAMPAIGN_KEY)) || []; }
  catch { campaigns = []; }
  if (!campaigns.length) {
    campaigns = getSeedCampaigns();
    saveCampaigns();
  } else {
    ensurePartnerCampaigns();
  }
  purgeOrphanCampaigns();
}
function saveCampaigns() { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaigns)); }

function campaignsFor(acctId) { return campaigns.filter(c => String(c.accountId) === String(acctId)); }
function campaignCountFor(acctId) { return campaignsFor(acctId).length; }
function nextAcctId() { return accounts.length ? Math.max(...accounts.map(a => a.id)) + 1 : 1; }
function nextCampaignId() { return campaigns.length ? Math.max(...campaigns.map(c => c.id)) + 1 : 1; }
function fmtDate(s) { return s ? s.slice(0, 10).replace(/-/g, '.') : '—'; }
function nowDateStr() { const d = new Date(); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── 1DEPTH 렌더 ──────────────────────────────────────────
function filteredAccounts() {
  return accounts.filter(a => {
    if (filterType && a.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderStats() {
  document.getElementById('statAllAcct').textContent = accounts.length;
  document.getElementById('statAgency').textContent  = accounts.filter(a => a.type === 'agency').length;
  document.getElementById('statPartner').textContent = accounts.filter(a => a.type === 'partner').length;
}

function fileBadge(name, dataUrl) {
  if (!name) return '—';
  const dl = dataUrl ? ` data-dl="${dataUrl}" data-dl-name="${escHtml(name)}"` : '';
  return `<span class="acct-file-badge acct-file-badge--link"${dl}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${escHtml(name)}</span>`;
}

function renderFileField(name, dataUrl) {
  if (!name) return '—';
  if (dataUrl) {
    return `<a class="acct-file-badge acct-file-badge--link" href="${dataUrl}" download="${escHtml(name)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${escHtml(name)}</a>`;
  }
  return fileBadge(name);
}

function formatAgencyFeeDetail(a) {
  const fee = Number(a.agencyFee) || 0;
  if (!fee) return '—';
  const vat = Math.round(fee * 0.1);
  const total = fee + vat;
  const fmt = n => n.toLocaleString('ko-KR') + '만원';
  return `${fmt(fee)} (VAT ${fmt(vat)} · 합계 ${fmt(total)})`;
}

function buildAcctInfoRows(a) {
  const sheetCell = a.sheetUrl
    ? `<a href="${escHtml(a.sheetUrl)}" target="_blank" rel="noopener" class="acct-link">열기</a>`
    : '—';
  const emailCell = a.email
    ? `<a href="mailto:${escHtml(a.email)}" class="acct-email">${escHtml(a.email)}</a>`
    : '—';

  return [
    ['계정명', escHtml(a.name)],
    ['유형', escHtml(formatAccountTypeDisplay(a))],
    ['상계', escHtml(SETOFF_LABELS[a.setoffType] || '상계 안함')],
    ['정산 대상 이메일', emailCell],
    ['사업자 주소', escHtml(a.address || '—')],
    ['세금계산서 발행일자', escHtml(formatTaxIssueDisplay(a))],
    ['표준광고계약서', renderFileField(a.contractFileName, a.contractFileData)],
    ['사업자등록증', renderFileField(a.bizFileName, a.bizFileData)],
    ['통장 사본', renderFileField(a.bankFileName, a.bankFileData)],
    ['참고시트 URL', sheetCell],
    ['대행 수수료', escHtml(formatAgencyFeeDetail(a))],
    ['수수료 지급 예정일', a.feePaidDate ? escHtml(fmtDate(a.feePaidDate)) : '—'],
    ['등록일', a.createdAt ? escHtml(fmtDate(a.createdAt)) : '—'],
  ];
}

let viewingAcctInfoId = null;

function renderAcctInfoModal(a) {
  const dl = document.getElementById('acctInfoDl');
  if (!dl) return;
  dl.innerHTML = buildAcctInfoRows(a).map(([label, value]) =>
    `<div class="booking-inquiry-row"><dt>${escHtml(label)}</dt><dd>${value}</dd></div>`
  ).join('');
}

function openAcctInfoModal(id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  viewingAcctInfoId = id;
  document.getElementById('acctInfoModalTitle').textContent = a.name;
  renderAcctInfoModal(a);
  const overlay = document.getElementById('acctInfoModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

function closeAcctInfoModal() {
  const overlay = document.getElementById('acctInfoModalOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => {
    overlay.style.display = 'none';
    viewingAcctInfoId = null;
  }, 220);
}

function buildAlarmCell(a) {
  if (!a.feePaidDate || !a.agencyFee) return '<span class="acct-alarm-none">—</span>';
  const days = daysUntilFee(a.feePaidDate);
  if (days > 7)  return `<span class="acct-alarm-none">${a.feePaidDate.replace(/-/g,'.')}</span>`;
  if (days < 0)  return '<span class="acct-alarm-badge acct-alarm-badge--done">지급완료?</span>';
  const urgency  = days === 0 ? 'urgent' : days <= 3 ? 'warning' : '';
  const dLabel   = days === 0 ? 'D-Day' : 'D-' + days;
  return `
    <div class="acct-alarm-cell">
      <span class="acct-alarm-badge acct-alarm-badge--${urgency || 'normal'}">${dLabel}</span>
      <button class="acct-alarm-btn" data-fee-acct="${a.id}" data-type="tax" title="세금계산서 발행 요청 메일">세금계산서</button>
      <button class="acct-alarm-btn acct-alarm-btn--expense" data-fee-acct="${a.id}" data-type="expense" title="품의서 작성 안내 메일">품의서</button>
    </div>`;
}

function renderTable() {
  const list  = filteredAccounts();
  const tbody = document.getElementById('acctTbody');
  const empty = document.getElementById('acctEmpty');
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = list.map(a => {
    const count = campaignCountFor(a.id);
    const contactCell = a.email
      ? `<a href="mailto:${escHtml(a.email)}" class="acct-email">${escHtml(a.email)}</a>`
      : '<span class="acct-none">—</span>';

    return `
      <tr>
        <td class="acct-td-advertiser">
          <button class="acct-name-btn" data-action="detail" data-id="${a.id}">
            <span class="acct-name">${escHtml(a.name)}</span>
          </button>
          <div class="acct-td-advertiser-meta">${formatAccountTypeBadgeHtml(a)}</div>
        </td>
        <td class="acct-td-contact">${contactCell}</td>
        <td class="acct-td-campaign">
          ${count > 0 ? `<span class="acct-campaign-num">${count}개</span>` : '<span class="acct-none">—</span>'}
        </td>
        <td class="acct-td-info">
          <button type="button" class="acct-info-btn" data-action="detail" data-id="${a.id}">상세</button>
        </td>
      </tr>`;
  }).join('');
}

// ─── 2DEPTH 렌더 ──────────────────────────────────────────
function showDetail(acctId) {
  const a = accounts.find(x => x.id === acctId);
  if (!a) return;
  currentAcctId = acctId;

  const linked = campaignsFor(acctId);

  // 헤더
  document.getElementById('detailName').textContent = a.name;
  const badge = document.getElementById('detailTypeBadge');
  badge.textContent = formatAccountTypeDisplay(a);
  badge.className = `acct-type-badge acct-type-badge--${a.type}`;
  document.getElementById('detailEmailRow').textContent = a.email;

  // 수치
  document.getElementById('detailCampaignTotal').textContent     = linked.length;
  document.getElementById('detailCampaignActive').textContent    = linked.filter(c => c.status === 'active').length;
  document.getElementById('detailCampaignScheduled').textContent = linked.filter(c => c.status === 'scheduled').length;
  document.getElementById('detailCampaignEnded').textContent     = linked.filter(c => c.status === 'ended').length;
  document.getElementById('detailCampaignCountBadge').textContent = linked.length + '개';

  // 기본 정보
  document.getElementById('detailAddress').textContent  = a.address || '—';
  document.getElementById('detailContractFile').innerHTML = renderFileField(a.contractFileName, a.contractFileData);
  document.getElementById('detailBizFile').innerHTML      = renderFileField(a.bizFileName, a.bizFileData);
  document.getElementById('detailBankFile').innerHTML     = renderFileField(a.bankFileName, a.bankFileData);
  document.getElementById('detailSheetUrl').innerHTML   = a.sheetUrl
    ? `<a href="${escHtml(a.sheetUrl)}" target="_blank" rel="noopener" class="acct-link" style="display:inline-flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>시트 열기</a>`
    : '—';
  document.getElementById('detailCreatedAt').textContent = fmtDate(a.createdAt);

  // 정산 정보
  document.getElementById('detailEmail').textContent       = a.email || '—';
  document.getElementById('detailSetoff').textContent     = SETOFF_LABELS[a.setoffType] || '상계 안함';
  document.getElementById('detailTaxDate').textContent     = formatTaxIssueDisplay(a);
  document.getElementById('detailFeePaidDate').textContent = a.feePaidDate ? fmtDate(a.feePaidDate) : '—';

  const settlementBtn = document.getElementById('goSettlementBtn');
  if (settlementBtn) {
    settlementBtn.href = `settlement-manage.html?accountId=${a.id}`;
  }

  // 광고 대행료 정산 예정
  const feeCard = document.getElementById('detailFeeCard');
  const fee = Number(a.agencyFee) || 0;
  if (fee > 0) {
    const vat   = Math.round(fee * 0.1);
    const total = fee + vat;
    const fmt   = n => n.toLocaleString('ko-KR') + '만원';
    document.getElementById('detailFeeBase').textContent  = fmt(fee);
    document.getElementById('detailFeeVat').textContent   = fmt(vat);
    document.getElementById('detailFeeTotal').textContent = fmt(total);
    feeCard.style.display = 'block';
  } else {
    feeCard.style.display = 'none';
  }

  // 캠페인 테이블
  renderDetailContracts(a.id);
  renderDetailCampaigns(linked);

  // 뷰 전환
  document.getElementById('acctListView').style.display   = 'none';
  document.getElementById('acctDetailView').style.display = 'block';
  window.scrollTo(0, 0);
}

function renderDetailCampaigns(linked) {
  const tbody = document.getElementById('detailCampaignTbody');
  const empty = document.getElementById('detailCampaignEmpty');
  if (!linked.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = linked.map(c => `
    <tr>
      <td class="manage-td-name">
        <span class="manage-campaign-name">${escHtml(c.name)}</span>
        ${c.desc ? `<span class="manage-campaign-note">${escHtml(c.desc)}</span>` : ''}
      </td>
      <td><span class="manage-product manage-product--${PRODUCT_COLORS[c.product]||'gray'}">${PRODUCTS[c.product]||c.product}</span></td>
      <td><span class="manage-status manage-status--${c.status}">${STATUS_LABELS[c.status]||c.status}</span></td>
      <td class="manage-td-date">${fmtDate(c.startDate)} ~ ${fmtDate(c.endDate)}</td>
      <td class="manage-td-date">${fmtDate(c.createdAt)}</td>
      <td class="manage-td-actions">
        <button class="manage-icon-btn" data-camp-action="edit" data-camp-id="${c.id}" aria-label="편집">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="manage-icon-btn manage-icon-btn--danger" data-camp-action="delete" data-camp-id="${c.id}" aria-label="삭제">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>`).join('');
}

function backToList() {
  document.getElementById('acctDetailView').style.display = 'none';
  document.getElementById('acctListView').style.display   = 'block';
  currentAcctId = null;
  renderTable();
}

function updateSetoffHint() {
  const val = document.querySelector('input[name="acctSetoff"]:checked')?.value || 'no_setoff';
  document.querySelectorAll('[data-setoff-hint]').forEach(el => {
    el.classList.toggle('is-selected', el.dataset.setoffHint === val);
  });
  updateAgencyFeePanel();
}

function setSetoffType(value) {
  const v = value === 'setoff' ? 'setoff' : 'no_setoff';
  const radio = document.querySelector(`input[name="acctSetoff"][value="${v}"]`);
  if (radio) radio.checked = true;
  updateSetoffHint();
}

// ─── 계정 모달 ────────────────────────────────────────────
function openAcctModal(id = null) {
  editingAcctId = id;
  clearAcctErrors();
  const overlay = document.getElementById('acctModalOverlay');
  const title   = document.getElementById('acctModalTitle');
  document.getElementById('acctModalSaveBtn').querySelector('.btn-text').textContent = id ? '저장' : '추가';

  if (id) {
    const a = accounts.find(x => x.id === id);
    if (!a) return;
    title.textContent = '계정 수정';
    document.getElementById('acctId').value      = a.id;
    document.getElementById('acctName').value    = a.name;
    document.getElementById('acctType').value    = a.type;
    setAdvertiserSubtypes(normalizeAdvertiserSubtypes(a));
    setSetoffType(a.setoffType);
    document.getElementById('acctEmail').value   = a.email;
    document.getElementById('acctAddress').value = a.address || '';
    if (a.type === 'partner') {
      setSettleCycle(a.settleCycle || 'month_end');
      document.getElementById('acctTaxDate').value = '';
    } else {
      setSettleCycle('month_end');
      document.getElementById('acctTaxDate').value = a.taxDate || '';
    }
    document.getElementById('acctSheetUrl').value     = a.sheetUrl     || '';
    document.getElementById('acctAgencyFee').value    = a.agencyFee    || '';
    document.getElementById('acctFeePaidDate').value  = a.feePaidDate  || '';
    resetAcctFileUpload('contract', a.contractFileName, a.contractFileData);
    resetAcctFileUpload('biz', a.bizFileName, a.bizFileData);
    resetAcctFileUpload('bank', a.bankFileName, a.bankFileData);
    updateFeePreview();
  } else {
    title.textContent = '새 계정';
    document.getElementById('acctForm').reset();
    document.getElementById('acctId').value = '';
    setSetoffType('no_setoff');
    setAdvertiserSubtypes(DEFAULT_ADVERTISER_SUBTYPES);
    resetAcctFileUpload('contract', '', '');
    resetAcctFileUpload('biz', '', '');
    resetAcctFileUpload('bank', '', '');
    setSettleCycle('month_end');
    document.getElementById('acctTaxDate').value = '';
    updateFeePreview();
  }

  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  updateAdvertiserSubtypePanel();
  updateTaxIssuePanel();
  document.getElementById('acctName').focus();
}

function closeAcctModal() {
  const overlay = document.getElementById('acctModalOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
}

function clearAcctErrors() {
  document.querySelectorAll('#acctForm .manage-field-error').forEach(el => el.textContent = '');
}

function saveAccount() {
  clearAcctErrors();
  let ok = true;
  const name  = document.getElementById('acctName').value.trim();
  const email = document.getElementById('acctEmail').value.trim();
  if (!name)  { document.querySelector('#acctForm [data-error="name"]').textContent  = '계정명을 입력하세요.'; ok = false; }
  if (!email) { document.querySelector('#acctForm [data-error="email"]').textContent = '이메일을 입력하세요.'; ok = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.querySelector('#acctForm [data-error="email"]').textContent = '올바른 이메일 형식을 입력하세요.'; ok = false;
  }
  if (!ok) return;

  const acctType = document.getElementById('acctType').value;
  let advertiserSubtypes = [];
  if (acctType === 'partner') {
    advertiserSubtypes = getSelectedAdvertiserSubtypes();
    if (!advertiserSubtypes.length) {
      document.querySelector('#acctForm [data-error="advertiserSubtype"]').textContent =
        '광고주 세부 유형을 하나 이상 선택하세요.';
      ok = false;
    }
  } else {
    const taxDate = document.getElementById('acctTaxDate').value;
    if (!taxDate) {
      document.querySelector('#acctForm [data-error="taxDate"]').textContent =
        '세금계산서 발행일자를 선택하세요.';
      ok = false;
    }
  }
  if (!ok) return;

  const saveBtn = document.getElementById('acctModalSaveBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const btnLoad = saveBtn.querySelector('.btn-loading');
  saveBtn.disabled = true; btnText.hidden = true; btnLoad.hidden = false;

  setTimeout(() => {
    const setoffType = document.querySelector('input[name="acctSetoff"]:checked')?.value || 'no_setoff';
    const data = {
      name: name, type: acctType,
      advertiserSubtypes: acctType === 'partner' ? advertiserSubtypes : [],
      setoffType,
      email: email, address: document.getElementById('acctAddress').value.trim(),
      settleCycle: acctType === 'partner' ? getSelectedSettleCycle() : '',
      taxDate: acctType === 'agency' ? document.getElementById('acctTaxDate').value : '',
      sheetUrl: document.getElementById('acctSheetUrl').value.trim(),
      agencyFee: acctType === 'agency' && setoffType !== 'setoff'
        ? Number(document.getElementById('acctAgencyFee').value) || 0
        : 0,
      feePaidDate: acctType === 'agency' && setoffType !== 'setoff'
        ? document.getElementById('acctFeePaidDate').value
        : '',
      contractFileName, contractFileData,
      bizFileName, bizFileData,
      bankFileName, bankFileData,
    };

    if (editingAcctId) {
      const idx = accounts.findIndex(a => a.id === editingAcctId);
      if (idx !== -1) accounts[idx] = { ...accounts[idx], ...data };
    } else {
      accounts.unshift({ id: nextAcctId(), createdAt: nowDateStr(), ...data });
    }
    saveAccounts();

    closeAcctModal();
    if (currentAcctId && editingAcctId === currentAcctId) {
      showDetail(currentAcctId); // 상세 뷰 갱신
    } else {
      renderStats(); renderTable();
    }
    saveBtn.disabled = false; btnText.hidden = false; btnLoad.hidden = true;
  }, 400);
}

// ─── 계정 삭제 ────────────────────────────────────────────
function openDeleteModal(id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  deletingAcctId = id;
  document.getElementById('acctDeleteName').textContent = a.name;
  const overlay = document.getElementById('acctDeleteOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

function closeDeleteModal() {
  const overlay = document.getElementById('acctDeleteOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
}

function deleteAccount() {
  if (!deletingAcctId) return;
  accounts = accounts.filter(a => a.id !== deletingAcctId);
  saveAccounts();
  closeDeleteModal();
  if (currentAcctId === deletingAcctId) backToList();
  else { renderStats(); renderTable(); }
  deletingAcctId = null;
}

// ─── 캠페인 모달 (상세에서) ───────────────────────────────
function openCampaignModal(campaignId = null) {
  editingCampaignId = campaignId;
  const overlay = document.getElementById('campaignFromDetailOverlay');
  const title   = document.getElementById('cfDetailTitle');
  document.getElementById('cfDetailSaveBtn').querySelector('.btn-text').textContent = campaignId ? '저장' : '추가';
  document.querySelectorAll('#cfDetailForm .manage-field-error').forEach(el => el.textContent = '');

  if (campaignId) {
    const c = campaigns.find(x => x.id === campaignId);
    if (!c) return;
    title.textContent = '캠페인 수정';
    document.getElementById('cfDetailCampaignId').value = c.id;
    document.getElementById('cfName').value    = c.name;
    document.getElementById('cfProduct').value = c.product;
    document.getElementById('cfStatus').value  = c.status;
    document.getElementById('cfStart').value   = c.startDate || '';
    document.getElementById('cfEnd').value     = c.endDate   || '';
    document.getElementById('cfDesc').value    = c.desc      || '';
  } else {
    title.textContent = '새 캠페인';
    document.getElementById('cfDetailForm').reset();
    document.getElementById('cfDetailCampaignId').value = '';
  }

  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  document.getElementById('cfName').focus();
}

function closeCampaignModal() {
  const overlay = document.getElementById('campaignFromDetailOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
}

function saveCampaignFromDetail() {
  document.querySelectorAll('#cfDetailForm .manage-field-error').forEach(el => el.textContent = '');
  let ok = true;
  const name    = document.getElementById('cfName').value.trim();
  const product = document.getElementById('cfProduct').value;
  if (!name)    { document.querySelector('#cfDetailForm [data-error="cfName"]').textContent    = '캠페인명을 입력하세요.'; ok = false; }
  if (!product) { document.querySelector('#cfDetailForm [data-error="cfProduct"]').textContent = '배너 타입을 선택하세요.'; ok = false; }
  if (!ok) return;

  const saveBtn = document.getElementById('cfDetailSaveBtn');
  saveBtn.disabled = true;
  saveBtn.querySelector('.btn-text').hidden  = true;
  saveBtn.querySelector('.btn-loading').hidden = false;

  setTimeout(() => {
    const data = {
      name, desc: document.getElementById('cfDesc').value.trim(),
      accountId: currentAcctId,
      product, status: document.getElementById('cfStatus').value,
      startDate: document.getElementById('cfStart').value,
      endDate:   document.getElementById('cfEnd').value,
      appImage: '', webImage: '', bgColorMode: 'solid',
      bgColor1: '#ffffff', bgColor2: '#eeeeee',
      ctaColor: '#000000', ctaLabel: '', ctaLinkType: 'external', ctaUrl: '', trackingId: '',
    };

    if (editingCampaignId) {
      const idx = campaigns.findIndex(c => c.id === editingCampaignId);
      if (idx !== -1) campaigns[idx] = { ...campaigns[idx], ...data };
    } else {
      campaigns.unshift({ id: nextCampaignId(), createdAt: nowDateStr(), ...data });
    }
    saveCampaigns();
    closeCampaignModal();
    showDetail(currentAcctId); // 상세 뷰 갱신

    saveBtn.disabled = false;
    saveBtn.querySelector('.btn-text').hidden  = false;
    saveBtn.querySelector('.btn-loading').hidden = true;
  }, 400);
}

function deleteCampaignFromDetail(campaignId) {
  if (!confirm('캠페인을 삭제하시겠습니까?')) return;
  campaigns = campaigns.filter(c => c.id !== campaignId);
  saveCampaigns();
  showDetail(currentAcctId);
}

// ─── 대행료 미리보기 ──────────────────────────────────────
function updateFeePreview() {
  const fee     = Number(document.getElementById('acctAgencyFee').value) || 0;
  const preview = document.getElementById('acctFeePreview');
  if (fee > 0) {
    const vat   = Math.round(fee * 0.1);
    const total = fee + vat;
    const fmt   = n => n.toLocaleString('ko-KR') + '만원';
    preview.textContent = `대행료 ${fmt(fee)} + VAT ${fmt(vat)} = 합계 ${fmt(total)}`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

// ─── 파일 업로드 ──────────────────────────────────────────
const ACCT_FILE_KEYS = {
  contract: { prefix: 'acctContract', nameVar: () => contractFileName, dataVar: () => contractFileData, setName: v => { contractFileName = v; }, setData: v => { contractFileData = v; } },
  biz:      { prefix: 'acctBiz',      nameVar: () => bizFileName,      dataVar: () => bizFileData,      setName: v => { bizFileName = v; },      setData: v => { bizFileData = v; } },
  bank:     { prefix: 'acctBank',     nameVar: () => bankFileName,     dataVar: () => bankFileData,     setName: v => { bankFileName = v; },     setData: v => { bankFileData = v; } },
};

function processAcctFile(key, file) {
  if (!file) return;
  const cfg = ACCT_FILE_KEYS[key];
  if (file.size > 10 * 1024 * 1024) { alert('10MB 이하 파일만 업로드 가능합니다.'); return; }

  cfg.setName(file.name);
  const reader = new FileReader();
  reader.onload = ev => {
    cfg.setData(ev.target.result);
    document.getElementById(`${cfg.prefix}FileName`).textContent = file.name;
    document.getElementById(`${cfg.prefix}FileEmpty`).style.display = 'none';
    document.getElementById(`${cfg.prefix}FileAttached`).style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function setupAcctFileUpload(key) {
  const cfg   = ACCT_FILE_KEYS[key];
  const zone  = document.getElementById(`${cfg.prefix}FileZone`);
  const input = document.getElementById(`${cfg.prefix}FileInput`);
  const empty = document.getElementById(`${cfg.prefix}FileEmpty`);
  const attached = document.getElementById(`${cfg.prefix}FileAttached`);
  const removeBtn = document.getElementById(`${cfg.prefix}FileRemove`);

  zone.addEventListener('click', e => {
    if (removeBtn.contains(e.target)) return;
    input.click();
  });
  input.addEventListener('change', () => {
    processAcctFile(key, input.files[0]);
    input.value = '';
  });
  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    cfg.setName(''); cfg.setData(''); input.value = '';
    empty.style.display = 'flex';
    attached.style.display = 'none';
  });

  ['dragenter', 'dragover'].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('is-dragover');
    });
  });
  zone.addEventListener('dragleave', e => {
    e.preventDefault();
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-dragover');
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) processAcctFile(key, file);
  });
}

function resetAcctFileUpload(key, name, data) {
  const cfg = ACCT_FILE_KEYS[key];
  cfg.setName(name || ''); cfg.setData(data || '');
  const input = document.getElementById(`${cfg.prefix}FileInput`);
  const empty = document.getElementById(`${cfg.prefix}FileEmpty`);
  const attached = document.getElementById(`${cfg.prefix}FileAttached`);
  const nameEl   = document.getElementById(`${cfg.prefix}FileName`);
  input.value = '';
  if (name) {
    nameEl.textContent = name;
    empty.style.display = 'none';
    attached.style.display = 'flex';
  } else {
    empty.style.display = 'flex';
    attached.style.display = 'none';
  }
}

function setupFileUpload() {
  Object.keys(ACCT_FILE_KEYS).forEach(setupAcctFileUpload);
}

// ─── 이벤트 ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAccounts();
  loadCampaigns();
  renderStats();
  renderTable();
  setupFileUpload();
  document.querySelectorAll('input[name="acctSetoff"]').forEach(el => {
    el.addEventListener('change', updateSetoffHint);
  });
  document.getElementById('acctType')?.addEventListener('change', updateAdvertiserSubtypePanel);
  document.querySelectorAll('input[name="advertiserSubtype"]').forEach(el => {
    el.addEventListener('change', () => {
      const err = document.querySelector('#acctForm [data-error="advertiserSubtype"]');
      if (err && getSelectedAdvertiserSubtypes().length) err.textContent = '';
    });
  });
  updateSetoffHint();
  updateAdvertiserSubtypePanel();
  updateTaxIssuePanel();

  // 1depth 이벤트
  document.getElementById('newAccountBtn').addEventListener('click', () => openAcctModal());
  document.getElementById('emptyNewAcctBtn').addEventListener('click', () => openAcctModal());

  document.getElementById('acctTypeTabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    filterType = btn.dataset.type;
    document.querySelectorAll('.acct-type-tab').forEach(b => b.classList.toggle('is-active', b.dataset.type === filterType));
    renderTable();
  });

  document.getElementById('acctSearchInput').addEventListener('input', e => {
    searchQuery = e.target.value; renderTable();
  });

  document.getElementById('acctTbody').addEventListener('click', e => {
    // 알람 버튼 (테이블 컬럼)
    const alarmBtn = e.target.closest('[data-fee-acct]');
    if (alarmBtn) {
      openFeeMailModal(Number(alarmBtn.dataset.feeAcct), alarmBtn.dataset.type);
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'detail') showDetail(id);
    if (btn.dataset.action === 'info')   openAcctInfoModal(id);
    if (btn.dataset.action === 'edit')   openAcctModal(id);
    if (btn.dataset.action === 'delete') openDeleteModal(id);
  });

  // 2depth 이벤트
  document.getElementById('backToListBtn').addEventListener('click', backToList);
  document.getElementById('editAccountBtn').addEventListener('click', () => openAcctModal(currentAcctId));
  document.getElementById('deleteAccountFromDetailBtn').addEventListener('click', () => openDeleteModal(currentAcctId));
  document.getElementById('addCampaignBtn').addEventListener('click', () => openCampaignModal());
  document.getElementById('detailEmptyCampaignBtn').addEventListener('click', () => openCampaignModal());

  document.getElementById('detailCampaignTbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-camp-action]');
    if (!btn) return;
    const id = Number(btn.dataset.campId);
    if (btn.dataset.campAction === 'edit')   openCampaignModal(id);
    if (btn.dataset.campAction === 'delete') deleteCampaignFromDetail(id);
  });

  // 대행료 미리보기
  document.getElementById('acctAgencyFee').addEventListener('input', updateFeePreview);

  // 계정 모달
  document.getElementById('acctModalCloseBtn').addEventListener('click', closeAcctModal);
  document.getElementById('acctModalCancelBtn').addEventListener('click', closeAcctModal);
  document.getElementById('acctModalSaveBtn').addEventListener('click', saveAccount);
  document.getElementById('acctModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAcctModal();
  });

  document.getElementById('acctInfoModalCloseBtn').addEventListener('click', closeAcctInfoModal);
  document.getElementById('acctInfoModalDismissBtn').addEventListener('click', closeAcctInfoModal);
  document.getElementById('acctInfoModalEditBtn').addEventListener('click', () => {
    const id = viewingAcctInfoId;
    closeAcctInfoModal();
    if (id) openAcctModal(id);
  });
  document.getElementById('acctInfoModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAcctInfoModal();
  });

  // 캠페인 모달
  document.getElementById('cfDetailCloseBtn').addEventListener('click', closeCampaignModal);
  document.getElementById('cfDetailCancelBtn').addEventListener('click', closeCampaignModal);
  document.getElementById('cfDetailSaveBtn').addEventListener('click', saveCampaignFromDetail);
  document.getElementById('campaignFromDetailOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCampaignModal(); });

  // 삭제 모달
  document.getElementById('acctDeleteCloseBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('acctDeleteCancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('acctDeleteConfirmBtn').addEventListener('click', deleteAccount);
  document.getElementById('acctDeleteOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeDeleteModal(); });

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAcctModal(); closeCampaignModal(); closeDeleteModal(); closeFeeMailModal(); closeBookingModal(); }
  });

  // 수수료 알람 초기화
  initFeeNotifications();
});

// ════════════════════════════════════════════════
//  수수료 지급 알람 & 메일 템플릿
// ════════════════════════════════════════════════

const FLEX_WORKFLOW_URL =
  'https://flex.team/workflow/archive/my?workflow-action=view&workflow-task-key=818a39774ecb4949a1f2595757420c75';

const APPROVAL_CHAIN = [
  { stage: '참조',  name: 'Finance',  dept: '기타/직방',  role: '참조' },
  { stage: '참조',  name: '최현아',   dept: 'Office Work', role: '참조' },
  { stage: '참조',  name: '손보람',   dept: '기타/직방',  role: '참조' },
  { stage: '1단계', name: '윤서현',   dept: 'Growth',     role: '승인' },
  { stage: '2단계', name: '장길수',   dept: '온하우스',   role: '승인' },
  { stage: '3단계', name: 'BK KANG', dept: '기타/직방',  role: '승인' },
];

function daysUntilFee(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 0);
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
}

function getExpiringFeeAccounts(withinDays = 7) {
  return accounts
    .filter(a => a.agencyFee > 0 && a.feePaidDate)
    .filter(a => { const d = daysUntilFee(a.feePaidDate); return d >= 0 && d <= withinDays; })
    .sort((a, b) => daysUntilFee(a.feePaidDate) - daysUntilFee(b.feePaidDate));
}

function initFeeNotifications() {
  const expiring = getExpiringFeeAccounts(7);
  const badge    = document.getElementById('feeNotifBadge');
  const btn      = document.getElementById('feeNotifBtn');
  const list     = document.getElementById('feeNotifList');
  const empty    = document.getElementById('feeNotifEmpty');
  if (!badge) return;

  if (expiring.length > 0) {
    badge.textContent   = expiring.length;
    badge.style.display = 'flex';
    btn.classList.add('has-notif');
  } else {
    badge.style.display = 'none';
    btn.classList.remove('has-notif');
  }

  if (!expiring.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    list.innerHTML = expiring.map(a => {
      const days    = daysUntilFee(a.feePaidDate);
      const urgency = days === 0 ? 'urgent' : days <= 3 ? 'warning' : '';
      const fee     = Number(a.agencyFee) || 0;
      return `
        <li class="notif-item ${urgency}">
          <div class="notif-item-info">
            <span class="notif-item-name">${escHtml(a.name)}</span>
            <span class="notif-item-meta">대행료 ${fee.toLocaleString('ko-KR')}만원 · ${a.feePaidDate}</span>
          </div>
          <div class="notif-item-right">
            <span class="notif-days ${urgency}">${days === 0 ? 'D-Day' : 'D-' + days}</span>
            <button class="notif-mail-btn" data-fee-acct="${a.id}" data-type="tax" title="세금계산서 메일">세금계산서</button>
            <button class="notif-mail-btn" style="background:#fef3c7;color:#b45309;border-color:#fbbf24"
              data-fee-acct="${a.id}" data-type="expense" title="품의서 안내">품의서</button>
          </div>
        </li>`;
    }).join('');
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const dd = document.getElementById('feeNotifDropdown');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  });

  list.addEventListener('click', e => {
    const mailBtn = e.target.closest('[data-fee-acct]');
    if (!mailBtn) return;
    openFeeMailModal(Number(mailBtn.dataset.feeAcct), mailBtn.dataset.type);
    document.getElementById('feeNotifDropdown').style.display = 'none';
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('feeNotifWrap')?.contains(e.target)) {
      const dd = document.getElementById('feeNotifDropdown');
      if (dd) dd.style.display = 'none';
    }
  });
}

// ─── 메일 템플릿 ──────────────────────────────────────────
function buildApprovalText() {
  const refs      = APPROVAL_CHAIN.filter(x => x.role === '참조');
  const approvals = APPROVAL_CHAIN.filter(x => x.role === '승인');
  let txt = '[참조]\n';
  refs.forEach(r => { txt += `  • ${r.name} (${r.dept})\n`; });
  txt += '\n';
  approvals.forEach(a => { txt += `[${a.stage} 완료] ${a.name} (${a.dept}) — ${a.role}\n`; });
  return txt;
}

function buildTaxMailBody(acct) {
  const fee   = Number(acct.agencyFee) || 0;
  const vat   = Math.round(fee * 0.1);
  const total = fee + vat;
  const fmt   = n => n.toLocaleString('ko-KR') + '만원';
  const paidFmt = acct.feePaidDate ? acct.feePaidDate.replace(/-/g, '.') : '—';

  // 연결된 캠페인 목록
  let campList = '';
  try {
    const allCamps = JSON.parse(localStorage.getItem(CAMPAIGN_KEY)) || [];
    const linked   = allCamps.filter(c => String(c.accountId) === String(acct.id));
    if (linked.length) campList = '\n▶ 집행 캠페인 목록\n' + linked.map(c => `  · ${c.name}`).join('\n') + '\n';
  } catch {}

  return `안녕하세요,

${acct.name}의 광고 대행수수료 지급일(${paidFmt})이 도래하였습니다.
매체사(광고대행사)에 세금계산서 발행을 요청해 주세요.
${campList}
💰 대행 수수료 내역
  대행료 : ${fmt(fee)}
  VAT 10%: ${fmt(vat)}
  합   계 : ${fmt(total)}

─────────────────────────────────
✅ 체크리스트

1. 결재선 (승인 · 참조)
${buildApprovalText()}
─────────────────────────────────

2. 필요 서류
   링크: ${FLEX_WORKFLOW_URL}

   ☐ 광고대행사 통장 사본
   ☐ 광고대행사 발행 '대행수수료' 세금계산서
   ☐ 광고계약신청서
   ☐ 광고대행사 사업자 등록증

─────────────────────────────────
감사합니다.`;
}

function buildExpenseMailBody(acct) {
  const paidFmt = acct.feePaidDate ? acct.feePaidDate.replace(/-/g, '.') : '—';
  const fee   = Number(acct.agencyFee) || 0;
  const vat   = Math.round(fee * 0.1);
  const total = fee + vat;
  const fmt   = n => n.toLocaleString('ko-KR') + '만원';

  return `안녕하세요,

${acct.name}의 광고 대행수수료 입금일(${paidFmt})이 다가옵니다.
입금일 1주일 전에 내부 지출 품의서 작성을 완료해 주세요.

💰 지출 금액
  대행료 : ${fmt(fee)}
  VAT 10%: ${fmt(vat)}
  합   계 : ${fmt(total)}

─────────────────────────────────
📋 품의서 작성 체크리스트

1. 결재선 (승인 · 참조)
${buildApprovalText()}
─────────────────────────────────

2. 첨부 서류 (품의서 작성 시 첨부)
   ☐ 광고대행사 견적서
   ☐ 광고대행사 발행 세금계산서
   ☐ 광고 성과 보고서

─────────────────────────────────
감사합니다.`;
}

function openFeeMailModal(acctId, type) {
  const acct = accounts.find(a => a.id === acctId);
  if (!acct) return;

  const isTax    = type === 'tax';
  const subject  = isTax
    ? `[세금계산서 발행 요청] ${acct.name} 광고 대행수수료 (${acct.feePaidDate})`
    : `[품의서 작성 요청] ${acct.name} 광고 대행수수료 지급 예정 (${acct.feePaidDate})`;
  const body     = isTax ? buildTaxMailBody(acct) : buildExpenseMailBody(acct);
  const toEmail  = acct.email || '';

  document.getElementById('feeMailTitle').textContent   = isTax ? '세금계산서 발행 요청 메일' : '내부 지출 품의서 작성 안내 메일';
  document.getElementById('feeMailTo').textContent      = toEmail || '(정산 이메일 미설정)';
  document.getElementById('feeMailSubject').textContent = subject;
  document.getElementById('feeMailContent').textContent = body;
  document.getElementById('feeMailtoLink').href =
    `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  document.getElementById('feeMailCopyBtn').onclick = () => {
    navigator.clipboard.writeText(body).then(() => {
      document.getElementById('feeMailCopyBtn').textContent = '✓ 복사됨';
      setTimeout(() => { document.getElementById('feeMailCopyBtn').textContent = '내용 복사'; }, 2000);
    });
  };

  const overlay = document.getElementById('feeMailOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

function closeFeeMailModal() {
  const overlay = document.getElementById('feeMailOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('feeMailCloseBtn');
  const overlay  = document.getElementById('feeMailOverlay');
  if (closeBtn) closeBtn.addEventListener('click', closeFeeMailModal);
  if (overlay)  overlay.addEventListener('click', e => { if (e.target === e.currentTarget) closeFeeMailModal(); });
});
