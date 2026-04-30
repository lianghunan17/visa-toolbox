const ADMIN_TOKEN_STORAGE_KEY = 'visa-toolbox-admin-token';
const ADMIN_IS_LOCALHOST = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const ADMIN_API_BASE = window.__LICENSE_API_BASE__ || (ADMIN_IS_LOCALHOST ? 'http://127.0.0.1:8787' : '');

const adminTokenEl = document.getElementById('adminToken');
const saveTokenBtn = document.getElementById('saveTokenBtn');
const clearTokenBtn = document.getElementById('clearTokenBtn');
const runDiagnosticsBtn = document.getElementById('runDiagnosticsBtn');
const createLicenseBtn = document.getElementById('createLicenseBtn');
const refreshBtn = document.getElementById('refreshBtn');
const createMessageEl = document.getElementById('createMessage');
const listMessageEl = document.getElementById('listMessage');
const tableBodyEl = document.getElementById('licenseTableBody');
const searchInputEl = document.getElementById('searchInput');
const loadFeedbackBtn = document.getElementById('loadFeedbackBtn');
const loadLocalFeedbackBtn = document.getElementById('loadLocalFeedbackBtn');
const feedbackTableBodyEl = document.getElementById('feedbackTableBody');
const feedbackStatsEl = document.getElementById('feedbackStats');
const exportFeedbackCsvBtn = document.getElementById('exportFeedbackCsvBtn');
const importLicenseCsvBtn = document.getElementById('importLicenseCsvBtn');
const exportLicenseCsvBtn = document.getElementById('exportLicenseCsvBtn');
const licenseCsvInput = document.getElementById('licenseCsvInput');
const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
const siteTitleEl = document.getElementById('siteTitle');
const siteSubtitleEl = document.getElementById('siteSubtitle');
const siteAnnouncementEl = document.getElementById('siteAnnouncement');
const saveModeConfigBtn = document.getElementById('saveModeConfigBtn');
const switchToBetaBtn = document.getElementById('switchToBetaBtn');
const runCleanupBtn = document.getElementById('runCleanupBtn');
const modeMessageEl = document.getElementById('modeMessage');
const modeSummaryEl = document.getElementById('modeSummary');
const diagApiEl = document.getElementById('diagApi');
const diagConfigEl = document.getElementById('diagConfig');
const diagDatabaseEl = document.getElementById('diagDatabase');
const diagAuthEl = document.getElementById('diagAuth');
const diagTlsEl = document.getElementById('diagTls');
const diagnosticIssuesEl = document.getElementById('diagnosticIssues');

let allLicenses = [];
let currentFeedbackItems = [];
let selectedMode = window.ModeConfig.readModeConfig().mode;

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
}

function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

function showMessage(el, text, type = 'ok') {
  el.textContent = text;
  el.className = `message show ${type}`;
}

function clearMessage(el) {
  el.textContent = '';
  el.className = 'message';
}

function setDiagnosticText(el, ok, text) {
  if (!el) return;
  el.textContent = text;
  el.className = ok == null ? 'diag-muted' : ok ? 'diag-ok' : 'diag-error';
}

function formatDatabaseDiagnosis(database) {
  if (!database) return '未返回数据库状态';
  const detail = database.detail ? `（${database.detail}）` : '';
  switch (database.code) {
    case 'DB_OK':
      return '数据库连接正常。';
    case 'DB_NOT_CONFIGURED':
      return '数据库未配置，请检查 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。';
    case 'DB_TLS_ERROR':
      return `数据库 TLS/证书链校验失败。${detail}`;
    case 'DB_TABLE_MISSING':
      return `数据库已连接，但关键表不存在，请先执行建表 SQL。${detail}`;
    case 'DB_PERMISSION_ERROR':
      return `数据库已连接，但当前 key 权限不足。${detail}`;
    case 'DB_AUTH_ERROR':
      return `数据库鉴权失败，请检查 Supabase service role key。${detail}`;
    case 'DB_NETWORK_ERROR':
      return `数据库网络不可达，请检查网络、域名或目标服务。${detail}`;
    default:
      return `${database.message || '数据库检查失败。'}${detail}`;
  }
}

