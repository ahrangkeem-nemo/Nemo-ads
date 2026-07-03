// ─── 제안·광고 자료 (매니저 자료실 · 광고주 자료) ─────────────

const PROPOSAL_RESOURCE_ITEMS = [
  {
    id: 'product-intro',
    label: '광고 상품 소개서',
    desc: '광고 상품·지면 소개 자료',
    color: 'blue',
    icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/>`,
    files: [{ name: '네모_광고상품소개서26Y.pdf.zip', url: 'assets/proposal/nemo-product-intro-26Y.zip', ext: 'zip' }],
  },
  {
    id: 'creative-guide',
    label: '소재 가이드',
    desc: '소재 제작·규격 안내',
    color: 'green',
    icon: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`,
    files: [{ name: '네모_광고 소재 제작 가이드_202606.pdf', url: 'assets/proposal/nemo-creative-guide-202606.pdf', ext: 'pdf' }],
  },
  {
    id: 'onhouse-docs',
    label: '온하우스 사업자·통장',
    desc: '네모(온하우스) 사업자등록증·통장 사본',
    color: 'purple',
    managerOnly: true,
    icon: `<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>`,
    files: [
      { name: '온하우스_사업자등록증.pdf', url: 'assets/proposal/onhouse-biz-reg.pdf', ext: 'pdf' },
      { name: '온하우스_통장사본.pdf', url: 'assets/proposal/onhouse-bank.pdf', ext: 'pdf' },
    ],
  },
];

function escProposalHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getProposalResourcesForAudience(audience) {
  if (audience === 'advertiser') {
    return PROPOSAL_RESOURCE_ITEMS.filter(item => !item.managerOnly);
  }
  return PROPOSAL_RESOURCE_ITEMS;
}

function renderProposalResourceBoard(audience) {
  const grid = document.getElementById('contractDocGrid');
  if (!grid) return;

  const items = getProposalResourcesForAudience(audience);
  grid.innerHTML = items.map(item => `
    <div class="contract-doc-card">
      <div class="contract-doc-card-head">
        <div class="contract-doc-icon contract-doc-icon--${item.color}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            ${item.icon}
          </svg>
        </div>
        <div class="contract-doc-meta">
          <p class="contract-doc-label">${escProposalHtml(item.label)}</p>
          <p class="contract-doc-desc">${escProposalHtml(item.desc)}</p>
        </div>
      </div>
      <ul class="contract-file-list">
        ${item.files.map(f => {
          const ready = Boolean(f.url);
          return `
            <li class="contract-file-item">
              <span class="contract-file-ext contract-file-ext--${ready ? (f.ext === 'zip' ? 'blue' : 'red') : 'gray'}">${ready ? (f.ext || 'pdf').toUpperCase() : '—'}</span>
              <span class="contract-file-name">${escProposalHtml(f.name)}</span>
              ${ready
                ? `<a class="contract-download-btn" href="${f.url}" download="${escProposalHtml(f.name)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    다운로드
                  </a>`
                : `<span class="contract-file-pending">파일 준비 중</span>`
              }
            </li>`;
        }).join('')}
      </ul>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const audience = document.body.dataset.resourceAudience || 'manager';
  renderProposalResourceBoard(audience);
});
