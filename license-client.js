const LICENSE_STORAGE_KEY = 'visa-toolbox-license-v1';
const IS_LOCALHOST = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const LICENSE_API_BASE = window.__LICENSE_API_BASE__ || (IS_LOCALHOST ? 'http://127.0.0.1:8787' : '');

function ensureLicenseApiBase() {
  if (!LICENSE_API_BASE) {
    throw new Error('当前页面未配置后端 API 地址，请先注入 window.__LICENSE_API_BASE__。');
  }
  return LICENSE_API_BASE;
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getStoredLicense() {
  return safeJsonParse(localStorage.getItem(LICENSE_STORAGE_KEY));
}

function setStoredLicense(data) {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(data));
}

function clearStoredLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
}

function getDeviceSeed() {
  let seed = localStorage.getItem('visa-toolbox-device-seed');
  if (!seed) {
    seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('visa-toolbox-device-seed', seed);
  }
  return seed;
}

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getDeviceId() {
  const base = [
    navigator.userAgent || '',
    navigator.language || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    `${window.screen.width}x${window.screen.height}`,
    getDeviceSeed(),
  ].join('|');
  return sha256(base);
}

async function request(path, body) {
  const apiBase = ensureLicenseApiBase();
  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || '请求失败，请稍后再试。');
  }
  return data;
}

const LicenseClient = {
  async activate({ email, licenseKey }) {
    const deviceId = await getDeviceId();
    const deviceName = `${navigator.platform || 'unknown'} / ${navigator.userAgent.slice(0, 60)}`;
    const data = await request('/api/license/activate', {
      email,
      licenseKey,
      deviceId,
      deviceName,
    });

    setStoredLicense({
      email,
      licenseKey,
      deviceId,
      authToken: data.authToken,
      status: data.licenseStatus || 'active',
      activatedAt: new Date().toISOString(),
    });

    return data;
  },

  async validate(toolName = 'toolbox') {
    const stored = getStoredLicense();
    if (!stored || !stored.authToken) {
      throw new Error('未检测到有效授权，请先激活。');
    }

    const deviceId = stored.deviceId || await getDeviceId();
    const data = await request('/api/license/validate', {
      authToken: stored.authToken,
      deviceId,
      toolName,
    });

    if (!data.valid) {
      clearStoredLicense();
      throw new Error(data.message || '当前授权不可用，请重新激活。');
    }

    return data;
  },

  getStoredLicense,
  clearStoredLicense,
};

window.LicenseClient = LicenseClient;