function formatConfigDiagnosis(config) {
  if (!config) return '未返回配置状态';
  if (config.ok) return '配置检查通过。';
  if (!config.issues || !config.issues.length) return config.message || '配置不完整。';
  return `配置不完整：${config.issues.join('，')}`;
}

function formatAuthDiagnosis(authCheck) {
  if (!authCheck?.ok) return authCheck?.message || '后端未配置管理员鉴权。';
  if (!getAdminToken()) return '后端已配置，但当前浏览器还没保存 token。';
  return '后端已配置，当前浏览器也已保存 token。';
}

function ensureAdminApiBase() {
  if (!ADMIN_API_BASE) {
    throw new Error('当前页面未配置后端 API 地址，请先注入 window.__LICENSE_API_BASE__。');
  }
  return ADMIN_API_BASE;
}

async function request(path, options = {}) {
  const token = getAdminToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    const apiBase = ensureAdminApiBase();
    res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error.message?.includes('当前页面未配置后端 API 地址')) throw error;
    throw new Error('后端接口不可达，请检查服务是否启动或 API 地址是否正确。');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error('管理员鉴权失败，请检查管理员 token。');
    if (res.status === 500 && data.code === 'SERVER_CONFIG_INVALID') {
      throw new Error(data.message || '服务端配置不完整，请先检查后端环境变量。');
    }
    throw new Error(data.message || '请求失败');
  }
  return data;
}

function formatStatus(status) {
  const safe = String(status || 'pending');
  return `<span class="pill ${safe}">${safe}</span>`;
}

function formatText(value) {
  if (Array.isArray(value)) return value.length ? value.join('、') : '-';
  return value ? String(value) : '-';
}

function getLocalFeedbackItems() {
  try {
    return JSON.parse(localStorage.getItem('visa-toolbox-feedback-v1') || '[]');
  } catch {
    return [];
  }
}

function formatStatBlock(title, items) {
  if (!items || !items.length) return `<div><strong>${title}：</strong>暂无数据</div>`;
  return `<div><strong>${title}：</strong>${items.slice(0, 5).map(item => `${item.label} (${item.count})`).join('，')}</div>`;
}

function renderFeedbackStats(stats) {
  if (!stats) {
    feedbackStatsEl.innerHTML = '还没有加载统计。';
    return;
  }

  feedbackStatsEl.innerHTML = [
    `<div><strong>总评价数：</strong>${stats.total || 0}</div>`,
    formatStatBlock('评价模式', stats.byMode),
    formatStatBlock('帮助度', stats.helpfulness),
    formatStatBlock('最大问题', stats.mainIssue),
    formatStatBlock('收费偏好', stats.pricingPreference),
    formatStatBlock('推荐意愿', stats.recommendation),
    formatStatBlock('最常使用工具', stats.toolUsed),
    formatStatBlock('最想增加的功能', stats.wantedFeatures),
    formatStatBlock('用户最看重的点', stats.valueFocus),
  ].join('');
}

