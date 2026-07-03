// ─── 정산 데이터 공유 저장소 (정산 관리 · 광고주 센터) ─────

const SETTLEMENT_STORE_KEY = 'nemo_settlements_v1';
const AD_ACCOUNTS_KEY = 'nemo_ad_accounts_v4';

const SETTLEMENT_STORE_ACCOUNTS = {
  8: {
    accountType: 'agency',
    name: '그로스앤랩',
    email: 'agency@growthlab.kr',
    address: '서울특별시 강남구 테헤란로 152',
    sheetUrl: '',
  },
  2: {
    accountType: 'partner',
    name: '토스플레이스',
    email: 'ads@tossplace.com',
    address: '서울특별시 강남구 테헤란로 142 아크플레이스 4층',
    settleCycle: 'month_start',
    leadShareUrl: 'https://docs.google.com/spreadsheets/d/1ShNC8OVesR1ywX-9P0iFrbWpLxbPOxX3YyTbtXPPbeA/edit?gid=4000000000#gid=4000000000',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1ShNC8OVesR1ywX-9P0iFrbWpLxbPOxX3YyTbtXPPbeA/edit?gid=1057949698#gid=1057949698',
  },
  3: {
    accountType: 'partner',
    name: '인테리어 젠틀맨',
    email: 'dh.lee@interiorgentleman.com',
    address: '서울특별시 중구 다산로 16길 14 지하 1층',
    settleCycle: 'month_end',
    leadShareUrl: '',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1ShNC8OVesR1ywX-9P0iFrbWpLxbPOxX3YyTbtXPPbeA/edit?gid=0#gid=0',
  },
  4: {
    accountType: 'partner',
    name: '무촌철거',
    email: 'muchon22@naver.com',
    address: '경기도 수원시 영통구 광교중앙로 248번길 12 3층',
    settleCycle: 'month_start',
    leadShareUrl: 'https://docs.google.com/spreadsheets/d/1ypb6Mdy3RYkyX_bUyz9_c6TIFqekSXiHYad3ruMym2w/edit?gid=0#gid=0',
  },
};

function getSettlementAccountIds() {
  return Object.keys(SETTLEMENT_STORE_ACCOUNTS).map(Number);
}

function getSettlementPartnerAccountIds() {
  return Object.entries(SETTLEMENT_STORE_ACCOUNTS)
    .filter(([, profile]) => profile.accountType === 'partner')
    .map(([id]) => Number(id));
}

function getSettlementAgencyAccountIds() {
  return Object.entries(SETTLEMENT_STORE_ACCOUNTS)
    .filter(([, profile]) => profile.accountType === 'agency')
    .map(([id]) => Number(id));
}

function buildPartnerAccountSeed(accountId) {
  const seed = SETTLEMENT_STORE_ACCOUNTS[accountId];
  if (!seed || seed.accountType !== 'partner') return null;
  return {
    id: accountId,
    name: seed.name,
    type: 'partner',
    advertiserSubtypes: ['regular_partner'],
    email: seed.email || '',
    address: seed.address || '',
    settleCycle: seed.settleCycle || 'month_end',
    taxDate: '',
    bizFileName: '', bizFileData: '',
    sheetUrl: seed.sheetUrl || '',
    agencyFee: 0,
    feePaidDate: '',
    setoffType: 'no_setoff',
    contractFileName: '', contractFileData: '',
    bankFileName: '', bankFileData: '',
  };
}

function getPartnerAccountSeedsFromSettlement() {
  return getSettlementPartnerAccountIds()
    .map(buildPartnerAccountSeed)
    .filter(Boolean);
}

function buildAgencyAccountSeed(accountId) {
  const seed = SETTLEMENT_STORE_ACCOUNTS[accountId];
  if (!seed || seed.accountType !== 'agency') return null;
  return {
    id: accountId,
    name: seed.name,
    type: 'agency',
    advertiserSubtypes: [],
    email: seed.email || '',
    address: seed.address || '',
    taxDate: '',
    bizFileName: '', bizFileData: '',
    sheetUrl: seed.sheetUrl || '',
    agencyFee: 0,
    feePaidDate: '',
    setoffType: 'no_setoff',
    contractFileName: '', contractFileData: '',
    bankFileName: '', bankFileData: '',
  };
}

function getAgencyAccountSeedsFromSettlement() {
  return getSettlementAgencyAccountIds()
    .map(buildAgencyAccountSeed)
    .filter(Boolean);
}

/** 성과 보고서 필터 — 운영 계정(광고주 type=partner)만, 정산 시드와 동기화 */
function getReportFilterPartnerAccounts() {
  return getSyncedManagerAccounts().filter(a => a.type === 'partner');
}

