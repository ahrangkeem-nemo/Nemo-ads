const signupForm = document.getElementById('signupForm');
const submitBtn = document.getElementById('signupSubmitBtn');
const accountMessage = document.getElementById('accountMessage');
const passwordToggle = document.getElementById('passwordToggle');
const passwordInput = document.getElementById('signupPassword');
const btnText = submitBtn?.querySelector('.btn-text');
const btnLoading = submitBtn?.querySelector('.btn-loading');
const consentAll = document.getElementById('consentAll');
const signupTerms = document.querySelector('.signup-terms');

const termCheckboxes = [
  document.getElementById('consentMemberTerms'),
  document.getElementById('consentMemberPrivacy'),
  document.getElementById('consentServiceTerms'),
  document.getElementById('consentServicePrivacy'),
].filter(Boolean);

function showFieldError(name, message) {
  const errorEl = document.querySelector(`[data-error="${name}"]`);
  const field = errorEl?.closest('.account-field');
  if (errorEl) errorEl.textContent = message;
  field?.classList.toggle('has-error', Boolean(message));
}

function showTermsError(message) {
  const errorEl = document.querySelector('[data-error="terms"]');
  if (errorEl) errorEl.textContent = message;
  signupTerms?.classList.toggle('has-error', Boolean(message));
}

function clearFieldErrors() {
  document.querySelectorAll('.account-field').forEach((field) => {
    field.classList.remove('has-error');
  });
  document.querySelectorAll('.account-error').forEach((el) => {
    el.textContent = '';
  });
  signupTerms?.classList.remove('has-error');
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

function syncConsentAllState() {
  if (!consentAll) return;
  consentAll.checked = termCheckboxes.length > 0 && termCheckboxes.every((checkbox) => checkbox.checked);
}

function validateSignupForm(formData) {
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
  } else if (password.length < 8) {
    showFieldError('password', '비밀번호는 8자 이상 입력해 주세요.');
    isValid = false;
  }

  const allTermsChecked = termCheckboxes.every((checkbox) => checkbox.checked);
  if (!allTermsChecked) {
    showTermsError('필수 약관에 모두 동의해 주세요.');
    isValid = false;
  }

  return isValid;
}

consentAll?.addEventListener('change', () => {
  termCheckboxes.forEach((checkbox) => {
    checkbox.checked = consentAll.checked;
  });
  showTermsError('');
});

termCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    syncConsentAllState();
    if (termCheckboxes.every((item) => item.checked)) {
      showTermsError('');
    }
  });
});

passwordToggle?.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  passwordToggle.setAttribute('aria-label', isHidden ? '비밀번호 숨기기' : '비밀번호 표시');
});

function showSignupSuccess(email) {
  const panel = document.getElementById('signupFormPanel');
  const success = document.getElementById('signupSuccess');
  const centerBtn = document.getElementById('advertiserCenterBtn');
  const loginPage = (typeof LINKS !== 'undefined' && LINKS.advertiserCenterPage)
    ? LINKS.advertiserCenterPage
    : 'account.html';

  if (email && typeof SIGNUP_EMAIL_KEY !== 'undefined') {
    sessionStorage.setItem(SIGNUP_EMAIL_KEY, email);
  }

  if (centerBtn) {
    centerBtn.href = email
      ? `${loginPage}?email=${encodeURIComponent(email)}`
      : loginPage;
  }

  if (panel) panel.hidden = true;
  if (success) {
    success.hidden = false;
    success.focus();
  }
}

signupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(signupForm);
  if (!validateSignupForm(formData)) {
    showMessage('입력 내용을 확인해 주세요.', 'error');
    return;
  }

  setLoading(true);
  showMessage('', '');

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    const email = (formData.get('email') || '').trim();
    showSignupSuccess(email);
  } catch (error) {
    showMessage('가입 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    setLoading(false);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const loginLink = document.getElementById('loginLink');
  const findAccountLink = document.getElementById('findAccountLink');

  if (loginLink && typeof LINKS !== 'undefined' && LINKS.loginPage) {
    loginLink.href = LINKS.loginPage;
  }

  if (findAccountLink && typeof LINKS !== 'undefined' && LINKS.findAccount) {
    findAccountLink.href = LINKS.findAccount;
  }

  if (typeof LINKS !== 'undefined' && LINKS.signupTerms) {
    document.querySelectorAll('[data-terms-link]').forEach((link) => {
      const key = link.getAttribute('data-terms-link');
      if (key && LINKS.signupTerms[key]) {
        link.href = LINKS.signupTerms[key];
      }
    });
  }
});