function renderFeedbackTable(items = getLocalFeedbackItems()) {
  currentFeedbackItems = items.slice(0, 100);
  if (!items.length) {
    feedbackTableBodyEl.innerHTML = '<tr><td colspan="9">当前还没有评价数据。</td></tr>';
    return;
  }

  feedbackTableBodyEl.innerHTML = currentFeedbackItems.map(item => `
    <tr>
      <td>${(item.created_at || item.createdAt || '').slice(0, 19).replace('T', ' ') || '-'}</td>
      <td>${formatText(item.mode)}</td>
      <td>${formatText(item.helpfulness)}</td>
      <td>${formatText(item.tool_used || item.toolUsed || item.source_tool || item.sourceTool)}</td>
      <td>${formatText(item.main_issue || item.mainIssue || item.question_key || item.questionKey)}</td>
      <td>${formatText(item.pricing_preference || item.pricingPreference)}</td>
      <td>${formatText(item.recommendation)}</td>
      <td>${formatText(item.extra_comment || item.extraComment || item.answer)}</td>
      <td><button type="button" data-feedback-delete="${item.id || ''}" class="warn">删除</button></td>
    </tr>
  `).join('');

  feedbackTableBodyEl.querySelectorAll('[data-feedback-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.feedbackDelete;
      if (!id) {
        showMessage(listMessageEl, '本地缓存评价暂不支持单条删除，请直接清理浏览器本地数据。', 'error');
        return;
      }
      const ok = window.confirm('确认删除这条评价吗？');
      if (!ok) return;
      try {
        await request(`/api/admin/feedback/${id}`, { method: 'DELETE' });
        showMessage(listMessageEl, '评价已删除。');
        await loadFeedbackFromApi();
      } catch (error) {
        showMessage(listMessageEl, error.message || '删除评价失败。', 'error');
      }
    });
  });
}

async function loadFeedbackFromApi() {
  try {
    const data = await request('/api/admin/feedback', { method: 'GET' });
    renderFeedbackStats(data.stats || null);
    renderFeedbackTable(data.items || []);
  } catch (error) {
    renderFeedbackStats(null);
    renderFeedbackTable();
    showMessage(listMessageEl, `${error.message || '加载后台评价失败。'}，已回退到本地评价显示。`, 'error');
  }
}

function renderTable(items) {
  const keyword = (searchInputEl.value || '').trim().toLowerCase();
  const filtered = items.filter(item => {
    const haystack = [item.license_key, item.customer_email, item.customer_name, item.product_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return !keyword || haystack.includes(keyword);
  });

  if (!filtered.length) {
    tableBodyEl.innerHTML = '<tr><td colspan="9">没有匹配的授权记录。</td></tr>';
    return;
  }

  tableBodyEl.innerHTML = filtered.map(item => `
    <tr>
      <td>${formatStatus(item.status)}</td>
      <td>${formatText(item.license_key)}</td>
      <td>${formatText(item.customer_email)}</td>
      <td>${formatText(item.customer_name)}</td>
      <td>${formatText(item.product_name)}</td>
      <td>${formatText(item.device_name)}</td>
      <td>${formatText(item.activation_usage)}</td>
      <td>${formatText(item.created_at ? item.created_at.slice(0, 19).replace('T', ' ') : '')}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="reset" data-id="${item.id}" class="secondary">重置设备</button>
          <button type="button" data-action="disable" data-id="${item.id}" class="warn">停用</button>
          <button type="button" data-action="delete" data-id="${item.id}" class="warn">删除</button>
        </div>
      </td>
    </tr>
  `).join('');

  tableBodyEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!id) return;

      try {
        if (action === 'reset') {
          await request(`/api/admin/licenses/${id}/reset-device`, { method: 'POST' });
          showMessage(listMessageEl, '设备绑定已重置。');
        }
        if (action === 'disable') {
          await request(`/api/admin/licenses/${id}/disable`, { method: 'POST' });
          showMessage(listMessageEl, '授权已停用。');
        }
        if (action === 'delete') {
          const ok = window.confirm('确认彻底删除这条授权吗？删除后不会保留在列表里。');
          if (!ok) return;
          await request(`/api/admin/licenses/${id}`, { method: 'DELETE' });
          showMessage(listMessageEl, '授权已删除。');
        }
        await loadLicenses();
      } catch (error) {
        showMessage(listMessageEl, error.message || '操作失败。', 'error');
      }
    });
  });
}

