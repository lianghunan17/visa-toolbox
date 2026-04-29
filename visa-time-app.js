const form = document.getElementById('visa-form');
const result = document.getElementById('result');
const bureauEl = document.getElementById('bureauName');
const appKindEl = document.getElementById('applicationKind');
const metricEl = document.getElementById('metric');
const statusEl = document.getElementById('residenceStatus');
const submitDateEl = document.getElementById('submitDate');
const todayDateEl = document.getElementById('todayDate');
const regionFactorEl = document.getElementById('regionFactor');
const prefectureEl = document.getElementById('prefecture');
const regionalNoteEl = document.getElementById('regional-note');
const officeNoteEl = document.getElementById('office-note');
const caseNameEl = document.getElementById('caseName');
const savedCasesEl = document.getElementById('savedCases');
const caseSearchEl = document.getElementById('caseSearch');
const caseSortEl = document.getElementById('caseSort');
const downloadPdfBtn = document.getElementById('downloadPdf');
const copyResultBtn = document.getElementById('copyResult');

let rows = [];
let regionalSources = [];
let prefectureMap = {};
let prefectureOfficeMap = {};
let officeDetailsMap = {};
let lastInput = null;
let lastPrediction = null;
const CASES_STORAGE_KEY = 'visa-time-saved-cases';

function displayLabel(value, type) {
  if (type === 'metric') {
    const map = {
      '処分（交付）までの日数': '処分（交付）までの日数, 从受理到交付结果的天数',
      '処分（告知）までの日数': '処分（告知）までの日数, 从受理到通知结果的天数',
      '審査終了までの日数': '審査終了までの日数, 到审查完成为止的天数',
    };
    return map[value] || value;
  }
  if (type === 'applicationKind') {
    const map = {
      '在留資格認定証明書交付': '在留資格認定証明書交付, 认定证明书交付',
      '在留期間更新': '在留期間更新, 在留期间更新',
      '在留資格変更': '在留資格変更, 在留资格变更',
    };
    return map[value] || value;
  }
  return value;
}

