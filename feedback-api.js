const FEEDBACK_IS_LOCALHOST = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const FEEDBACK_API_BASE = window.__LICENSE_API_BASE__ || (FEEDBACK_IS_LOCALHOST ? 'http://127.0.0.1:8787' : '');

function ensureFeedbackApiBase() {
  if (!FEEDBACK_API_BASE) {
    throw new Error('当前页面未配置后端 API 地址，请先注入 window.__LICENSE_API_BASE__。');
  }
  return FEEDBACK_API_BASE;
}

function getClientTag() {
  let tag = localStorage.getItem('visa-toolbox-client-tag');
  if (!tag) {
    tag = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('visa-toolbox-client-tag', tag);
  }
  return tag;
}

async function submitFeedback(payload) {
  const apiBase = ensureFeedbackApiBase();
  const res = await fetch(`${apiBase}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      clientTag: getClientTag(),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || '提交评价失败');
  }
  return data;
}

window.FeedbackApi = { submitFeedback };