async function loadLicenses() {
  clearMessage(listMessageEl);
  tableBodyEl.innerHTML = '<tr><td colspan="9">正在加载...</td></tr>';

  if (!getAdminToken()) {
    tableBodyEl.innerHTML = '<tr><td colspan="9">还没有管理员 token，请先保存 token。</td></tr>';
    showMessage(listMessageEl, '请先输入并保存管理员 token。', 'error');
    await runDiagnostics();
    return;
  }

  try {
    const data = await request('/api/admin/licenses', { method: 'GET' });
    allLicenses = data.items || [];
    renderTable(allLicenses);
  } catch (error) {
    tableBodyEl.innerHTML = `<tr><td colspan="9">${error.message || '加载失败。'}</td></tr>`;
    showMessage(listMessageEl, error.message || '加载失败。', 'error');
  }
}

async function runDiagnostics() {
  setDiagnosticText(diagApiEl, null, '检查中...');
  setDiagnosticText(diagConfigEl, null, '检查中...');
  setDiagnosticText(diagDatabaseEl, null, '检查中...');
  setDiagnosticText(diagAuthEl, null, getAdminToken() ? '本地已保存 token，等待后端确认。' : '本地还未保存 token。');
  setDiagnosticText(diagTlsEl, null, '检查中...');
  diagnosticIssuesEl.innerHTML = '';

  try {
    const apiBase = ensureAdminApiBase();
    const res = await fetch(`${apiBase}/ready`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.checks) {
      throw new Error(data.message || '诊断接口返回异常。');
    }

    setDiagnosticText(diagApiEl, true, '后端接口可达。');
    setDiagnosticText(diagConfigEl, data.checks?.config?.ok, formatConfigDiagnosis(data.checks?.config));
    setDiagnosticText(diagDatabaseEl, data.checks?.database?.ok, formatDatabaseDiagnosis(data.checks?.database));
    setDiagnosticText(diagAuthEl, data.checks?.auth?.ok && Boolean(getAdminToken()), formatAuthDiagnosis(data.checks?.auth));
    setDiagnosticText(diagTlsEl, data.checks?.tls?.ok, data.checks?.tls?.message || '未返回 TLS 状态');

    const issues = data.checks?.config?.issues || [];
    diagnosticIssuesEl.innerHTML = issues.length
      ? issues.map(item => `<li>${item}</li>`).join('')
      : '<li>当前没有发现配置级问题。</li>';
  } catch (error) {
    setDiagnosticText(diagApiEl, false, error.message || '后端接口不可达。');
    setDiagnosticText(diagConfigEl, false, '无法读取');
    setDiagnosticText(diagDatabaseEl, false, '无法读取');
    setDiagnosticText(diagAuthEl, getAdminToken() ? null : false, getAdminToken() ? '本地已保存 token，但后端未响应。' : '本地还未保存 token。');
    setDiagnosticText(diagTlsEl, false, '无法读取');
    diagnosticIssuesEl.innerHTML = `<li>${error.message || '诊断失败。'}</li>`;
  }
}

async function createLicense() {
  clearMessage(createMessageEl);
  const customerEmail = document.getElementById('customerEmail').value.trim();
  const customerName = document.getElementById('customerName').value.trim();
  const orderId = document.getElementById('orderId').value.trim();
  const productName = document.getElementById('productName').value.trim();

  if (!customerEmail) {
    showMessage(createMessageEl, '请先填写用户邮箱。', 'error');
    return;
  }

  try {
    const data = await request('/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ customerEmail, customerName, orderId, productName }),
    });

    const licenseKey = data.license?.license_key || '';
    showMessage(createMessageEl, `授权已创建，激活码：${licenseKey}`);
    document.getElementById('orderId').value = '';
    document.getElementById('customerName').value = '';
    await loadLicenses();
  } catch (error) {
    showMessage(createMessageEl, error.message || '创建授权失败。', 'error');
  }
}

