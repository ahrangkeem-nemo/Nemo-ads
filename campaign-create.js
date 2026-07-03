const customToggle = document.getElementById('customAdToggle');
const customFields = document.getElementById('campaignCustomFields');
const titleInput = document.getElementById('campaignAdTitle');
const titleCount = document.getElementById('campaignTitleCount');
const photoPreview = document.getElementById('campaignPhotoPreview');
const photoInput = document.getElementById('campaignPhotoInput');
const photoDropzone = document.getElementById('campaignPhotoDropzone');
const photoEmpty = document.getElementById('campaignPhotoEmpty');
const photoActions = document.getElementById('campaignPhotoActions');
const photoChangeBtn = document.getElementById('campaignPhotoChangeBtn');
const photoRemoveBtn = document.getElementById('campaignPhotoRemoveBtn');
const aiRecommendBtn = document.getElementById('aiRecommendBtn');

const AI_TITLES = [
  '라코스테 x 스타벅스',
  '창업 전, 이 동네 손님부터 확인',
  '황금 CPC·CPM 파트너사 모집',
  '예비·기창업자 타겟 상권 광고',
];

function updateTitleCount() {
  const len = titleInput.value.length;
  titleCount.textContent = `${len}/30`;
}

customToggle?.addEventListener('change', () => {
  customFields.hidden = !customToggle.checked;
});

titleInput?.addEventListener('input', updateTitleCount);

function setPhotoPreview(src) {
  if (!photoPreview || !photoDropzone || !photoEmpty || !photoActions) return;

  photoPreview.src = src;
  photoPreview.hidden = false;
  photoEmpty.hidden = true;
  photoActions.classList.add('is-visible');
  photoDropzone.classList.add('has-image');
}

function clearPhotoPreview() {
  if (!photoPreview || !photoInput || !photoDropzone || !photoEmpty || !photoActions) return;

  photoPreview.src = '';
  photoPreview.hidden = true;
  photoEmpty.hidden = false;
  photoActions.classList.remove('is-visible');
  photoDropzone.classList.remove('has-image');
  photoDropzone.setAttribute('aria-label', '이미지 업로드');
  photoInput.value = '';
}

function openPhotoPicker() {
  photoInput?.click();
}

function handlePhotoFile(file) {
  if (!file?.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = () => setPhotoPreview(reader.result);
  reader.readAsDataURL(file);
}

photoDropzone?.addEventListener('click', (event) => {
  if (photoDropzone.classList.contains('has-image')) return;
  if (event.target.closest('button')) return;
  openPhotoPicker();
});

photoDropzone?.addEventListener('keydown', (event) => {
  if (photoDropzone.classList.contains('has-image')) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openPhotoPicker();
  }
});

photoChangeBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  openPhotoPicker();
});

photoRemoveBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  clearPhotoPreview();
});

photoInput?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) handlePhotoFile(file);
});

photoDropzone?.addEventListener('dragover', (event) => {
  event.preventDefault();
  photoDropzone.classList.add('is-dragover');
});

photoDropzone?.addEventListener('dragleave', () => {
  photoDropzone.classList.remove('is-dragover');
});

photoDropzone?.addEventListener('drop', (event) => {
  event.preventDefault();
  photoDropzone.classList.remove('is-dragover');
  const file = event.dataTransfer?.files?.[0];
  if (file) handlePhotoFile(file);
});

aiRecommendBtn?.addEventListener('click', () => {
  const pick = AI_TITLES[Math.floor(Math.random() * AI_TITLES.length)];
  titleInput.value = pick;
  updateTitleCount();
});

updateTitleCount();

document.getElementById('campaignCoverScroll')?.addEventListener('click', (event) => {
  const target = document.getElementById('campaignFeature');
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
