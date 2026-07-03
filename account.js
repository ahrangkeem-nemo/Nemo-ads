const accountForm = document.getElementById('accountForm');
const submitBtn = document.getElementById('accountSubmitBtn');
const accountMessage = document.getElementById('accountMessage');
const passwordToggle = document.getElementById('passwordToggle');
const passwordInput = document.getElementById('accountPassword');
const btnText = submitBtn?.querySelector('.btn-text');
const btnLoading = submitBtn?.querySelector('.btn-loading');

function showFieldError(name, message) {
  const errorEl = document.querySelector(`[data-error="${name}"]`);
  const field = errorEl?.closest('.account-field');
  if (errorEl) errorEl.textContent = message;
  field?.classList.toggle('has-error', Boolean(message));
}

function clearFieldErrors() {
  document.querySelectorAll('.account-field').forEach((field) => {
    field.classList.remove('has-error');
  });
  document.querySelectorAll('.account-error').forEach((el) => {
    el.textContent = '';
  });
}

function setLoading(isLoading) {
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  if (btnText) btnText.hidden = isLoading;
  if (btnLoading) btnLoading.hidden = !isLoading;
}

function showMessage(text, type) {
  if (!accountMessage) return;
  accountMessage.textContent = text;
  accountMessage.className = `account-message ${type || ''}`.trim();
}

function validateLoginForm(formData) {
  clearFieldErrors();
  let isValid = true;

  const email = (formData.get('email') || '').trim();
  const password = formData.get('password') || '';

  if (!email) {
    showFieldError('email', '이메일을 입력해 주세요.');
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('email', '올바른 이메일 형식을 입력해 주세요.');
    isValid = false;
  }

  if (!password) {
    showFieldError('password', '비밀번호를 입력해 주세요.');
    isValid = false;
  }

  return isValid;
}

passwordToggle?.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  passwordToggle.setAttribute('aria-label', isHidden ? '비밀번호 숨기기' : '비밀번호 표시');
});

function getSignupEmailForLogin() {
  const fromUrl = (new URLSearchParams(window.location.search).get('email') || '').trim();
  if (fromUrl && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromUrl)) {
    if (typeof SIGNUP_EMAIL_KEY !== 'undefined') {
      sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
    }
    return fromUrl;
  }

  const fromStore = (typeof SIGNUP_EMAIL_KEY !== 'undefined')
    ? (sessionStorage.getItem(SIGNUP_EMAIL_KEY) || '').trim()
    : '';
  if (fromStore && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromStore)) {
    sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
    return fromStore;
  }

  return '';
}

function fillLoginEmailFromQuery() {
  const emailInput = document.getElementById('accountEmail');
  if (!emailInput) return;

  const email = getSignupEmailForLogin();
  if (!email) return;

  emailInput.value = email;
  passwordInput?.focus();
}

function initAccountPage() {
  fillLoginEmailFromQuery();

  const signupLink = document.getElementById('signupLink');
  const findAccountLink = document.getElementById('findAccountLink');

  if (signupLink && typeof LINKS !== 'undefined' && LINKS.signup) {
    signupLink.href = LINKS.signup;
  }

  if (findAccountLink && typeof LINKS !== 'undefined' && LINKS.findAccount) {
    findAccountLink.href = LINKS.findAccount;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccountPage);
} else {
  initAccountPage();
}

accountForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(accountForm);
  if (!validateLoginForm(formData)) {
    showMessage('입력 내용을 확인해 주세요.', 'error');
    return;
  }

  setLoading(true);
  showMessage('', '');

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 500));

    const email    = (formData.get('email') || '').trim();
    const password = formData.get('password') || '';

    if (typeof authLogin === 'undefined') {
      showMessage('인증 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.', 'error');
      return;
    }

    const session = authLogin(email, password);
    if (!session) {
      showMessage('이메일 또는 비밀번호가 올바르지 않습니다.', 'error');
      return;
    }

    // 역할에 따라 리다이렉트
    if (session.role === 'manager') {
      window.location.href = 'ad-accounts.html';
    } else {
      window.location.href = 'report.html';
    }
  } catch (error) {
    showMessage('로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    setLoading(false);
  }
});
