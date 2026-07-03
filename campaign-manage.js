// ─── 상수 ───────────────────────────────────────────────
const STORAGE_KEY = 'nemo_campaigns_v4';
const ACCT_KEY    = 'nemo_ad_accounts_v4';

const PRODUCTS = {
  'main-popup':      '메인팝업',
  'main-banner':     '메인배너',
  'list-feed':       '리스트피드',
  'channel-talk':    '채널톡',
  'position-marker': '포지션마커',
  'discovery':       '디스커버리',
  'endpoint':        '엔드포인트',
  'app-push':        '앱푸시',
};

const PRODUCT_COLORS = {
  'main-popup':      'pink',
  'main-banner':     'blue',
  'list-feed':       'green',
  'channel-talk':    'yellow',
  'position-marker': 'purple',
  'discovery':       'teal',
  'endpoint':        'orange',
  'app-push':        'indigo',
};

// 상품별 앱 미리보기 사이즈 레이블
const PRODUCT_SIZE = {
  'main-popup':      '메인 팝업 앱 (392:260)',
  'main-banner':     '메인 배너 앱 (720:100)',
  'list-feed':       '리스트피드 앱 (640:200)',
  'channel-talk':    '채널톡 앱 (640:200)',
  'position-marker': '포지션마커 앱 (200:200)',
  'discovery':       '디스커버리 앱 (640:320)',
  'endpoint':        '엔드포인트 앱 (720:200)',
  'app-push':        '앱푸시 (720:240)',
};
const PRODUCT_SIZE_WEB = {
  'main-popup':      '메인 팝업 웹 (800:400)',
  'main-banner':     '메인 배너 웹 (1200:120)',
  'list-feed':       '리스트피드 웹 (1200:300)',
  'channel-talk':    '채널톡 웹 (1200:300)',
  'position-marker': '포지션마커 웹 (300:300)',
  'discovery':       '디스커버리 웹 (1200:500)',
  'endpoint':        '엔드포인트 웹 (1200:300)',
  'app-push':        '앱푸시 웹 (1200:360)',
};

const STATUS_LABELS = {
  scheduled: '예정',
  active:    '진행중',
  ended:     '종료',
};

// 라이브 캠페인 시드 → data/live-campaigns.js (LIVE_CAMPAIGNS)

// ─── 상태 ────────────────────────────────────────────────
let campaigns = [];
let accounts  = [];
let filterProduct = '';
let filterStatus  = '';
let filterAccount = ''; // URL 파라미터 또는 선택
let filterAccountType = '';
let searchQuery   = '';
let editingId     = null;
let deletingId    = null;
let previewView   = 'app';
let appImageDataUrl = '';
let webImageDataUrl = '';

// ─── 유틸 ────────────────────────────────────────────────
function getSeedCampaigns() {
  return typeof LIVE_CAMPAIGNS !== 'undefined' ? LIVE_CAMPAIGNS.map(c => ({ ...c })) : [];
}

function loadCampaigns() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { campaigns = JSON.parse(raw); ensurePartnerCampaigns(); return; } catch { /* seed fallback */ }
  }
  campaigns = getSeedCampaigns();
  saveCampaigns();
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
  try {
    const raw = localStorage.getItem(ACCT_KEY);
    accounts = raw ? JSON.parse(raw) : [];
  } catch { accounts = []; }
}

function accountName(accountId) {
  if (!accountId) return '';
  const a = accounts.find(x => String(x.id) === String(accountId));
  return a ? a.name : '';
}

function accountType(accountId) {
  if (!accountId) return '';
  const a = accounts.find(x => String(x.id) === String(accountId));
  return a ? a.type : '';
}

function campaignsForStats() {
  return campaigns.filter(c => {
    if (filterAccount && String(c.accountId) !== String(filterAccount)) return false;
    if (filterAccountType && accountType(c.accountId) !== filterAccountType) return false;
    return true;
  });
}

function accountTypeLabel(a) {
  if (!a) return '';
  if (a.type === 'agency') return '광고대행사';
  const subs = Array.isArray(a.advertiserSubtypes) && a.advertiserSubtypes.length
    ? a.advertiserSubtypes
    : (a.type === 'partner' ? ['regular_partner'] : []);
  const SUB = { regular_partner: '정기 파트너사', general: '일반 광고주' };
  const subText = subs.map(k => SUB[k] || k).join(' · ');
  return subText ? `광고주 · ${subText}` : '광고주';
}

