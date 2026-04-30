const form = document.getElementById('pr-form');
const result = document.getElementById('result');
const copyPrResultBtn = document.getElementById('copyPrResult');
const downloadPrPdfBtn = document.getElementById('downloadPrPdf');
const savedPrCasesEl = document.getElementById('savedPrCases');
const prCaseSearchEl = document.getElementById('prCaseSearch');
const prCaseSortEl = document.getElementById('prCaseSort');
const STORAGE_KEY = 'japan-pr-v4-form';
const PR_CASES_STORAGE_KEY = 'japan-pr-saved-cases';

let lastPrText = '';
let lastPrData = null;

function num(id) {
  return Number(document.getElementById(id).value || 0);
}

function val(id) {
  return document.getElementById(id).value;
}

function estimateWaitRange(data) {
  let min = 4;
  let max = 6;

  if (data.penalty !== 'no' || data.residentTax !== 'yes' || data.socialInsurance !== 'yes') {
    min = 6;
    max = 10;
  }

  if (data.longAbsence === 'yes' || data.guarantor === 'no') {
    max += 2;
  }

  return { min, max, label: `${min} 到 ${max} 个月` };
}

function addMonths(date, months) {
  const d = new Date(date);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < originalDay) d.setDate(0);
  return d;
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '无法计算';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function diffDays(fromDate, toDate = new Date()) {
  const from = new Date(fromDate);
  if (Number.isNaN(from.getTime())) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

function buildTrackingSummary(data, wait) {
  const lines = [];

  if (data.submitDate) {
    const waited = diffDays(data.submitDate);
    if (waited !== null) lines.push(`从递交日算起，目前大约已等待 ${waited} 天。`);

    const minDate = addMonths(data.submitDate, wait.min);
    const maxDate = addMonths(data.submitDate, wait.max);
    lines.push(`按当前估算，结果可能在 ${formatDate(minDate)} 到 ${formatDate(maxDate)} 之间下来。`);
  } else {
    lines.push('你还没有填写递交日期，所以目前不能计算等待天数和预计结果日期。');
  }

  if (data.latestNote) lines.push(`最近更新备注：${data.latestNote}`);
  return lines;
}

function buildChecklist(data) {
  const list = ['申请表', '护照与在留卡', '住民票', '身元保证相关材料'];

  if (data.residentTax !== 'yes' || data.socialInsurance !== 'yes') {
    list.push('补强纳税、年金、医保缴纳证明');
  } else {
    list.push('住民税课税证明、纳税证明');
    list.push('年金缴纳记录、健康保险相关证明');
  }

  if (data.visaType === 'work') list.push('在职证明、收入证明、雇用相关资料');
  if (data.visaType === 'spouse') list.push('婚姻关系和共同生活稳定性的补充材料');
  if (data.visaType === 'hsp70' || data.visaType === 'hsp80') list.push('高度人才积分证明资料');
  if (data.longAbsence !== 'no') list.push('出入境记录与离境原因说明');

  return [...new Set(list)];
}

function getFormData() {
  return {
    caseName: document.getElementById('caseName').value.trim(),
    visaType: val('visaType'),
    yearsInJapan: num('yearsInJapan'),
    qualifiedYears: num('qualifiedYears'),
    stayPeriod: val('stayPeriod'),
    income: num('income'),
    residentTax: val('residentTax'),
    socialInsurance: val('socialInsurance'),
    penalty: val('penalty'),
    longAbsence: val('longAbsence'),
    guarantor: val('guarantor'),
    submitDate: document.getElementById('submitDate').value,
    latestNote: document.getElementById('latestNote').value.trim(),
    marriageStable: val('marriageStable'),
    hspStable: val('hspStable'),
  };
}

function saveFormData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFormData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function fillForm(data) {
  Object.entries(data).forEach(([key, value]) => {
    const el = document.getElementById(key);
    if (!el || value === undefined || value === null) return;
    el.value = value;
  });
}

function evaluate(data) {
  const blockers = [];
  const warnings = [];
  const strengths = [];
  let eligible = true;

  const visaRules = {
    work: data.yearsInJapan >= 10 && data.qualifiedYears >= 5,
    spouse: data.yearsInJapan >= 1,
    longTerm: data.yearsInJapan >= 5,
    hsp70: data.yearsInJapan >= 3,
    hsp80: data.yearsInJapan >= 1,
  };

  if (!visaRules[data.visaType]) {
    eligible = false;
    blockers.push('当前填写的在留年限，还没有达到该类别通常可申请永驻的时间门槛。');
  } else {
    strengths.push('你填写的在留年限，基本达到当前类别的申请时间门槛。');
  }

  if (!['5', '3'].includes(data.stayPeriod)) warnings.push('当前在留期间不是较长期间，实务上会被视为不利因素。');
  else strengths.push('当前在留期间较长，这一点对永驻申请更有利。');

  if (data.residentTax !== 'yes') {
    eligible = false;
    blockers.push('住民税按时缴纳情况存在问题，这是永驻审查里的高风险点。');
  }
  if (data.socialInsurance !== 'yes') {
    eligible = false;
    blockers.push('年金或健康保险缴纳存在问题，这是永驻审查里的高风险点。');
  }
  if (data.penalty === 'yes') {
    eligible = false;
    blockers.push('存在严重违法记录，属于重大不利因素。');
  } else if (data.penalty === 'minor') {
    warnings.push('有轻微违法或交通记录，建议申请前做更细致评估。');
  }

  if (data.income < 300) warnings.push('收入偏低，可能影响独立生计能力判断。');
  else if (data.income >= 500) strengths.push('收入水平较稳，对独立生计能力判断更有帮助。');

  if (data.longAbsence === 'yes') warnings.push('离境时间较长或较频繁，可能影响连续在留判断。');
  else if (data.longAbsence === 'some') warnings.push('有一定离境记录，建议正式申请前核对出入境历史。');

  if (data.guarantor === 'no') {
    eligible = false;
    blockers.push('目前没有日本人或永住者担任身元保证人，正式申请会卡在材料准备阶段。');
  }

  if (data.visaType === 'spouse' && data.marriageStable === 'no') {
    eligible = false;
    blockers.push('配偶类永驻申请非常依赖婚姻真实性与稳定性，这项填写为否时风险很高。');
  }

  if ((data.visaType === 'hsp70' || data.visaType === 'hsp80') && data.hspStable !== 'yes') {
    eligible = false;
    blockers.push('高度人才通道要求分数持续满足，若不能稳定证明，则很难走快速永驻通道。');
  }

  let probability = '中';
  if (eligible && blockers.length === 0 && warnings.length <= 1) probability = '高';
  if (!eligible || blockers.length >= 2) probability = '低';

  const badgeClass = probability === '高' ? 'good' : probability === '中' ? 'warn' : 'bad';
  const wait = estimateWaitRange(data);
  const trackingSummary = buildTrackingSummary(data, wait);
  const checklist = buildChecklist(data);

  return { eligible, probability, badgeClass, wait, trackingSummary, blockers, warnings, strengths, checklist };
}

function getSavedPrCases() {
  return JSON.parse(localStorage.getItem(PR_CASES_STORAGE_KEY) || '[]');
}

function formatSavedPrCases(cases) {
  const keyword = prCaseSearchEl ? prCaseSearchEl.value.trim().toLowerCase() : '';
  const sort = prCaseSortEl ? prCaseSortEl.value : 'newest';
  let filtered = cases.filter(item => !keyword || (item.name || '').toLowerCase().includes(keyword));
  if (sort === 'oldest') filtered = filtered.sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
  else if (sort === 'name') filtered = filtered.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
  else filtered = filtered.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  return filtered;
}

function renderSavedPrCases() {
  if (!savedPrCasesEl) return;
  const cases = formatSavedPrCases(getSavedPrCases());
  if (!cases.length) {
    savedPrCasesEl.innerHTML = '还没有保存的案例。';
    return;
  }
  savedPrCasesEl.innerHTML = `<div class="case-list">${cases.map((item, idx) => `
    <div class="case-item">
      <div class="case-item-title">${item.name}</div>
      <div class="case-item-meta">${item.savedAt ? item.savedAt.slice(0, 19).replace('T', ' ') : ''}</div>
      <div class="case-item-actions">
        <button type="button" data-action="load" data-index="${idx}">回填</button>
        <button type="button" data-action="delete" data-index="${idx}">删除</button>
      </div>
    </div>
  `).join('')}</div>`;

  savedPrCasesEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = formatSavedPrCases(getSavedPrCases());
      const index = Number(btn.dataset.index);
      const action = btn.dataset.action;
      if (action === 'load') {
        const item = all[index];
        if (!item) return;
        fillForm(item.data);
        render(item.data);
      }
      if (action === 'delete') {
        const raw = getSavedPrCases().filter(x => x.savedAt !== all[index].savedAt);
        localStorage.setItem(PR_CASES_STORAGE_KEY, JSON.stringify(raw));
        renderSavedPrCases();
      }
    });
  });
}

