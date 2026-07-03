/** 문의하기 제출 ↔ 광고주 계정관리「계약 진행」localStorage 연동 */
const NEMO_BOOKINGS_KEY = 'nemo_bookings_v1';
const NEMO_BOOKINGS_EVENT = 'nemo:bookings-updated';

function readBookingsFromStorage() {
  try {
    const raw = localStorage.getItem(NEMO_BOOKINGS_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeBookingsToStorage(bookings) {
  localStorage.setItem(NEMO_BOOKINGS_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new CustomEvent(NEMO_BOOKINGS_EVENT, { detail: { count: bookings.length } }));
}

function saveInquiryBooking(inquiry) {
  const existing = readBookingsFromStorage();
  const bookings = Array.isArray(existing) ? [...existing] : [];
  const nextId = bookings.reduce((max, b) => Math.max(max, b.id || 0), 0) + 1;

  const booking = {
    id: nextId,
    company: inquiry.company,
    email: inquiry.contactEmail || '',
    status: 'lead_received',
    accountId: null,
    memo: '문의하기 제출',
    createdAt: new Date().toISOString().slice(0, 10),
    inquiryType: inquiry.inquiryType || '',
    budget: inquiry.budget || '',
    schedule: inquiry.schedule || '',
    purpose: inquiry.purpose || '',
    phoneInquiryTime: inquiry.phoneInquiryTime || '',
    materialCount: inquiry.materialCount || '',
    consentRequired: inquiry.consentRequired || 'N',
    consentMarketingAds: inquiry.consentMarketingAds || 'N',
    consentMarketingUse: inquiry.consentMarketingUse || 'N',
  };

  bookings.push(booking);
  writeBookingsToStorage(bookings);
  return booking;
}

function hasInquiryDetail(booking) {
  return Boolean(
    booking && (
      booking.inquiryType ||
      booking.budget ||
      booking.schedule ||
      booking.purpose
    )
  );
}
