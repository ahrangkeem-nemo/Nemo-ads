// ─── 계약 진행 ───────────────────────────────────────────

const ACCT_KEY = 'nemo_ad_accounts_v4';
const BOOKING_KEY = typeof NEMO_BOOKINGS_KEY !== 'undefined' ? NEMO_BOOKINGS_KEY : 'nemo_bookings_v1';
const BOOKING_UPDATE_EVENT = typeof NEMO_BOOKINGS_EVENT !== 'undefined' ? NEMO_BOOKINGS_EVENT : 'nemo:bookings-updated';

const BOOKING_STATUS = {
  lead_received:     { label: '문의 접수', tableLabel: '문의 접수', badge: 'lead' },
  contract_progress: { label: '계약·품의 진행중', tableLabel: '계약 품의 진행중', badge: 'progress' },
  booking_ready:     { label: '부킹 완료 · 캠페인 생성 필요', tableLabel: '부킹 완료', badge: 'ready' },
};

const BOOKING_MEDIA_MIX_URL = (typeof LINKS !== 'undefined' && LINKS.bookingFlows?.mediaMix)
  ? LINKS.bookingFlows.mediaMix
  : 'https://docs.google.com/spreadsheets/d/19r-Npy2dVCCUStHQrhvoE-tlTI0B-MUUPWVQWJYGMLA/edit?gid=263859084#gid=263859084';

const BOOKING_PREPAY_NOTE = ' (*현아님 근데 여기 광고대행 16일날 입금 변경될 수 있다고 합니다.)';
const DEMO_BOOKING_COMPANIES = new Set(['수원상가', '신규 OO상가']);

let accounts = [];
let bookings = [];
let filterBookingStatus = '';
let editingBookingId = null;
let nextBookingId = 100;

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadAccounts() {
  try { accounts = JSON.parse(localStorage.getItem(ACCT_KEY)) || []; }
  catch { accounts = []; }
}

function loadBookings() {
  let stored = null;
  if (typeof readBookingsFromStorage === 'function') {
    stored = readBookingsFromStorage();
  } else {
    try { stored = JSON.parse(localStorage.getItem(BOOKING_KEY)); } catch { stored = null; }
  }

  if (Array.isArray(stored) && stored.length) {
    bookings = stored.filter(b => !DEMO_BOOKING_COMPANIES.has(b.company));
    if (bookings.length !== stored.length) {
      localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
    }
  } else {
    bookings = [];
  }
  nextBookingId = Math.max(...bookings.map(b => b.id), 0) + 1;
}

function reloadBookingsFromStorage() {
  const stored = typeof readBookingsFromStorage === 'function'
    ? readBookingsFromStorage()
    : (() => { try { return JSON.parse(localStorage.getItem(BOOKING_KEY)); } catch { return null; } })();

  if (!Array.isArray(stored) || !stored.length) return;
  bookings = stored.filter(b => !DEMO_BOOKING_COMPANIES.has(b.company));
  nextBookingId = Math.max(...bookings.map(b => b.id), 0) + 1;
  renderBookings();
}

function saveBookings() {
  localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new CustomEvent(BOOKING_UPDATE_EVENT, { detail: { count: bookings.length } }));
}

function bookingTableCell(val, { isHtml = false } = {}) {
  if (val === undefined || val === null || String(val).trim() === '') {
    return '<span class="acct-none">—</span>';
  }
  return isHtml ? val : escHtml(String(val));
}

function bookingStatusBadgeClass(status) {
  return BOOKING_STATUS[status]?.badge || 'lead';
}

function bookingStatusSelectHtml(id, currentStatus) {
  const status = BOOKING_STATUS[currentStatus] ? currentStatus : 'lead_received';
  const badge = bookingStatusBadgeClass(status);
  const options = Object.entries(BOOKING_STATUS).map(([value, st]) =>
    `<option value="${value}"${value === status ? ' selected' : ''}>${escHtml(st.tableLabel || st.label)}</option>`
  ).join('');
  return `<select class="booking-status-select booking-status-select--${badge}" data-booking-status="${id}" aria-label="상태 변경">${options}</select>`;
}