function savePrCase(data, evaluated) {
  const cases = getSavedPrCases();
  cases.unshift({
    name: data.caseName || `永驻案例-${new Date().toISOString().slice(0, 10)}`,
    data,
    evaluated,
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(PR_CASES_STORAGE_KEY, JSON.stringify(cases.slice(0, 20)));
  renderSavedPrCases();
}

function downloadPrPdf() {
  if (!lastPrText || !lastPrData) {
    window.alert('请先生成辅助参考结果，再下载 PDF。');
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>永驻辅助参考结果</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:32px;line-height:1.8;color:#111}h1{font-size:24px;margin-bottom:16px}.card{border:1px solid #e5e7eb;border-radius:16px;padding:20px;background:#fff}pre{white-space:pre-wrap;font:14px/1.8 sans-serif}.note{margin-top:16px;color:#4b5563;font-size:13px;line-height:1.7}</style></head><body><div class="card"><h1>日本永驻申请辅助参考结果</h1><pre>${lastPrText}</pre><div class="note">免责声明：本结果仅供信息参考，不构成法律意见、代理意见或任何结果保证。最终请以官方要求、正式审查结果及专业人士意见为准。</div></div><script>window.onload=()=>{window.print();}</script></body></html>`;
  const win = window.open('', '_blank');
  win.document.open();
  win.document.write(html);
  win.document.close();
}

async function copyPrResult() {
  if (!lastPrText) {
    window.alert('请先生成辅助参考结果，再复制。');
    return;
  }
  await navigator.clipboard.writeText(lastPrText);
  window.alert('辅助参考结果已复制。');
}

function render(data) {
  const r = evaluate(data);
  lastPrData = data;
  lastPrText = [
    '日本永驻申请辅助参考结果',
    `当前准备度参考: ${r.eligible ? '可继续准备' : '建议先补条件'}`,
    `综合参考等级: ${r.probability}`,
    `预计审理时间: ${r.wait.label}`,
    '',
    '主要风险:',
    ...(r.blockers.length ? r.blockers : ['目前没有明显硬性阻断项。']),
    '',
    '有利因素:',
    ...(r.strengths.length ? r.strengths : ['目前暂未看到特别明显的强优势。']),
    '',
    `最近更新备注: ${data.latestNote || '无'}`,
    '',
    '免责声明: 本结果仅供信息参考，不构成法律意见、代理意见或任何结果保证。',
  ].join('\n');

  result.innerHTML = `
    <div class="badge ${r.badgeClass}">辅助参考</div>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">当前准备度参考</div>
        <div class="value">${r.eligible ? '可继续准备' : '建议先补条件'}</div>
      </div>
      <div class="summary-item">
        <div class="label">综合参考等级</div>
        <div class="value">${r.probability}</div>
      </div>
      <div class="summary-item">
        <div class="label">预计审理时间</div>
        <div class="value">${r.wait.label}</div>
      </div>
    </div>

    <div class="result-block">
      <h3>1. 当前参考</h3>
      <p>${r.eligible ? '从你填写的信息看，当前接近常见申请门槛，可继续准备材料并核对细节。' : '从你填写的信息看，当前直接申请的风险偏高，建议先补条件后再评估。'}</p>
    </div>

    <div class="result-block">
      <h3>2. 申请跟踪</h3>
      <ul>${r.trackingSummary.map(item => `<li>${item}</li>`).join('')}</ul>
    </div>

    <div class="result-block">
      <h3>3. 主要风险提示</h3>
      <ul>${(r.blockers.length ? r.blockers : ['目前没有明显硬性阻断项。']).map(item => `<li>${item}</li>`).join('')}</ul>
    </div>

    <div class="result-block">
      <h3>4. 建议优先准备的材料</h3>
      <ul>${r.checklist.map(item => `<li>${item}</li>`).join('')}</ul>
    </div>

    <div class="result-block">
      <h3>5. 对你有利的因素</h3>
      <ul>${(r.strengths.length ? r.strengths : ['目前暂未看到特别明显的强优势。']).map(item => `<li>${item}</li>`).join('')}</ul>
    </div>

    <div class="result-block">
      <h3>6. 需要留意的点</h3>
      <p style="margin-bottom:10px;color:#6b7280;">以下内容仅供信息参考，不构成法律意见或结果保证。</p>
      <ul>${(r.warnings.length ? r.warnings : ['目前没有特别突出的软性风险项。']).map(item => `<li>${item}</li>`).join('')}</ul>
    </div>
  `;
}

const saved = loadFormData();
if (saved) {
  fillForm(saved);
  render(saved);
}
renderSavedPrCases();
if (prCaseSearchEl) prCaseSearchEl.addEventListener('input', renderSavedPrCases);
if (prCaseSortEl) prCaseSortEl.addEventListener('change', renderSavedPrCases);

if (copyPrResultBtn) copyPrResultBtn.addEventListener('click', copyPrResult);
if (downloadPrPdfBtn) downloadPrPdfBtn.addEventListener('click', downloadPrPdf);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ok = await ensureLicense('permanent-residence-tool');
  if (!ok) return;

  const data = getFormData();
  saveFormData(data);
  const evaluated = evaluate(data);
  savePrCase(data, evaluated);
  render(data);
});
