const FEEDBACK_STORAGE_KEY = 'visa-toolbox-feedback-v1';
const form = document.getElementById('feedbackForm');
const messageEl = document.getElementById('feedbackMessage');

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.className = 'message show ok';
}

function getValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

function getValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function getSavedFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFeedback(data) {
  const current = getSavedFeedback();
  current.unshift({ ...data, createdAt: new Date().toISOString() });
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(current.slice(0, 200)));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    mode: 'full',
    helpfulness: getValue('helpfulness'),
    toolUsed: getValue('toolUsed'),
    valueFocus: getValues('valueFocus'),
    mainIssue: getValue('mainIssue'),
    wantedFeatures: getValues('wantedFeatures'),
    pricingPreference: getValue('pricingPreference'),
    recommendation: getValue('recommendation'),
    extraComment: document.getElementById('extraComment').value.trim(),
  };

  saveFeedback(payload);

  try {
    if (window.FeedbackApi) {
      await window.FeedbackApi.submitFeedback(payload);
    }
  } catch {}

  form.reset();
  showMessage('谢谢，评价已提交。这个测试版会按大家的选择继续改。');
});