function parseBudgetManwon(val) {
  const num = Number(String(val ?? '').replace(/,/g, ''));
  return Number.isNaN(num) ? 0 : num;
}

function getLinkedAccount(booking) {
  if (!booking?.accountId) return null;
  return accounts.find(a => a.id === booking.accountId) || null;
}

function formatTaxRequestDateParts(source) {
  if (!source) return { year: '—', month: '—', day: '—' };
  const d = new Date(source);
  if (Number.isNaN(d.getTime())) return { year: '—', month: '—', day: '—' };
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
  };
}

function buildBookingTaxRequestText(booking) {
  const linkedAcct = getLinkedAccount(booking);
  const fee = parseBudgetManwon(booking?.budget) || Number(linkedAcct?.agencyFee) || 0;
  const vat = Math.round(fee * 0.1);
  const fmt = n => `${n.toLocaleString('ko-KR')}만원`;

  const prepaySource = linkedAcct?.feePaidDate || booking?.createdAt || '';
  const prepayDate = prepaySource ? new Date(prepaySource) : null;
  const prepayDay = prepayDate && !Number.isNaN(prepayDate.getTime())
    ? `${prepayDate.getDate()}일`
    : '—';

  const taxSource = linkedAcct?.taxDate || linkedAcct?.feePaidDate || booking?.createdAt || '';
  const taxParts = formatTaxRequestDateParts(taxSource);
  const email = booking?.email || linkedAcct?.email || '—';

  const supplyText = fee ? fmt(fee) : '—';
  const vatText = fee ? fmt(vat) : '—';

  return `공급가액 : ${supplyText} + 세액 ${vatText}
선입금 예정일 : ${prepayDay}${BOOKING_PREPAY_NOTE}
세금계산서 요청 발행일: ${taxParts.year}년 ${taxParts.month}월 ${taxParts.day}일
발행 이메일: ${email}`;
}