function escapeCsv(value) {
  const text = value == null ? '' : Array.isArray(value) ? value.join('、') : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportLicenseCsv() {
  const rows = allLicenses || [];
  if (!rows.length) {
    showMessage(listMessageEl, '当前没有可导出的授权数据。', 'error');
    return;
  }

  const header = ['状态', '激活码', '邮箱', '姓名', '商品', '设备', '激活次数', '创建时间'];
  const lines = [header.map(escapeCsv).join(',')];
  rows.forEach(item => {
    lines.push([
      item.status || '',
      item.license_key || '',
      item.customer_email || '',
      item.customer_name || '',
      item.product_name || '',
      item.device_name || '',
      item.activation_usage || '',
      item.created_at || '',
    ].map(escapeCsv).join(','));
  });

  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `licenses-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(item => item.trim());
}

async function importLicenseCsv(file) {
  if (!file) return;
  const text = await file.text();
  const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    showMessage(listMessageEl, 'CSV 内容为空。', 'error');
    return;
  }

  const rows = lines.slice(1).map(parseCsvLine).map(cols => ({
    customerEmail: cols[2] || cols[0] || '',
    customerName: cols[3] || cols[1] || '',
    productName: cols[4] || '签证工具箱',
    licenseKey: cols[1] && cols[1].startsWith('VT-') ? cols[1] : '',
    orderId: `CSV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  })).filter(item => item.customerEmail);

  if (!rows.length) {
    showMessage(listMessageEl, 'CSV 里没有可导入的邮箱数据。', 'error');
    return;
  }

  let success = 0;
  for (const row of rows) {
    try {
      await request('/api/admin/licenses', {
        method: 'POST',
        body: JSON.stringify(row),
      });
      success += 1;
    } catch {}
  }

  await loadLicenses();
  showMessage(listMessageEl, `CSV 导入完成，成功创建 ${success} 条授权。`, success ? 'ok' : 'error');
}

