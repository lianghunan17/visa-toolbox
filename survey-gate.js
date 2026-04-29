const SURVEY_GATE_STORAGE_KEY = 'visa-toolbox-survey-gate-v1';
const FEEDBACK_STORAGE_KEY = 'visa-toolbox-feedback-v1';

const SURVEY_QUESTIONS = [
  {
    key: 'helpfulness',
    text: '这次工具对你有帮助吗',
    options: ['很有帮助', '有一点帮助', '一般', '帮助不大', '没帮助'],
  },
  {
    key: 'mainIssue',
    text: '你觉得当前最大问题是什么',
    options: ['信息不够准', '看不太懂', '步骤有点麻烦', '页面不好用', '手机体验一般', '暂时没明显问题'],
  },
  {
    key: 'pricingPreference',
    text: '如果以后做收费版，你更能接受哪种方式',
    options: ['一次买断', '低价订阅', '按功能收费', '先免费，不想付费', '先看功能再决定'],
  },
  {
    key: 'recommendation',
    text: '你愿意推荐给朋友吗',
    options: ['愿意', '可能会', '不确定', '不太会'],
  },
];

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function readGateState() {
  try {
    return JSON.parse(localStorage.getItem(SURVEY_GATE_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeGateState(data) {
  localStorage.setItem(SURVEY_GATE_STORAGE_KEY, JSON.stringify(data));
}

function readFeedbackItems() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

async function saveMiniFeedback(questionKey, answer, sourceTool) {
  const payload = {
    mode: 'survey-gate',
    questionKey,
    answer,
    sourceTool,
  };

  const items = readFeedbackItems();
  items.unshift({ ...payload, createdAt: new Date().toISOString() });
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(items.slice(0, 200)));

  try {
    if (window.FeedbackApi) {
      await window.FeedbackApi.submitFeedback(payload);
    }
  } catch {}
}

function shouldAsk(toolKey) {
  const state = readGateState();
  const today = getTodayKey();
  if (!state.lastTool) {
    writeGateState({ ...state, lastTool: toolKey });
    return false;
  }
  if (state.lastTool === toolKey) return false;
  if (state.lastAskedDate === today) return false;
  return true;
}

function rememberPass(toolKey) {
  const state = readGateState();
  writeGateState({ ...state, lastTool: toolKey });
}

function rememberAsked(toolKey) {
  const state = readGateState();
  writeGateState({ ...state, lastTool: toolKey, lastAskedDate: getTodayKey() });
}

function pickQuestion() {
  return SURVEY_QUESTIONS[Math.floor(Math.random() * SURVEY_QUESTIONS.length)];
}

window.initSurveyGate = function initSurveyGate() {
  const entries = document.querySelectorAll('.tool-entry');
  const modal = document.getElementById('surveyModal');
  const questionText = document.getElementById('surveyQuestionText');
  const optionsWrap = document.getElementById('surveyOptions');
  const skipBtn = document.getElementById('skipSurveyBtn');

  let pendingHref = '';
  let pendingTool = '';

  function closeAndGo() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    if (pendingHref) window.location.href = pendingHref;
  }

  function openSurvey(href, toolKey) {
    const question = pickQuestion();
    pendingHref = href;
    pendingTool = toolKey;
    questionText.textContent = question.text;
    optionsWrap.innerHTML = question.options.map(option => `
      <label class="survey-option">
        <input type="radio" name="miniSurveyOption" value="${option}" />
        <span>${option}</span>
      </label>
    `).join('');

    optionsWrap.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        Promise.resolve(saveMiniFeedback(question.key, input.value, toolKey)).finally(() => {
          rememberAsked(toolKey);
          closeAndGo();
        });
      });
    });

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  skipBtn.addEventListener('click', () => {
    rememberAsked(pendingTool);
    closeAndGo();
  });

  entries.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      const toolKey = link.dataset.tool || href;
      if (!href) return;

      if (!shouldAsk(toolKey)) {
        rememberPass(toolKey);
        return;
      }

      e.preventDefault();
      openSurvey(href, toolKey);
    });
  });
};