function showBookingCopyToast(message) {
  let toast = document.getElementById('bookingCopyToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'bookingCopyToast';
    toast.className = 'booking-copy-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function copyTextToClipboard(text, successMessage) {
  navigator.clipboard.writeText(text).then(() => {
    showBookingCopyToast(successMessage);
  }).catch(() => {
    window.prompt('아래 내용을 복사해 주세요.', text);
  });
}

function copyBookingTaxRequest(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  copyTextToClipboard(
    buildBookingTaxRequestText(booking),
    '세금계산서 발행 요청 양식이 복사되었습니다.'
  );
}

function bookingFlowCellHtml(b) {
  if (b.status === 'lead_received') {
    return `<a href="${escHtml(BOOKING_MEDIA_MIX_URL)}" class="booking-flow-link" target="_blank" rel="noopener noreferrer">미디어 믹스 바로가기</a>`;
  }
  if (b.status === 'booking_ready') {
    return `<button type="button" class="booking-flow-link" data-booking-action="copy-tax" data-id="${b.id}">양식 복사</button>`;
  }
  return '<span class="acct-none">—</span>';
}

function updateBookingStatus(id, status) {
  if (!BOOKING_STATUS[status]) return;
  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return;
  bookings[idx].status = status;
  saveBookings();
  renderBookings();
}

function fmtBudgetManwon(val) {
  if (!val && val !== 0) return '—';
  const num = Number(String(val).replace(/,/g, ''));
  if (Number.isNaN(num)) return escHtml(String(val));
  return `${num.toLocaleString('ko-KR')}만원`;
}

function renderBookings() {
  const filtered = filterBookingStatus
    ? bookings.filter(b => b.status === filterBookingStatus)
    : bookings;

  document.getElementById('bookingCountAll').textContent = bookings.length;
  document.getElementById('bookingCountLead').textContent = bookings.filter(b => b.status === 'lead_received').length;
  document.getElementById('bookingCountContract').textContent = bookings.filter(b => b.status === 'contract_progress').length;
  document.getElementById('bookingCountReady').textContent = bookings.filter(b => b.status === 'booking_ready').length;

  const tbody = document.getElementById('bookingTbody');
  const empty = document.getElementById('bookingEmpty');
  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(b => {
    const campaignBtn = b.status === 'booking_ready' && b.accountId
      ? `<a class="booking-campaign-link" href="campaign-manage.html?accountId=${b.accountId}">캠페인 생성</a>`
      : '';
    const budgetCell = b.budget ? fmtBudgetManwon(b.budget) : '';
    const materialCell = b.materialCount
      ? `${escHtml(String(b.materialCount))}개`
      : '';

    return `
      <tr>
        <td class="booking-td-company"><strong>${escHtml(b.company || '—')}</strong></td>
        <td>${bookingTableCell(budgetCell, { isHtml: Boolean(budgetCell) })}</td>
        <td>${bookingTableCell(b.schedule)}</td>
        <td class="booking-td-purpose">${bookingTableCell(b.purpose)}</td>
        <td>${b.email
          ? `<a href="mailto:${escHtml(b.email)}" class="acct-email">${escHtml(b.email)}</a>`
          : bookingTableCell('')}</td>
        <td>${bookingTableCell(b.phoneInquiryTime)}</td>
        <td>${materialCell || bookingTableCell('')}</td>
        <td>${bookingStatusSelectHtml(b.id, b.status)}</td>
        <td class="booking-td-flow">${bookingFlowCellHtml(b)}</td>
        <td class="manage-td-actions">
          ${campaignBtn}
          <button class="manage-icon-btn" data-booking-action="edit" data-id="${b.id}" aria-label="편집">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}

function populateBookingAccountSelect(selectedId = '') {
  const sel = document.getElementById('bkAccountId');
  if (!sel) return;
  sel.innerHTML = '<option value="">— 선택 (나중에 연결 가능) —</option>' +
    accounts.map(a => `<option value="${a.id}"${String(a.id) === String(selectedId) ? ' selected' : ''}>${escHtml(a.name)}</option>`).join('');
}

function fmtConsent(val) {
  return val === 'Y' ? '동의' : '미동의';
}

function renderBookingInquiryDetail(booking) {
  const panel = document.getElementById('bkInquiryDetail');
  const dl = document.getElementById('bkInquiryDl');
  if (!panel || !dl) return;

  if (!hasInquiryDetail(booking)) {
    panel.hidden = true;
    dl.innerHTML = '';
    return;
  }

  const rows = [
    ['문의 주체', booking.inquiryType],
    ['소속 회사', booking.company],
    ['희망 예산', fmtBudgetManwon(booking.budget)],
    ['집행 일정', booking.schedule],
    ['캠페인 목적', booking.purpose],
    ['연락 이메일', booking.email],
    ['유선 가능 시간', booking.phoneInquiryTime],
    ['소재 갯수', booking.materialCount ? `${booking.materialCount}개` : ''],
    ['필수 동의', fmtConsent(booking.consentRequired)],
    ['광고성 정보 수신', fmtConsent(booking.consentMarketingAds)],
    ['마케팅 활용 동의', fmtConsent(booking.consentMarketingUse)],
  ].filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '');

  dl.innerHTML = rows.map(([label, val]) =>
    `<div class="booking-inquiry-row"><dt>${escHtml(label)}</dt><dd>${escHtml(String(val))}</dd></div>`
  ).join('');
  panel.hidden = false;
}

function openBookingModal(id = null) {
  editingBookingId = id;
  document.getElementById('bookingModalTitle').textContent = id ? '계약 진행 건 수정' : '계약 진행 건 추가';
  document.querySelector('#bookingForm [data-error="bkCompany"]').textContent = '';

  if (id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    document.getElementById('bkCompany').value = b.company;
    document.getElementById('bkEmail').value = b.email || '';
    document.getElementById('bkStatus').value = b.status;
    document.getElementById('bkMemo').value = b.memo || '';
    populateBookingAccountSelect(b.accountId || '');
    renderBookingInquiryDetail(b);
  } else {
    document.getElementById('bookingForm').reset();
    document.getElementById('bkStatus').value = 'lead_received';
    populateBookingAccountSelect('');
    renderBookingInquiryDetail(null);
  }

  const overlay = document.getElementById('bookingModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  document.getElementById('bkCompany').focus();
}

function closeBookingModal() {
  const overlay = document.getElementById('bookingModalOverlay');
  overlay.classList.remove('is-open');
  setTimeout(() => { overlay.style.display = 'none'; editingBookingId = null; }, 220);
}

function saveBooking() {
  const company = document.getElementById('bkCompany').value.trim();
  const errEl = document.querySelector('#bookingForm [data-error="bkCompany"]');
  if (!company) { errEl.textContent = '회사명을 입력하세요.'; return; }
  errEl.textContent = '';

  const data = {
    company,
    email: document.getElementById('bkEmail').value.trim(),
    status: document.getElementById('bkStatus').value,
    accountId: Number(document.getElementById('bkAccountId').value) || null,
    memo: document.getElementById('bkMemo').value.trim(),
  };

  if (editingBookingId) {
    const idx = bookings.findIndex(b => b.id === editingBookingId);
    if (idx !== -1) bookings[idx] = { ...bookings[idx], ...data };
  } else {
    bookings.push({ id: nextBookingId++, ...data, createdAt: new Date().toISOString().slice(0, 10) });
  }
  saveBookings();
  renderBookings();
  closeBookingModal();
}

function initBookingPage() {
  loadAccounts();
  loadBookings();
  renderBookings();
  populateBookingAccountSelect('');

  window.addEventListener(BOOKING_UPDATE_EVENT, reloadBookingsFromStorage);
  window.addEventListener('storage', (e) => {
    if (e.key === BOOKING_KEY) reloadBookingsFromStorage();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadAccounts();
      reloadBookingsFromStorage();
    }
  });

  document.getElementById('newBookingBtn')?.addEventListener('click', () => openBookingModal());
  document.getElementById('bookingStatusTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.booking-status-tab');
    if (!btn) return;
    filterBookingStatus = btn.dataset.status;
    document.querySelectorAll('.booking-status-tab').forEach(b => {
      b.classList.toggle('is-active', b.dataset.status === filterBookingStatus);
    });
    renderBookings();
  });
  document.getElementById('bookingTbody')?.addEventListener('change', e => {
    const sel = e.target.closest('[data-booking-status]');
    if (!sel) return;
    updateBookingStatus(Number(sel.dataset.bookingStatus), sel.value);
  });
  document.getElementById('bookingTbody')?.addEventListener('click', e => {
    const copyTaxBtn = e.target.closest('[data-booking-action="copy-tax"]');
    if (copyTaxBtn) {
      copyBookingTaxRequest(Number(copyTaxBtn.dataset.id));
      return;
    }
    const editBtn = e.target.closest('[data-booking-action="edit"]');
    if (editBtn) openBookingModal(Number(editBtn.dataset.id));
  });
  document.getElementById('bookingModalSaveBtn')?.addEventListener('click', saveBooking);
  document.getElementById('bookingModalCancelBtn')?.addEventListener('click', closeBookingModal);
  document.getElementById('bookingModalCloseBtn')?.addEventListener('click', closeBookingModal);
  document.getElementById('bookingModalOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBookingModal();
  });
}

document.addEventListener('DOMContentLoaded', initBookingPage);