function populateAccountSelect(selectedId) {
  const sel = document.getElementById('campaignAccountId');
  if (!sel) return;
  sel.innerHTML = '<option value="">계정 선택</option>'
    + accounts.map(a =>
        `<option value="${a.id}" ${String(a.id) === String(selectedId) ? 'selected' : ''}>
          ${escHtml(a.name)} (${escHtml(accountTypeLabel(a))})
        </option>`
      ).join('');
}

function saveCampaigns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
}

function nextId() {
  return campaigns.length > 0 ? Math.max(...campaigns.map(c => c.id)) + 1 : 1;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr.slice(0, 10).replace(/-/g, '.');
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}.${m}.${day}`;
}

function today() {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── 렌더 ────────────────────────────────────────────────
function filteredCampaigns() {
  return campaigns.filter(c => {
    if (filterAccount && String(c.accountId) !== String(filterAccount)) return false;
    if (filterAccountType && accountType(c.accountId) !== filterAccountType) return false;
    if (filterProduct && c.product !== filterProduct) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
}

function renderStats() {
  const list = campaignsForStats();
  document.getElementById('statTotal').textContent     = list.length;
  document.getElementById('statScheduled').textContent = list.filter(c => c.status === 'scheduled').length;
  document.getElementById('statActive').textContent    = list.filter(c => c.status === 'active').length;
  document.getElementById('statEnded').textContent     = list.filter(c => c.status === 'ended').length;
}

function renderTable() {
  const list = filteredCampaigns();
  const tbody = document.getElementById('campaignTbody');
  const empty = document.getElementById('manageEmpty');

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = list.map(c => {
    const acctLabel = accountName(c.accountId);
    return `
    <tr data-id="${c.id}">
      <td class="manage-td-name">
        <span class="manage-campaign-name">${escHtml(c.name)}</span>
        ${c.desc ? `<span class="manage-campaign-note">${escHtml(c.desc)}</span>` : ''}
      </td>
      <td>
        ${acctLabel
          ? `<a href="ad-accounts.html" class="manage-acct-link">${escHtml(acctLabel)}</a>`
          : '<span style="color:var(--text-muted);font-size:.8125rem">—</span>'}
      </td>
      <td>
        <span class="manage-product manage-product--${PRODUCT_COLORS[c.product] || 'gray'}">
          ${PRODUCTS[c.product] || c.product}
        </span>
      </td>
      <td>
        <span class="manage-status manage-status--${c.status}">
          ${STATUS_LABELS[c.status] || c.status}
        </span>
      </td>
      <td class="manage-td-date">${formatDate(c.startDate)} ~ ${formatDate(c.endDate)}</td>
      <td class="manage-td-date">${formatDate(c.createdAt)}</td>
      <td class="manage-td-actions">
        <button class="manage-icon-btn" data-action="edit" data-id="${c.id}" aria-label="편집">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="manage-icon-btn manage-icon-btn--danger" data-action="delete" data-id="${c.id}" aria-label="삭제">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function render() {
  renderStats();
  renderTable();
}

// ─── 미리보기 ─────────────────────────────────────────────
function updatePreview() {
  const product = document.getElementById('campaignProduct').value;
  const sizeLabel = document.getElementById('previewSizeLabel');
  const previewImg = document.getElementById('previewImg');
  const placeholder = document.getElementById('previewPlaceholder');
  const previewBox = document.getElementById('previewBox');

  // 사이즈 레이블
  const sizeMap = previewView === 'app' ? PRODUCT_SIZE : PRODUCT_SIZE_WEB;
  sizeLabel.textContent = sizeMap[product] || '';

  // 이미지
  const dataUrl = previewView === 'app' ? appImageDataUrl : webImageDataUrl;
  if (dataUrl) {
    previewImg.src = dataUrl;
    previewImg.hidden = false;
    placeholder.hidden = true;
  } else {
    previewImg.hidden = true;
    placeholder.hidden = false;
  }

  // 배경색
  const mode = document.querySelector('.manage-color-toggle-btn.is-active[data-mode]')?.dataset.mode;
  const c1 = document.getElementById('bgColor1').value;
  const c2 = document.getElementById('bgColor2').value;
  if (mode === 'gradient') {
    previewBox.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
  } else {
    previewBox.style.background = c1;
  }
}

