const MODE_CONFIG_STORAGE_KEY = 'visa-toolbox-mode-config-v1';
const IS_LOCALHOST = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const MODE_API_BASE = window.__LICENSE_API_BASE__ || (IS_LOCALHOST ? 'http://127.0.0.1:8787' : '');

function ensureModeApiBase() {
  if (!MODE_API_BASE) {
    throw new Error('当前页面未配置后端 API 地址，请先注入 window.__LICENSE_API_BASE__。');
  }
  return MODE_API_BASE;
}

const DEFAULT_MODE_CONFIG = {
  mode: 'beta',
  theme: 'future',
  title: '签证工具箱',
  subtitle: '把常用的签证与在留判断工具放进一个更轻、更快、更未来感的入口。',
  announcement: '当前为内测版，默认免费开放，用来快速验证流程、内容和页面体验。',
  ctaLabel: '开始体验',
  requireLicenseInPaid: true,
  surveyGateEnabled: true,
};

let memoryModeConfig = null;

function mergeConfig(raw) {
  return {
    ...DEFAULT_MODE_CONFIG,
    ...(raw || {}),
  };
}

function readModeConfig() {
  if (memoryModeConfig) return mergeConfig(memoryModeConfig);
  try {
    const stored = JSON.parse(localStorage.getItem(MODE_CONFIG_STORAGE_KEY) || '{}') || {};
    memoryModeConfig = mergeConfig(stored);
    return memoryModeConfig;
  } catch {
    memoryModeConfig = { ...DEFAULT_MODE_CONFIG };
    return memoryModeConfig;
  }
}

function writeLocalModeConfig(next) {
  const merged = mergeConfig(next);
  memoryModeConfig = merged;
  localStorage.setItem(MODE_CONFIG_STORAGE_KEY, JSON.stringify(merged));
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('mode-config-changed', { detail: merged }));
  }
  return merged;
}

async function fetchModeConfig() {
  try {
    const apiBase = ensureModeApiBase();
    const res = await fetch(`${apiBase}/api/site-mode`, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || '读取站点模式失败');
    return writeLocalModeConfig(data.config || DEFAULT_MODE_CONFIG);
  } catch {
    return readModeConfig();
  }
}

async function saveModeConfigRemote(config, adminToken) {
  const apiBase = ensureModeApiBase();
  const res = await fetch(`${apiBase}/api/admin/site-mode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
    body: JSON.stringify({ config }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '保存站点模式失败');
  return writeLocalModeConfig(data.config || config);
}

function getModePresentation(config = readModeConfig()) {
  if (config.mode === 'paid') {
    return {
      modeLabel: '收费版',
      bannerClass: 'license-banner lock',
      bannerText: '当前为收费版，首次使用需要激活码。已激活设备可直接进入工具。',
      pill: '激活制',
      toolActionLabel: '进入并校验授权',
    };
  }

  if (config.mode === 'public-beta') {
    return {
      modeLabel: '公测版',
      bannerClass: 'license-banner beta',
      bannerText: '当前为公测版，先免费开放，用反馈来决定收费版节奏与优先改进方向。',
      pill: '公开体验',
      toolActionLabel: '直接打开工具',
    };
  }

  return {
    modeLabel: '测试版',
    bannerClass: 'license-banner ok',
    bannerText: '当前为测试版，优先验证流程和页面，暂不强制激活。',
    pill: '快速试跑',
    toolActionLabel: '开始测试',
  };
}

function shouldRequireLicense(config = readModeConfig()) {
  return config.mode === 'paid' && !!config.requireLicenseInPaid;
}

window.ModeConfig = {
  MODE_CONFIG_STORAGE_KEY,
  DEFAULT_MODE_CONFIG,
  MODE_API_BASE,
  readModeConfig,
  writeLocalModeConfig,
  fetchModeConfig,
  saveModeConfigRemote,
  getModePresentation,
  shouldRequireLicense,
};
