/**
 * auth.js — 공유 인증 모듈
 * 모든 관리 페이지에 <script src="auth.js"> 로 로드
 */

const SESSION_KEY = 'nemo_session_v1';

// ─── 사전 정의 계정 ──────────────────────────────────────
// role: 'manager'    → 전체 메뉴 접근 (마스터)
// role: 'advertiser' → 성과보고서·광고 자료, 자기 accountId 데이터만
const NEMO_USERS = [
  {
    email:     'manager@nemo.ads',
    password:  'nemo2026',
    role:      'manager',
    name:      '광고 운영 매니저',
    accountId: null,
  },
  {
    email:     'ads@tossplace.com',
    password:  'toss2026',
    role:      'advertiser',
    name:      '토스플레이스',
    accountId: 2,
  },
  {
    email:     'billing@createtip.co.kr',
    password:  'createtip2026',
    role:      'advertiser',
    name:      '크리에이팁',
    accountId: 1,
  },
  {
    email:     'gentleman@interior.kr',
    password:  'gentleman2026',
    role:      'advertiser',
    name:      '인테리어 젠틀맨',
    accountId: 3,
  },
  {
    email:     'muchon22@naver.com',
    password:  'muchon2026',
    role:      'advertiser',
    name:      '무촌철거',
    accountId: 4,
  },
];

// ─── 세션 ────────────────────────────────────────────────
function authLogin(email, password) {
  const user = NEMO_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) return null;
  const session = { email: user.email, name: user.name, role: user.role, accountId: user.accountId };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function authLogout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'account.html';
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
  catch { return null; }
}

function isManager() {
  const s = getSession();
  return s && s.role === 'manager';
}

// ─── 가드 ────────────────────────────────────────────────
// requiredRole: 'manager' | 'any' (기본 'any')
function requireAuth(requiredRole = 'any') {
  const session = getSession();
  if (!session) {
    window.location.href = 'account.html';
    return;
  }
  if (requiredRole === 'manager' && session.role !== 'manager') {
    // 광고주는 성과보고서로 리다이렉트
    window.location.href = 'report.html';
  }
}

// ─── 사이드바 사용자 UI 주입 ─────────────────────────────
// 각 페이지 <aside class="manage-sidebar"> 하단에 사용자 뱃지 + 로그아웃 버튼 추가
function injectSidebarUser() {
  const sidebar = document.querySelector('.manage-sidebar');
  if (!sidebar) return;

  const session = getSession();
  if (!session) return;

  const roleLbl = session.role === 'manager' ? '매니저' : '광고주';
  const existing = document.getElementById('sidebarUserBadge');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'sidebarUserBadge';
  el.className = 'sidebar-user-badge';
  el.innerHTML = `
    <div class="sidebar-user-info">
      <span class="sidebar-user-avatar">${session.name.slice(0,1)}</span>
      <div class="sidebar-user-text">
        <span class="sidebar-user-name">${session.name}</span>
        <span class="sidebar-user-role">${roleLbl}</span>
      </div>
    </div>
    <button class="sidebar-logout-btn" id="sidebarLogoutBtn" aria-label="로그아웃">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    </button>`;
  sidebar.appendChild(el);

  document.getElementById('sidebarLogoutBtn').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) authLogout();
  });

  // 광고주: 성과 보고서·광고 자료만 노출 / 매니저: 광고주 전용 메뉴 숨김
  const advertiserNavPaths = ['report.html', 'advertiser-resources.html'];
  if (session.role === 'advertiser') {
    sidebar.querySelectorAll('.manage-nav-item').forEach(link => {
      const href = link.getAttribute('href') || '';
      const allowed = advertiserNavPaths.some(path => href.includes(path));
      if (!allowed) link.remove();
    });
  } else {
    sidebar.querySelectorAll('.manage-nav-item--advertiser-only').forEach(link => link.remove());
  }
}

function initSidebarUser() {
  injectSidebarUser();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebarUser);
} else {
  initSidebarUser();
}