// ─── 이미지 업로드 ─────────────────────────────────────────
function setupDropzone(zoneId, inputId, previewId, removeId, emptyId, type) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const remove  = document.getElementById(removeId);
  const empty   = document.getElementById(emptyId);

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { alert('10MB 이하 이미지만 업로드할 수 있습니다.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      if (type === 'app') appImageDataUrl = dataUrl;
      else webImageDataUrl = dataUrl;
      preview.src = dataUrl;
      preview.hidden = false;
      empty.hidden = true;
      remove.hidden = false;
      zone.classList.add('has-image');
      updatePreview();
    };
    reader.readAsDataURL(file);
  }

  zone.addEventListener('click', e => {
    if (e.target === remove) return;
    input.click();
  });
  input.addEventListener('change', () => { if (input.files[0]) loadFile(input.files[0]); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('is-dragover');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  remove.addEventListener('click', e => {
    e.stopPropagation();
    if (type === 'app') appImageDataUrl = '';
    else webImageDataUrl = '';
    preview.src = '';
    preview.hidden = true;
    empty.hidden = false;
    remove.hidden = true;
    zone.classList.remove('has-image');
    input.value = '';
    updatePreview();
  });
}

// ─── 색상 피커 ────────────────────────────────────────────
function syncColor(colorInput, hexInput) {
  colorInput.addEventListener('input', () => {
    hexInput.value = colorInput.value;
    updatePreview();
  });
  hexInput.addEventListener('input', () => {
    const v = hexInput.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) colorInput.value = v;
    updatePreview();
  });
}

// ─── 모달 ────────────────────────────────────────────────
function openModal(id = null) {
  editingId = id;
  appImageDataUrl = '';
  webImageDataUrl = '';
  clearErrors();
  resetDropzone('app');
  resetDropzone('web');
  populateAccountSelect(filterAccount || '');

  const overlay = document.getElementById('campaignModalOverlay');
  const title   = document.getElementById('modalTitle');
  const saveBtn = document.getElementById('modalSaveBtn');
  saveBtn.querySelector('.btn-text').textContent = '개발 서버에서 먼저 확인하기';

  if (id !== null) {
    const c = campaigns.find(x => x.id === id);
    if (!c) return;
    title.textContent = '캠페인 수정';
    populateAccountSelect(c.accountId || '');
    document.getElementById('campaignId').value        = c.id;
    document.getElementById('campaignName').value      = c.name;
    document.getElementById('campaignDesc').value      = c.desc || '';
    document.getElementById('campaignAccountId').value = c.accountId || '';
    document.getElementById('campaignProduct').value   = c.product;
    document.getElementById('campaignStatus').value    = c.status;
    document.getElementById('campaignStart').value   = c.startDate || '';
    document.getElementById('campaignEnd').value     = c.endDate || '';
    document.getElementById('bgColor1').value        = c.bgColor1 || '#ffffff';
    document.getElementById('bgColor1Hex').value     = c.bgColor1 || '#ffffff';
    document.getElementById('bgColor2').value        = c.bgColor2 || '#eeeeee';
    document.getElementById('bgColor2Hex').value     = c.bgColor2 || '#eeeeee';
    document.getElementById('ctaColor').value        = c.ctaColor || '#000000';
    document.getElementById('ctaColorHex').value     = c.ctaColor || '#000000';
    document.getElementById('ctaLabel').value        = c.ctaLabel || '';
    document.getElementById('ctaLinkType').value     = c.ctaLinkType || 'external';
    document.getElementById('ctaUrl').value          = c.ctaUrl || '';
    document.getElementById('trackingId').value      = c.trackingId || '';
    setBgMode(c.bgColorMode || 'solid');
    if (c.appImage) { appImageDataUrl = c.appImage; loadPreviewImage('app', c.appImage); }
    if (c.webImage) { webImageDataUrl = c.webImage; loadPreviewImage('web', c.webImage); }
  } else {
    title.textContent = '새 캠페인';
    document.getElementById('campaignForm').reset();
    document.getElementById('campaignId').value  = '';
    document.getElementById('campaignStart').value = today();
    document.getElementById('bgColor1').value    = '#ffffff';
    document.getElementById('bgColor1Hex').value = '#ffffff';
    document.getElementById('bgColor2').value    = '#eeeeee';
    document.getElementById('bgColor2Hex').value = '#eeeeee';
    document.getElementById('ctaColor').value    = '#000000';
    document.getElementById('ctaColorHex').value = '#000000';
    setBgMode('solid');
  }

  previewView = 'app';
  document.querySelectorAll('.manage-preview-toggle-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.view === 'app');
  });
  updatePreview();

  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  document.getElementById('campaignName').focus();
}