function setOptions(el, values, type) {
  el.innerHTML = values.map(v => `<option value="${v}">${displayLabel(v, type)}</option>`).join('');
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function parseDate(s) {
  return new Date(`${s}T00:00:00`);
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '无法计算';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function diffDays(fromDate, toDate) {
  const ms = parseDate(toDate).getTime() - parseDate(fromDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function weightedRecentAvg(items) {
  const weights = [0.5, 0.3, 0.15, 0.05];
  const sorted = [...items].sort((a, b) => b.period_date.localeCompare(a.period_date)).slice(0, 4);
  const vals = sorted.map(x => Number(x.avg_days));
  const ws = weights.slice(0, vals.length);
  return vals.reduce((acc, v, i) => acc + v * ws[i], 0) / ws.reduce((a, b) => a + b, 0);
}

function seasonalFactor(items, month) {
  const vals = items.map(x => Number(x.avg_days));
  const sameMonth = items.filter(x => Number(x.period_date.slice(5, 7)) === month).map(x => Number(x.avg_days));
  if (!vals.length || !sameMonth.length) return 1;
  const factor = mean(sameMonth) / mean(vals);
  return Math.max(0.85, Math.min(1.15, factor));
}

function normalizeWeighted(values, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  return values.reduce((acc, v, i) => acc + v * weights[i], 0) / total;
}

function getRegionalMultiplier(region) {
  const map = {
    '全国': 1.0,
    '東京': 1.08,
    '大阪': 1.03,
    '名古屋': 1.05,
    '福岡': 0.98,
  };
  return map[region] || 1.0;
}

function getRegionalSource(region) {
  return regionalSources.find(x => x.region === region) || null;
}

function getConfidence(sampleCount, regionFactor, prefecture) {
  if (sampleCount >= 10 && regionFactor === '全国') return '高';
  if (sampleCount >= 8 && prefecture) return '中';
  return '中偏低';
}

function renderOfficeDetailCard(name) {
  const detail = officeDetailsMap[name];
  if (!detail) return `<li>${name}</li>`;
  return `
    <li>
      <strong>${name}</strong><br />
      地址：${detail.address}<br />
      电话：<a href="tel:${detail.phone.replace(/[^\d+]/g, '')}">${detail.phone}</a><br />
      官网：<a href="${detail.website}" target="_blank" rel="noreferrer">打开官网</a><br />
      地图：<a href="${detail.map}" target="_blank" rel="noreferrer">打开地图</a><br />
      办理时间：${detail.hours || '请以官网为准'}<br />
      备注：${detail.note || '暂无补充'}
    </li>
  `;
}

function renderOfficeNote(prefecture) {
  if (!officeNoteEl) return;
  if (!prefecture) {
    officeNoteEl.innerHTML = '<p class="source-title">可能受理点</p><p>未选择都道府县。</p>';
    return;
  }
  const info = prefectureOfficeMap[prefecture];
  if (!info) {
    officeNoteEl.innerHTML = `<p class="source-title">可能受理点：${prefecture}</p><p>当前未整理到该地区的受理点映射。</p>`;
    return;
  }
  officeNoteEl.innerHTML = `
    <p class="source-title">可能受理点：${prefecture}</p>
    <ul>
      <li>推荐受理点：${info.recommended}</li>
      <li>备选受理点：${info.alternatives.length ? info.alternatives.join('、') : '暂无'}</li>
      <li>说明：${info.note}</li>
    </ul>
    <div class="policy-box">
      <p class="source-title">受理点联系信息</p>
      <ul>
        ${renderOfficeDetailCard(info.recommended)}
        ${info.alternatives.map(renderOfficeDetailCard).join('')}
      </ul>
    </div>
  `;
}

function renderRegionalNote(region) {
  if (!regionalNoteEl) return;
  if (region === '全国') {
    regionalNoteEl.innerHTML = '<p class="source-title">地区修正说明</p><p>当前使用全国官方历史均值，不叠加地方修正。</p>';
    return;
  }
  const info = getRegionalSource(region);
  if (!info) {
    regionalNoteEl.innerHTML = '<p class="source-title">地区修正说明</p><p>当前没有该地区的额外说明。</p>';
    return;
  }
  regionalNoteEl.innerHTML = `<p class="source-title">地区修正说明：${region}</p><p>${info.summary}</p>`;
}

function predict({ bureau, appKind, metric, status, submitDate, todayDate, regionFactor, prefecture }) {
  const base = rows.filter(r => r.metric === metric);
  const level1 = base.filter(r => r.bureau_name === bureau && r.application_kind === appKind && r.residence_status === status);
  const level2 = base.filter(r => r.bureau_name === bureau && r.application_kind === appKind);
  const level3 = base.filter(r => r.application_kind === appKind && r.residence_status === status);
  const level4 = base.filter(r => r.application_kind === appKind);

  const levels = [level1, level2, level3, level4];
  const levelWeights = [0.55, 0.2, 0.2, 0.05];
  const estimates = [];
  const weights = [];

  levels.forEach((items, i) => {
    if (items.length) {
      estimates.push(weightedRecentAvg(items));
      weights.push(levelWeights[i]);
    }
  });

  if (!estimates.length) return null;

  const baseRows = level1.length ? level1 : level2.length ? level2 : level3.length ? level3 : level4;
  let predDays = normalizeWeighted(estimates, weights) * seasonalFactor(baseRows, parseDate(submitDate).getMonth() + 1);
  predDays *= getRegionalMultiplier(regionFactor);
  const spread = std(baseRows.map(x => Number(x.avg_days)));

  const predDate = parseDate(submitDate);
  predDate.setDate(predDate.getDate() + Math.round(predDays));

  const elapsed = todayDate ? diffDays(submitDate, todayDate) : null;
  let speed = '未判断';
  if (elapsed !== null) {
    const ratio = elapsed / predDays;
    if (ratio < 0.9) speed = '正常偏快';
    else if (ratio <= 1.2) speed = '正常范围';
    else if (ratio <= 1.5) speed = '略慢';
    else speed = '明显偏慢';
  }

  return {
    predDays,
    predDate: formatDate(predDate),
    p80: predDays + 0.8 * spread,
    p90: predDays + 1.3 * spread,
    sampleCount: baseRows.length,
    elapsed,
    speed,
    confidence: getConfidence(baseRows.length, regionFactor, prefecture),
    trendRows: base.filter(r => r.application_kind === appKind && r.residence_status === status),
  };
}

function buildTrendSvg(baseRows) {
  const sorted = [...baseRows].sort((a, b) => a.period_date.localeCompare(b.period_date)).slice(-12);
  if (!sorted.length) return '<p>暂无趋势数据。</p>';

  const width = 520;
  const height = 180;
  const pad = 24;
  const values = sorted.map(r => Number(r.avg_days));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = sorted.map((r, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(sorted.length - 1, 1);
    const y = height - pad - ((Number(r.avg_days) - min) / range) * (height - pad * 2);
    return { x, y, label: r.period_date.slice(0, 7), value: Number(r.avg_days) };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const dots = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#2563eb"></circle>`).join('');
  const labels = points.map((p, i) => i % 2 === 0 ? `<text x="${p.x}" y="${height - 6}" font-size="10" text-anchor="middle" fill="#6b7280">${p.label.slice(2)}</text>` : '').join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="180" aria-label="历史趋势图">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#cbd5e1" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#cbd5e1" />
      <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${polyline}" />
      ${dots}
      ${labels}
    </svg>
  `;
}

function buildOfficeContactLines(officeInfo) {
  if (!officeInfo) return ['推荐: 未指定', '备选: 未指定', '说明: 未指定'];
  const names = [officeInfo.recommended, ...(officeInfo.alternatives || [])].filter(Boolean);
  const detailLines = names.flatMap(name => {
    const detail = officeDetailsMap[name];
    if (!detail) return [`- ${name}`];
    return [
      `- ${name}`,
      `  地址: ${detail.address}`,
      `  电话: ${detail.phone}`,
      `  官网: ${detail.website}`,
      `  地图: ${detail.map}`,
      `  办理时间: ${detail.hours || '请以官网为准'}`,
      `  备注: ${detail.note || '暂无补充'}`,
    ];
  });
  return [
    `推荐: ${officeInfo.recommended}`,
    `备选: ${officeInfo.alternatives.length ? officeInfo.alternatives.join('、') : '暂无'}`,
    `说明: ${officeInfo.note}`,
    '联系信息:',
    ...detailLines,
  ];
}

function buildPredictionText() {
  if (!lastPrediction || !lastInput) return '';
  const officeInfo = lastInput.prefecture ? prefectureOfficeMap[lastInput.prefecture] : null;
  return [
    '日本在留审理时间预测结果',
    `都道府县: ${lastInput.prefecture || '未指定'}`,
    `地区修正: ${lastInput.regionFactor}`,
    `申请类型: ${lastInput.appKind}`,
    `指标口径: ${lastInput.metric}`,
    `在留资格: ${lastInput.status}`,
    `递交日期: ${lastInput.submitDate}`,
    `今天日期: ${lastInput.todayDate || '未填写'}`,
    `预测平均天数: ${lastPrediction.predDays.toFixed(1)} 天`,
    `预计结果日期: ${lastPrediction.predDate}`,
    `P80: ${lastPrediction.p80.toFixed(1)} 天`,
    `P90: ${lastPrediction.p90.toFixed(1)} 天`,
    `当前等待判断: ${lastPrediction.speed}`,
    `可信度: ${lastPrediction.confidence}`,
    '可能受理点:',
    ...buildOfficeContactLines(officeInfo),
    '口径说明: 全国官方历史均值 + 地方近似修正，不是地方局官方平均审理天数。'
  ].join('\n');
}

async function copyPredictionResult() {
  const text = buildPredictionText();
  if (!text) {
    window.alert('请先生成预测结果，再复制。');
    return;
  }
  await navigator.clipboard.writeText(text);
  window.alert('预测结果已复制。');
}

function getSavedCases() {
  return JSON.parse(localStorage.getItem(CASES_STORAGE_KEY) || '[]');
}

function formatSavedCases(cases) {
  const keyword = caseSearchEl ? caseSearchEl.value.trim().toLowerCase() : '';
  const sort = caseSortEl ? caseSortEl.value : 'newest';
  let filtered = cases.filter(item => !keyword || (item.name || '').toLowerCase().includes(keyword));
  if (sort === 'oldest') filtered = filtered.sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
  else if (sort === 'name') filtered = filtered.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
  else filtered = filtered.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  return filtered;
}

function renderSavedCases() {
  if (!savedCasesEl) return;
  const cases = formatSavedCases(getSavedCases());
  if (!cases.length) {
    savedCasesEl.innerHTML = '还没有保存的案例。';
    return;
  }
  savedCasesEl.innerHTML = `<div class="case-list">${cases.map((item, idx) => `
    <div class="case-item">
      <div class="case-item-title">${item.name}</div>
      <div class="case-item-meta">${item.savedAt ? item.savedAt.slice(0, 19).replace('T', ' ') : ''}</div>
      <div class="case-item-actions">
        <button type="button" data-action="load" data-index="${idx}">回填</button>
        <button type="button" data-action="delete" data-index="${idx}">删除</button>
      </div>
    </div>
  `).join('')}</div>`;

  savedCasesEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      const action = btn.dataset.action;
      const all = getSavedCases();
      if (action === 'load') {
        const item = all[index];
        if (!item) return;
        if (caseNameEl) caseNameEl.value = item.input.caseName || '';
        bureauEl.value = item.input.bureau;
        appKindEl.value = item.input.appKind;
        metricEl.value = item.input.metric;
        refreshStatuses();
        statusEl.value = item.input.status;
        submitDateEl.value = item.input.submitDate;
        todayDateEl.value = item.input.todayDate || '';
        prefectureEl.value = item.input.prefecture || '';
        regionFactorEl.value = item.input.regionFactor || '全国';
        renderRegionalNote(regionFactorEl.value);
        renderOfficeNote(prefectureEl.value);
      }
      if (action === 'delete') {
        all.splice(index, 1);
        localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(all));
        renderSavedCases();
      }
    });
  });
}

function saveCurrentCase() {
  if (!lastInput || !lastPrediction) return;
  const cases = JSON.parse(localStorage.getItem(CASES_STORAGE_KEY) || '[]');
  cases.unshift({
    name: lastInput.caseName || `案例-${new Date().toISOString().slice(0, 10)}`,
    input: lastInput,
    prediction: lastPrediction,
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases.slice(0, 20)));
  renderSavedCases();
}

function downloadPredictionPdf() {
  if (!lastPrediction || !lastInput) {
    window.alert('请先生成预测结果，再下载 PDF。');
    return;
  }

  const officeInfo = lastInput.prefecture ? prefectureOfficeMap[lastInput.prefecture] : null;
  const lines = [
    '日本在留审理时间预测结果',
    '',
    `都道府县: ${lastInput.prefecture || '未指定'}`,
    `地区修正: ${lastInput.regionFactor}`,
    `申请类型: ${lastInput.appKind}`,
    `指标口径: ${lastInput.metric}`,
    `在留资格: ${lastInput.status}`,
    `递交日期: ${lastInput.submitDate}`,
    `今天日期: ${lastInput.todayDate || '未填写'}`,
    '',
    `预测平均天数: ${lastPrediction.predDays.toFixed(1)} 天`,
    `预计结果日期: ${lastPrediction.predDate}`,
    `P80: ${lastPrediction.p80.toFixed(1)} 天`,
    `P90: ${lastPrediction.p90.toFixed(1)} 天`,
    `当前等待判断: ${lastPrediction.speed}`,
    `可信度: ${lastPrediction.confidence}`,
    '',
    '可能受理点与联系信息:',
    ...buildOfficeContactLines(officeInfo),
    '',
    '数据口径说明:',
    '基础口径为全国官方历史处理期间。',
    '地方结果为全国历史均值加地方近似修正，不是地方局官方平均审理天数。',
  ];

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>预测结果</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:32px;line-height:1.8;color:#111}h1{font-size:24px}pre{white-space:pre-wrap;font:14px/1.8 sans-serif}</style></head><body><h1>日本在留审理时间预测结果</h1><pre>${lines.join('\n')}</pre><script>window.onload=()=>{window.print();}</script></body></html>`;
  const win = window.open('', '_blank');
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function buildOfficeContactHtml(officeInfo) {
  if (!officeInfo) {
    return '<p>当前未指定可能受理点。</p>';
  }
  const names = [officeInfo.recommended, ...(officeInfo.alternatives || [])].filter(Boolean);
  return `<div class="office-contact-grid">${names.map(name => {
    const detail = officeDetailsMap[name];
    if (!detail) {
      return `<div class="office-contact-card"><h4>${name}</h4><p>当前还没有补充到这条机构资料。</p></div>`;
    }
    return `
      <article class="office-contact-card">
        <h4>${name}</h4>
        <p><strong>地址：</strong>${detail.address}</p>
        <p><strong>电话：</strong><a href="tel:${detail.phone.replace(/[^\d+]/g, '')}">${detail.phone}</a></p>
        <p><strong>办理时间：</strong>${detail.hours || '请以官网为准'}</p>
        <p><strong>备注：</strong>${detail.note || '暂无补充'}</p>
        <div class="office-contact-links">
          <a href="${detail.website}" target="_blank" rel="noreferrer">官网</a>
          <a href="${detail.map}" target="_blank" rel="noreferrer">地图</a>
        </div>
      </article>
    `;
  }).join('')}</div>`;
}

function renderPrediction(pred, input) {
  if (!pred) {
    result.innerHTML = '<p>当前组合没有足够数据，暂时无法预测。</p>';
    return;
  }

  lastInput = input;
  lastPrediction = pred;
  const officeInfo = input.prefecture ? prefectureOfficeMap[input.prefecture] : null;

  result.innerHTML = `
    <div class="badge good">官方历史预测</div>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">预测平均天数</div>
        <div class="value">${pred.predDays.toFixed(1)} 天</div>
      </div>
      <div class="summary-item">
        <div class="label">预计结果日期</div>
        <div class="value">${pred.predDate}</div>
      </div>
      <div class="summary-item">
        <div class="label">当前等待判断</div>
        <div class="value">${pred.speed}</div>
      </div>
    </div>
    <div class="result-block">
      <h3>1. 区间参考</h3>
      <ul>
        <li>P80: ${pred.p80.toFixed(1)} 天</li>
        <li>P90: ${pred.p90.toFixed(1)} 天</li>
      </ul>
    </div>
    <div class="result-block">
      <h3>4. 当前等待判断</h3>
      <ul>
        <li>已等待: ${pred.elapsed === null ? '未提供 today 日期' : `${pred.elapsed} 天`}</li>
        <li>判断: ${pred.speed}</li>
      </ul>
    </div>
    <div class="result-block">
      <h3>5. 可信度与口径</h3>
      <ul>
        <li>可信度: ${pred.confidence}</li>
        <li>基础口径: 全国官方历史处理期间</li>
        <li>地方结果: 全国历史均值 + 地方近似修正，不是地方局官方平均审理天数</li>
      </ul>
    </div>
    <div class="result-block">
      <h3>6. 样本说明</h3>
      <ul>
        <li>统计口径: ${input.bureau}</li>
        <li>都道府县: ${input.prefecture || '未指定'}</li>
        <li>地区修正: ${input.regionFactor}</li>
        <li>申请类型: ${input.appKind}</li>
        <li>指标: ${input.metric}</li>
        <li>在留资格: ${input.status}</li>
        <li>历史样本数: ${pred.sampleCount}</li>
      </ul>
    </div>
    <div class="result-block">
      <h3>7. 可能受理点</h3>
      <ul>
        <li>推荐受理点：${officeInfo ? officeInfo.recommended : '未指定'}</li>
        <li>备选受理点：${officeInfo ? (officeInfo.alternatives.length ? officeInfo.alternatives.join('、') : '暂无') : '未指定'}</li>
        <li>说明：${officeInfo ? officeInfo.note : '未指定'}</li>
      </ul>
    </div>
    <div class="result-block">
      <h3>8. 受理点联系信息</h3>
      ${buildOfficeContactHtml(officeInfo)}
    </div>
    <div class="result-block">
      <h3>9. 历史趋势</h3>
      ${buildTrendSvg(pred.trendRows)}
    </div>
  `;
}

function refreshStatuses() {
  const appKind = appKindEl.value;
  const metric = metricEl.value;
  const filtered = rows.filter(r => r.application_kind === appKind && r.metric === metric);
  setOptions(statusEl, unique(filtered.map(r => r.residence_status)));
}

function syncRegionFromPrefecture() {
  const prefecture = prefectureEl.value;
  renderOfficeNote(prefecture);
  if (!prefecture) return;
  const mapped = prefectureMap[prefecture];
  if (mapped) {
    regionFactorEl.value = mapped;
    renderRegionalNote(mapped);
  }
}

async function init() {
  const res = await fetch('./visa-time-data.json');
  rows = await res.json();
  const regionalRes = await fetch('./visa-regional-sources.json');
  regionalSources = await regionalRes.json();
  const prefRes = await fetch('./prefecture-bureau-map.json');
  prefectureMap = await prefRes.json();
  const officeRes = await fetch('./prefecture-office-map.json');
  prefectureOfficeMap = await officeRes.json();
  const officeDetailRes = await fetch('./office-details.json');
  officeDetailsMap = await officeDetailRes.json();

  setOptions(appKindEl, unique(rows.map(r => r.application_kind)), 'applicationKind');
  setOptions(metricEl, unique(rows.map(r => r.metric)), 'metric');
  refreshStatuses();

  const today = new Date();
  todayDateEl.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  appKindEl.addEventListener('change', refreshStatuses);
  metricEl.addEventListener('change', refreshStatuses);

  renderRegionalNote(regionFactorEl.value);
  renderOfficeNote(prefectureEl.value);
  renderSavedCases();
  if (caseSearchEl) caseSearchEl.addEventListener('input', renderSavedCases);
  if (caseSortEl) caseSortEl.addEventListener('change', renderSavedCases);
  regionFactorEl.addEventListener('change', () => renderRegionalNote(regionFactorEl.value));
  prefectureEl.addEventListener('change', syncRegionFromPrefecture);

  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', downloadPredictionPdf);
  }
  if (copyResultBtn) {
    copyResultBtn.addEventListener('click', copyPredictionResult);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await ensureLicense('visa-processing-time-tool');
    if (!ok) return;

    const input = {
      bureau: bureauEl.value,
      appKind: appKindEl.value,
      metric: metricEl.value,
      status: statusEl.value,
      submitDate: submitDateEl.value,
      todayDate: todayDateEl.value,
      caseName: caseNameEl ? caseNameEl.value.trim() : '',
      prefecture: prefectureEl.value,
      regionFactor: regionFactorEl.value,
    };

    if (!input.submitDate) {
      result.innerHTML = '<p>请先填写递交日期。</p>';
      return;
    }

    const pred = predict(input);
    renderRegionalNote(input.regionFactor);
    renderOfficeNote(input.prefecture);
    renderPrediction(pred, input);
    saveCurrentCase();
  });
}

init();