/** 운영 계정 관리 · 성과 보고서 — 광고주·광고대행사 전체, 정산 시드와 동기화 */
function getSyncedManagerAccounts() {
  const stored = loadAdAccountsFromStorage();
  const byId = new Map(stored.map(a => [a.id, a]));

  function mergeSeed(seed) {
    const existing = byId.get(seed.id);
    if (!existing) return { ...seed };
    return {
      ...existing,
      id: seed.id,
      name: seed.name,
      type: seed.type,
      email: existing.email || seed.email || '',
      address: existing.address || seed.address || '',
      settleCycle: existing.settleCycle || seed.settleCycle || 'month_end',
      taxDate: existing.taxDate || seed.taxDate || '',
      agencyFee: existing.agencyFee ?? seed.agencyFee ?? 0,
      feePaidDate: existing.feePaidDate || seed.feePaidDate || '',
    };
  }

  const agencies = getAgencyAccountSeedsFromSettlement().map(mergeSeed);
  const partners = getPartnerAccountSeedsFromSettlement().map(mergeSeed);
  return [...agencies, ...partners];
}

function loadAdAccountsFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(AD_ACCOUNTS_KEY));
    if (Array.isArray(stored) && stored.length) return stored;
  } catch { /* ignore */ }
  return [];
}

function getAdAccountById(accountId) {
  return loadAdAccountsFromStorage().find(a => a.id === accountId);
}

function getSettlementAccountProfile(accountId) {
  const acct = getAdAccountById(accountId);
  const seed = SETTLEMENT_STORE_ACCOUNTS[accountId] || {};
  const accountType = acct?.type || seed.accountType || 'partner';
  const settleCycle = accountType === 'partner'
    ? (acct?.settleCycle || seed.settleCycle || 'month_end')
    : (seed.settleCycle || 'month_end');
  return {
    ...seed,
    name: acct?.name || seed.name || '—',
    email: acct?.email || seed.email || '',
    address: acct?.address || seed.address || '',
    accountType,
    settleCycle,
    taxDate: accountType === 'agency' ? (acct?.taxDate || '') : '',
    leadShareUrl: accountType === 'agency' ? '' : (seed.leadShareUrl || ''),
    sheetUrl: seed.sheetUrl || acct?.sheetUrl || '',
  };
}

function settlementRowKey(row) {
  return `${row.accountId}-${row.settleMonth}`;
}

function mergeSettlementRow(raw) {
  return {
    ...getSettlementAccountProfile(raw.accountId),
    ...raw,
    accountType: getSettlementAccountProfile(raw.accountId).accountType,
  };
}

function loadSettlementRowsFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTLEMENT_STORE_KEY));
    if (Array.isArray(stored) && stored.length) {
      return stored.map(mergeSettlementRow);
    }
  } catch { /* ignore */ }
  return [];
}

function formatSettlementMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return `${year}년 ${Number(month)}월`;
}

function getSettlementIssueDate(settleMonth, rowOrProfile) {
  const [year, month] = String(settleMonth || '').split('-').map(Number);
  if (!year || !month) return '—';

  const profile = rowOrProfile?.accountId != null
    ? { ...getSettlementAccountProfile(rowOrProfile.accountId), ...rowOrProfile }
    : (rowOrProfile || {});

  const accountType = profile.accountType
    || (profile.accountId != null ? getSettlementAccountProfile(profile.accountId).accountType : 'partner');

  if (accountType === 'agency') {
    const acct = profile.accountId != null ? getAdAccountById(profile.accountId) : null;
    const taxDate = acct?.taxDate || profile.taxDate;
    if (taxDate) {
      const parsed = new Date(taxDate);
      if (!Number.isNaN(parsed.getTime())) {
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(parsed.getDate(), lastDay);
        return `${month}/${day}`;
      }
    }
  } else {
    const cycle = profile.settleCycle
      || (profile.accountId != null ? getSettlementAccountProfile(profile.accountId).settleCycle : null)
      || 'month_end';
    if (cycle === 'month_start') return `${month}/1`;
  }

  const lastDay = new Date(year, month, 0).getDate();
  return `${month}/${lastDay}`;
}

function formatSettlementWonShort(n) {
  if (n >= 10000 && n % 10000 === 0) return `${n / 10000}만원`;
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function getAdvertiserTaxInvoices(accountId) {
  return loadSettlementRowsFromStorage()
    .filter(r => r.accountId === accountId && r.taxInvoiceFileData)
    .sort((a, b) => b.settleMonth.localeCompare(a.settleMonth));
}