function loadPreviewImage(type, dataUrl) {
  const previewId = type === 'app' ? 'appImagePreview' : 'webImagePreview';
  const emptyId   = type === 'app' ? 'appImageEmpty' : 'webImageEmpty';
  const removeId  = type === 'app' ? 'appImageRemove' : 'webImageRemove';
  const zoneId    = type === 'app' ? 'appImageZone' : 'webImageZone';
  document.getElementById(previewId).src = dataUrl;
  document.getElementById(previewId).hidden = false;
  document.getElementById(emptyId).hidden = true;
  document.getElementById(removeId).hidden = false;
  document.getElementById(zoneId).classList.add('has-image');
}

function resetDropzone(type) {
  const previewId = type === 'app' ? 'appImagePreview' : 'webImagePreview';
  const emptyId   = type === 'app' ? 'appImageEmpty' : 'webImageEmpty';
  const removeId  = type === 'app' ? 'appImageRemove' : 'webImageRemove';
  const zoneId    = type === 'app' ? 'appImageZone' : 'webImageZone';
  const inputId   = type === 'app' ? 'appImageInput' : 'webImageInput';
  document.getElementById(previewId).src = '';
  document.getElementById(previewId).hidden = true;
  document.getElementById(emptyId).hidden = false;
  document.getElementById(removeId).hidden = true;
  document.getElementById(zoneId).classList.remove('has-image');
  document.getElementById(inputId).value = '';
}

