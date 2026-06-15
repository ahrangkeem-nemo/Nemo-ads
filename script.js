// Google Apps Script 웹 앱 URL (배포 후 아래 값을 교체하세요)
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

const form = document.getElementById('inquiryForm');
const submitBtn = document.getElementById('submitBtn');
const formMessage = document.getElementById('formMessage');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');

const requiredFields = [
  { name: 'inquiryType', message: '문의 주체를 선택해 주세요.' },
  { name: 'company', message: '소속 회사를 입력해 주세요.' },
  { name: 'budget', message: '희망 예산을 입력해 주세요.' },
  { name: 'schedule', message: '집행 일정을 입력해 주세요.' },
  { name: 'purpose', message: '캠페인 목적을 입력해 주세요.' },
  { name: 'contactEmail', message: '연락 가능한 이메일을 입력해 주세요.' },
];

function clearErrors() {
  document.querySelectorAll('.form-group.has-error').forEach((el) => {
    el.classList.remove('has-error');
  });
  document.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
  });
}

function showError(name, message) {
  const errorEl = document.querySelector(`[data-error="${name}"]`);
  if (errorEl) {
    errorEl.textContent = message;
    const group = errorEl.closest('.form-group');
    if (group) group.classList.add('has-error');
  }
}

function validateForm(formData) {
  clearErrors();
  let isValid = true;

  requiredFields.forEach(({ name, message }) => {
    const value = formData.get(name);
    if (!value || String(value).trim() === '') {
      showError(name, message);
      isValid = false;
    }
  });

  const budget = formData.get('budget');
  const budgetNum = Number(String(budget).replace(/,/g, ''));
  if (budget && !/^\d+$/.test(String(budget).replace(/,/g, ''))) {
    showError('budget', '희망 예산은 숫자만 입력해 주세요.');
    isValid = false;
  } else if (budget && budgetNum < 250) {
    showError('budget', '집행 최소 금액은 250만원입니다.');
    isValid = false;
  }

  const contactEmail = (formData.get('contactEmail') || '').trim();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    showError('contactEmail', '올바른 이메일 형식을 입력해 주세요.');
    isValid = false;
  }

  if (!formData.get('consentRequired')) {
    showError('consentRequired', '필수 동의 항목에 체크해 주세요.');
    isValid = false;
  }

  return isValid;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnText.hidden = isLoading;
  btnLoading.hidden = !isLoading;
}

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`;
}

function formatBudget(value) {
  const num = String(value).replace(/,/g, '');
  return Number(num).toLocaleString('ko-KR');
}

document.getElementById('budget').addEventListener('blur', (e) => {
  const raw = e.target.value.replace(/,/g, '');
  if (/^\d+$/.test(raw)) {
    e.target.value = formatBudget(raw);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(form);

  if (!validateForm(formData)) {
    showMessage('입력 내용을 확인해 주세요.', 'error');
    return;
  }

  if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
    showMessage('Google Apps Script URL을 script.js에 설정해 주세요.', 'error');
    return;
  }

  const payload = {
    inquiryType: formData.get('inquiryType'),
    company: formData.get('company').trim(),
    budget: formData.get('budget').replace(/,/g, ''),
    schedule: formData.get('schedule').trim(),
    purpose: (formData.get('purpose') || '').trim(),
    materialCount: formData.get('materialCount') || '',
    contactEmail: (formData.get('contactEmail') || '').trim(),
    consentRequired: formData.get('consentRequired') ? 'Y' : 'N',
    consentMarketingAds: formData.get('consentMarketingAds') ? 'Y' : 'N',
    consentMarketingUse: formData.get('consentMarketingUse') ? 'Y' : 'N',
  };

  setLoading(true);
  showMessage('', '');

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    form.reset();
    clearErrors();
    showMessage('문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.', 'success');
  } catch {
    showMessage('제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    setLoading(false);
  }
});

document.querySelectorAll('.consent-view-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    window.open(link.href, '_blank', 'noopener,noreferrer');
  });
});