function exportFeedbackCsv() {
  const rows = currentFeedbackItems.length ? currentFeedbackItems : getLocalFeedbackItems();
  if (!rows.length) {
    showMessage(listMessageEl, '当前没有可导出的评价数据。', 'error');
    return;
  }

  const header = ['时间', '模式', '帮助度', '使用工具', '最大问题', '收费偏好', '推荐意愿', '最看重的点', '最想增加的功能', '补充', '单题键', '单题答案'];
  const lines = [header.map(escapeCsv).join(',')];
  rows.forEach(item => {
    lines.push([
      item.created_at || item.createdAt || '',
      item.mode || '',
      item.helpfulness || '',
      item.tool_used || item.toolUsed || item.source_tool || item.sourceTool || '',
      item.main_issue || item.mainIssue || '',
      item.pricing_preference || item.pricingPreference || '',
      item.recommendation || '',
      item.value_focus || item.valueFocus || '',
      item.wanted_features || item.wantedFeatures || '',
      item.extra_comment || item.extraComment || '',
      item.question_key || item.questionKey || '',
      item.answer || '',
    ].map(escapeCsv).join(','));
  });

  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `feedback-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderModeSelection(configOverride) {
  const config = configOverride || window.ModeConfig.readModeConfig();
  const presentation = window.ModeConfig.getModePresentation(config);
  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === selectedMode);
  });
  siteTitleEl.value = config.title;
  siteSubtitleEl.value = config.subtitle;
  siteAnnouncementEl.value = config.announcement;
  modeSummaryEl.innerHTML = [
    `<div><strong>当前模式：</strong>${presentation.modeLabel}</div>`,
    `<div><strong>首页提示：</strong>${presentation.bannerText}</div>`,
    `<div><strong>工具入口文案：</strong>${presentation.toolActionLabel}</div>`,
    '<div><strong>切换原则：</strong>测试版 ↔ 公测版 ↔ 收费版 使用同一套页面与数据入口，尽量无缝切换。</div>',
    '<div><strong>同步方式：</strong>当前模式已上云，其他设备刷新后会同步到同一个站点状态。</div>',
  ].join('');
}

async function loadModeConfigRemote() {
  const config = await window.ModeConfig.fetchModeConfig();
  selectedMode = config.mode;
  renderModeSelection(config);
}

async function saveModeConfig() {
  const next = {
    mode: selectedMode,
    title: siteTitleEl.value.trim() || '签证工具箱',
    subtitle: siteSubtitleEl.value.trim() || window.ModeConfig.DEFAULT_MODE_CONFIG.subtitle,
    announcement: siteAnnouncementEl.value.trim() || window.ModeConfig.DEFAULT_MODE_CONFIG.announcement,
  };
  try {
    const saved = await window.ModeConfig.saveModeConfigRemote(next, getAdminToken());
    selectedMode = saved.mode;
    renderModeSelection(saved);
    const presentation = window.ModeConfig.getModePresentation(saved);
    showMessage(modeMessageEl, `已切到${presentation.modeLabel}，并已同步到云端。`);
  } catch (error) {
    showMessage(modeMessageEl, error.message || '保存站点模式失败。', 'error');
  }
}

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedMode = btn.dataset.mode;
    const previewConfig = {
      ...window.ModeConfig.readModeConfig(),
      mode: selectedMode,
    };
    renderModeSelection(previewConfig);
  });
});

saveModeConfigBtn.addEventListener('click', saveModeConfig);
switchToBetaBtn.addEventListener('click', async () => {
  selectedMode = 'beta';
  siteAnnouncementEl.value = '当前为内测版，默认免费开放，用来快速验证流程、内容和页面体验。';
  await saveModeConfig();
});

if (runCleanupBtn) {
  runCleanupBtn.addEventListener('click', async () => {
    try {
      const data = await request('/api/admin/cleanup', { method: 'POST' });
      const summary = data.summary || {};
      showMessage(modeMessageEl, `清理完成，删除授权 ${summary.licensesDeleted || 0} 条，删除评价 ${summary.feedbackDeleted || 0} 条。`);
      await loadLicenses();
      await loadFeedbackFromApi();
    } catch (error) {
      showMessage(modeMessageEl, error.message || '执行清理失败。', 'error');
    }
  });
}

saveTokenBtn.addEventListener('click', () => {
  const token = adminTokenEl.value.trim();
  if (!token) {
    showMessage(createMessageEl, '请先输入管理员 token。', 'error');
    return;
  }
  setAdminToken(token);
  showMessage(createMessageEl, '管理员 token 已保存。');
  runDiagnostics();
  loadLicenses();
});

clearTokenBtn.addEventListener('click', () => {
  clearAdminToken();
  adminTokenEl.value = '';
  allLicenses = [];
  tableBodyEl.innerHTML = '<tr><td colspan="9">管理员 token 已清除。</td></tr>';
  runDiagnostics();
});

createLicenseBtn.addEventListener('click', createLicense);
refreshBtn.addEventListener('click', loadLicenses);
loadFeedbackBtn.addEventListener('click', loadFeedbackFromApi);
loadLocalFeedbackBtn.addEventListener('click', () => {
  renderFeedbackStats(null);
  renderFeedbackTable(getLocalFeedbackItems());
  showMessage(listMessageEl, '当前显示的是这个浏览器本地缓存的评价。');
});
if (exportFeedbackCsvBtn) {
  exportFeedbackCsvBtn.addEventListener('click', exportFeedbackCsv);
}
if (exportLicenseCsvBtn) {
  exportLicenseCsvBtn.addEventListener('click', exportLicenseCsv);
}
if (importLicenseCsvBtn && licenseCsvInput) {
  importLicenseCsvBtn.addEventListener('click', () => licenseCsvInput.click());
  licenseCsvInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    await importLicenseCsv(file);
    event.target.value = '';
  });
}
if (runDiagnosticsBtn) {
  runDiagnosticsBtn.addEventListener('click', runDiagnostics);
}
searchInputEl.addEventListener('input', () => renderTable(allLicenses));

adminTokenEl.value = getAdminToken();
renderModeSelection();
renderFeedbackStats(null);
renderFeedbackTable();
runDiagnostics();
loadLicenses();
if (getAdminToken()) {
  loadFeedbackFromApi();
  loadModeConfigRemote();
}
if (typeof window.addEventListener === 'function') {
  window.addEventListener('mode-config-changed', renderModeSelection);
}