function closeModal() {
  const overlay = document.getElementById('campaignModalOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
  editingId = null;
}

function openDeleteModal(id) {
  const c = campaigns.find(x => x.id === id);
  if (!c) return;
  deletingId = id;
  document.getElementById('deleteCampaignName').textContent = c.name;
  const overlay = document.getElementById('deleteModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

function closeDeleteModal() {
  const overlay = document.getElementById('deleteModalOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
  deletingId = null;
}

// ─── 배경색 모드 ──────────────────────────────────────────
function setBgMode(mode) {
  document.querySelectorAll('.manage-color-toggle-btn[data-mode]').forEach(b => {
    b.classList.toggle('is-active', b.dataset.mode === mode);
  });
  const isGrad = mode === 'gradient';
  document.getElementById('bgColor2Wrap').hidden = !isGrad;
  document.getElementById('bgColor2').hidden = !isGrad;
  document.getElementById('bgColor2Hex').hidden = !isGrad;
  updatePreview();
}

// ─── 폼 검증 ─────────────────────────────────────────────
function clearErrors() {
  document.querySelectorAll('.manage-field-error').forEach(el => el.textContent = '');
}

function showError(field, msg) {
  const el = document.querySelector(`.manage-field-error[data-error="${field}"]`);
  if (el) el.textContent = msg;
}

function validateForm() {
  clearErrors();
  let ok = true;
  const name    = document.getElementById('campaignName').value.trim();
  const product = document.getElementById('campaignProduct').value;
  const start   = document.getElementById('campaignStart').value;
  const end     = document.getElementById('campaignEnd').value;

  if (!name)    { showError('name',   '캠페인명을 입력하세요.'); ok = false; }
  if (!product) { showError('product','배너 타입을 선택하세요.'); ok = false; }
  if (start && end && end < start) { showError('start', '종료일이 시작일보다 빠릅니다.'); ok = false; }

  return ok;
}

// ─── 저장 ────────────────────────────────────────────────
async function saveCampaign() {
  if (!validateForm()) return;

  const saveBtn    = document.getElementById('modalSaveBtn');
  const btnText    = saveBtn.querySelector('.btn-text');
  const btnLoading = saveBtn.querySelector('.btn-loading');
  saveBtn.disabled = true;
  btnText.hidden   = true;
  btnLoading.hidden = false;

  await new Promise(r => setTimeout(r, 200));

  const bgMode = document.querySelector('.manage-color-toggle-btn.is-active[data-mode]')?.dataset.mode || 'solid';
  const data = {
    name:        document.getElementById('campaignName').value.trim(),
    desc:        document.getElementById('campaignDesc').value.trim(),
    accountId:   document.getElementById('campaignAccountId').value || null,
    product:     document.getElementById('campaignProduct').value,
    status:      document.getElementById('campaignStatus').value,
    startDate:   document.getElementById('campaignStart').value,
    endDate:     document.getElementById('campaignEnd').value,
    appImage:    appImageDataUrl,
    webImage:    webImageDataUrl,
    bgColorMode: bgMode,
    bgColor1:    document.getElementById('bgColor1').value,
    bgColor2:    document.getElementById('bgColor2').value,
    ctaColor:    document.getElementById('ctaColor').value,
    ctaLabel:    document.getElementById('ctaLabel').value.trim(),
    ctaLinkType: document.getElementById('ctaLinkType').value,
    ctaUrl:      document.getElementById('ctaUrl').value.trim(),
    trackingId:  document.getElementById('trackingId').value.trim(),
  };

  if (editingId !== null) {
    const idx = campaigns.findIndex(c => c.id === editingId);
    if (idx !== -1) campaigns[idx] = { ...campaigns[idx], ...data };
  } else {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    campaigns.unshift({ id: nextId(), createdAt, ...data });
  }

  saveCampaigns();
  render();
  closeModal();

  const sync = await syncCampaignRegistry(campaigns, accounts);
  showPublishToast(
    sync.success ? '개발 서버에 반영했습니다. nemoapp.net에서 확인해 주세요.' : `저장됨 · 개발 서버 반영 실패: ${sync.error}`,
    !sync.success
  );

  saveBtn.disabled  = false;
  btnText.hidden    = false;
  btnLoading.hidden = true;
}

// ─── 삭제 ────────────────────────────────────────────────
async function deleteCampaign() {
  if (deletingId === null) return;
  campaigns = campaigns.filter(c => c.id !== deletingId);
  saveCampaigns();
  render();
  closeDeleteModal();
  const sync = await syncCampaignRegistry(campaigns, accounts);
  if (!sync.success) showPublishToast(`삭제됨 · 개발 서버 반영 실패: ${sync.error}`, true);
}

// ─── 이벤트 ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAccounts();
  loadCampaigns();

  // URL 파라미터로 계정 필터 적용
  const params = new URLSearchParams(window.location.search);
  const acctIdParam = params.get('accountId');
  if (acctIdParam) {
    filterAccount = acctIdParam;
    const acct = accounts.find(a => String(a.id) === acctIdParam);
    if (acct) {
      const banner = document.getElementById('acctFilterBanner');
      const bannerText = document.getElementById('acctFilterBannerText');
      banner.style.display = 'flex';
      bannerText.textContent = acct.name;
    }
  }

  render();

  // 드롭존
  setupDropzone('appImageZone', 'appImageInput', 'appImagePreview', 'appImageRemove', 'appImageEmpty', 'app');
  setupDropzone('webImageZone', 'webImageInput', 'webImagePreview', 'webImageRemove', 'webImageEmpty', 'web');

  // 색상 피커 동기화
  syncColor(document.getElementById('bgColor1'), document.getElementById('bgColor1Hex'));
  syncColor(document.getElementById('bgColor2'), document.getElementById('bgColor2Hex'));
  syncColor(document.getElementById('ctaColor'), document.getElementById('ctaColorHex'));

  // 배경색 모드 토글
  document.getElementById('bgColorToggle').addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]');
    if (btn) setBgMode(btn.dataset.mode);
  });

  // 상품 변경 → 미리보기 갱신
  document.getElementById('campaignProduct').addEventListener('change', updatePreview);

  // 미리보기 앱/웹 토글
  document.getElementById('previewToggle').addEventListener('click', e => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    previewView = btn.dataset.view;
    document.querySelectorAll('.manage-preview-toggle-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.view === previewView);
    });
    updatePreview();
  });

  // 새 캠페인
  document.getElementById('newCampaignBtn').addEventListener('click', () => openModal());
  document.getElementById('emptyNewBtn').addEventListener('click', () => openModal());

  // 모달 닫기
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  document.getElementById('campaignModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // 저장
  document.getElementById('modalSaveBtn').addEventListener('click', () => { saveCampaign(); });

  // 삭제 모달
  document.getElementById('deleteCloseBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirmBtn').addEventListener('click', deleteCampaign);
  document.getElementById('deleteModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });

  // 테이블 액션 (이벤트 위임)
  document.getElementById('campaignTbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'edit')   openModal(id);
    if (btn.dataset.action === 'delete') openDeleteModal(id);
  });

  // 유형 탭
  document.getElementById('campaignTypeTabs').addEventListener('click', e => {
    const btn = e.target.closest('.acct-type-tab');
    if (!btn) return;
    filterAccountType = btn.dataset.type;
    document.querySelectorAll('#campaignTypeTabs .acct-type-tab').forEach(b => {
      b.classList.toggle('is-active', b.dataset.type === filterAccountType);
    });
    render();
  });

  // 필터
  document.getElementById('filterProduct').addEventListener('change', e => {
    filterProduct = e.target.value; renderTable();
  });
  document.getElementById('filterStatus').addEventListener('change', e => {
    filterStatus = e.target.value; renderTable();
  });
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value; renderTable();
  });

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); closeMailPreview(); }
  });

  // 알림 벨 초기화
  initNotifications();
});

// ════════════════════════════════════════════════
//  알림 & 메일 미리보기
// ════════════════════════════════════════════════

// 결재선 (스크린샷 기준 고정)
const APPROVAL_CHAIN = [
  { stage: '참조',    name: 'Finance',  dept: '기타/직방',  role: '참조' },
  { stage: '참조',    name: '최현아',   dept: 'Office Work', role: '참조' },
  { stage: '참조',    name: '손보람',   dept: '기타/직방',  role: '참조' },
  { stage: '1단계',   name: '윤서현',   dept: 'Growth',     role: '승인' },
  { stage: '2단계',   name: '장길수',   dept: '온하우스',   role: '승인' },
  { stage: '3단계',   name: 'BK KANG', dept: '기타/직방',  role: '승인' },
];

const FLEX_WORKFLOW_URL =
  'https://flex.team/workflow/archive/my?workflow-action=view&workflow-task-key=818a39774ecb4949a1f2595757420c75';

function daysUntilEnd(endDateStr) {
  if (!endDateStr) return Infinity;
  const end  = new Date(endDateStr);
  const now  = new Date();
  end.setHours(23, 59, 59, 0);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function getExpiringCampaigns(withinDays = 7) {
  return campaigns.filter(c => {
    if (c.status === 'ended') return false;
    const d = daysUntilEnd(c.endDate);
    return d >= 0 && d <= withinDays;
  }).sort((a, b) => daysUntilEnd(a.endDate) - daysUntilEnd(b.endDate));
}

function initNotifications() {
  const expiring = getExpiringCampaigns(7);
  const badge    = document.getElementById('notifBadge');
  const bellBtn  = document.getElementById('notifBellBtn');
  const list     = document.getElementById('notifList');
  const empty    = document.getElementById('notifEmpty');

  if (expiring.length > 0) {
    badge.textContent    = expiring.length;
    badge.style.display  = 'flex';
    bellBtn.classList.add('has-notif');
  } else {
    badge.style.display = 'none';
    bellBtn.classList.remove('has-notif');
  }

  if (expiring.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    list.innerHTML = expiring.map(c => {
      const days    = daysUntilEnd(c.endDate);
      const acctLbl = accountName(c.accountId);
      const urgency = days <= 1 ? 'urgent' : days <= 3 ? 'warning' : '';
      return `
        <li class="notif-item ${urgency}">
          <div class="notif-item-info">
            <span class="notif-item-name">${escHtml(c.name)}</span>
            <span class="notif-item-meta">
              ${acctLbl ? escHtml(acctLbl) + ' · ' : ''}${PRODUCTS[c.product] || c.product}
            </span>
          </div>
          <div class="notif-item-right">
            <span class="notif-days ${urgency}">${days === 0 ? 'D-Day' : 'D-' + days}</span>
            <button class="notif-mail-btn" data-camp-id="${c.id}" aria-label="메일 발송">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              메일
            </button>
          </div>
        </li>`;
    }).join('');
  }

  // 벨 토글
  bellBtn.addEventListener('click', e => {
    e.stopPropagation();
    const dd = document.getElementById('notifDropdown');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  });

  // 메일 버튼
  list.addEventListener('click', e => {
    const btn = e.target.closest('.notif-mail-btn');
    if (!btn) return;
    openMailPreview(Number(btn.dataset.campId));
    document.getElementById('notifDropdown').style.display = 'none';
  });

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', e => {
    if (!document.getElementById('notifBellWrap').contains(e.target)) {
      document.getElementById('notifDropdown').style.display = 'none';
    }
  });
}

// ─── 메일 미리보기 ────────────────────────────────────────
function buildApprovalText() {
  const refs    = APPROVAL_CHAIN.filter(x => x.role === '참조');
  const approvals = APPROVAL_CHAIN.filter(x => x.role === '승인');

  let txt = '▶ 결재선 (승인 · 참조)\n\n';
  txt += '[참조]\n';
  refs.forEach(r => { txt += `  • ${r.name} (${r.dept})\n`; });
  txt += '\n';
  approvals.forEach(a => {
    txt += `[${a.stage} 완료] ${a.name} (${a.dept}) — ${a.role}\n`;
  });
  return txt;
}

function buildMailBody(campaign) {
  const acctLbl  = accountName(campaign.accountId) || '(계정 미지정)';
  const acctData = accounts.find(a => String(a.id) === String(campaign.accountId));
  const fee      = acctData ? Number(acctData.agencyFee) || 0 : 0;
  const feeVat   = Math.round(fee * 0.1);
  const feeTotal = fee + feeVat;
  const fmtFee   = n => n.toLocaleString('ko-KR') + '만원';
  const endFmt   = campaign.endDate ? campaign.endDate.slice(0, 10).replace(/-/g, '.') : '—';

  const feeSection = fee > 0
    ? `\n💰 대행 수수료: ${fmtFee(fee)} + VAT ${fmtFee(feeVat)} = 합계 ${fmtFee(feeTotal)}\n`
    : '';

  return `안녕하세요,

${acctLbl}의 [${campaign.name}] 대행수수료 지급일이 다가오고 있습니다.

세금 계산서를 매체사에 발행 요청해주세요.
또한 내부 지출 품의서를 입금일 1주일 전에 작성해주세요.

📅 광고 종료일: ${endFmt}
🏢 광고주 계정: ${acctLbl}
📋 캠페인: ${campaign.name}${feeSection}

─────────────────────────────────
✅ 체크리스트
─────────────────────────────────

1. ${buildApprovalText()}
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

function openMailPreview(campaignId) {
  const c = campaigns.find(x => x.id === campaignId);
  if (!c) return;

  const acctLbl  = accountName(c.accountId) || '(계정 미지정)';
  const acctData = accounts.find(a => String(a.id) === String(c.accountId));
  const toEmail  = acctData ? acctData.email : '';
  const subject  = `[알림] ${acctLbl}의 ${c.name} 대행수수료 지급 안내`;
  const body     = buildMailBody(c);

  document.getElementById('mailTo').textContent      = toEmail || '(정산 이메일 미설정)';
  document.getElementById('mailSubject').textContent = subject;

  // HTML 렌더링
  const content = document.getElementById('mailPreviewContent');
  content.textContent = body;

  // mailto 링크
  const mailto = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById('mailtoLink').href = mailto;

  // 복사 버튼
  document.getElementById('mailCopyBtn').onclick = () => {
    navigator.clipboard.writeText(body).then(() => {
      const btn = document.getElementById('mailCopyBtn');
      btn.textContent = '✓ 복사됨';
      setTimeout(() => { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 내용 복사'; }, 2000);
    });
  };

  const overlay = document.getElementById('mailPreviewOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

function closeMailPreview() {
  const overlay = document.getElementById('mailPreviewOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
}

document.addEventListener('DOMContentLoaded', () => {
  // 메일 미리보기 닫기 (별도 리스너 — DOMContentLoaded 이후)
  document.getElementById('mailPreviewCloseBtn').addEventListener('click', closeMailPreview);
  document.getElementById('mailPreviewOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeMailPreview();
  });
});
