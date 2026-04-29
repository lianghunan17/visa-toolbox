import http from 'node:http';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT || 8787);
const NODE_ENV = process.env.NODE_ENV || 'development';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const LICENSE_TOKEN_SECRET = process.env.LICENSE_TOKEN_SECRET || 'change-me';
const ADMIN_BEARER_TOKEN = process.env.ADMIN_BEARER_TOKEN || '';
const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function getConfigIssues() {
  const issues = [];
  if (!SUPABASE_URL) issues.push('缺少 SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) issues.push('缺少 SUPABASE_SERVICE_ROLE_KEY');
  if (!ADMIN_BEARER_TOKEN) issues.push('缺少 ADMIN_BEARER_TOKEN');
  if (!LICENSE_TOKEN_SECRET || LICENSE_TOKEN_SECRET === 'change-me') issues.push('LICENSE_TOKEN_SECRET 仍是默认值');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') issues.push('检测到全局关闭 TLS 校验，存在安全风险');
  return issues;
}

const configIssues = getConfigIssues();

function hasCriticalConfigIssues() {
  return configIssues.some(issue => issue.includes('SUPABASE_') || issue.includes('ADMIN_BEARER_TOKEN') || issue.includes('LICENSE_TOKEN_SECRET'));
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function parseBody(req) {
  const raw = await readRawBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('JSON 格式错误');
  }
}

function normalizeLicenseKey(input = '') {
  return String(input).trim();
}

function nowIso() {
  return new Date().toISOString();
}

function generateLicenseKey() {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `VT-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function verifyLemonSqueezySignature(rawBody, signature) {
  if (!LEMON_SQUEEZY_WEBHOOK_SECRET || !signature) return false;
  const digest = crypto
    .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', LICENSE_TOKEN_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token = '') {
  const [body, signature] = String(token).split('.');
  if (!body || !signature) return null;
  const expected = crypto
    .createHmac('sha256', LICENSE_TOKEN_SECRET)
    .update(body)
    .digest('base64url');
  if (expected !== signature) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function requireSupabase(res) {
  if (!supabase) {
    json(res, 500, {
      code: 'SERVER_CONFIG_INVALID',
      message: '服务端未配置数据库连接，请检查 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。',
      issues: configIssues,
    });
    return false;
  }
  return true;
}

async function insertEvent(licenseId, eventType, payload = {}) {
  if (!supabase || !licenseId) return;
  await supabase.from('license_events').insert({
    license_id: licenseId,
    event_type: eventType,
    event_payload: payload,
  });
}

async function findLicenseByKey(licenseKey) {
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('license_key', licenseKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findLicenseByToken(authToken) {
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('auth_token', authToken)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function handleActivate(req, res) {
  if (!requireSupabase(res)) return;

  const body = await parseBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const licenseKey = normalizeLicenseKey(body.licenseKey);
  const deviceId = String(body.deviceId || '').trim();
  const deviceName = String(body.deviceName || '').trim().slice(0, 200);

  if (!email || !licenseKey || !deviceId) {
    return json(res, 400, { message: '缺少必要参数。' });
  }

  const license = await findLicenseByKey(licenseKey);
  if (!license) {
    return json(res, 404, { message: '激活码不存在。' });
  }

  if (String(license.customer_email || '').trim().toLowerCase() !== email) {
    await insertEvent(license.id, 'activate_failed_email_mismatch', { email, deviceId });
    return json(res, 403, { message: '购买邮箱与激活码不匹配。' });
  }

  if (license.status === 'disabled') {
    return json(res, 403, { message: '该授权已被停用。' });
  }

  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    return json(res, 403, { message: '该授权已过期。' });
  }

  if (license.device_id && license.device_id !== deviceId) {
    return json(res, 403, { message: '该激活码已绑定其他设备，请联系管理员换绑。' });
  }

  const tokenPayload = {
    licenseId: license.id,
    licenseKey: license.license_key,
    deviceId,
    email,
    issuedAt: nowIso(),
  };
  const authToken = signToken(tokenPayload);

  const nextUsage = license.device_id ? license.activation_usage || 1 : (license.activation_usage || 0) + 1;
  const updatePayload = {
    status: 'active',
    device_id: deviceId,
    device_name: deviceName,
    auth_token: authToken,
    activated_at: license.activated_at || nowIso(),
    activation_usage: nextUsage,
    updated_at: nowIso(),
  };

  const { error: updateError } = await supabase
    .from('licenses')
    .update(updatePayload)
    .eq('id', license.id);

  if (updateError) {
    return json(res, 500, { message: '激活失败，保存授权状态时出错。' });
  }

  await insertEvent(license.id, 'activated', { email, deviceId, deviceName });

  return json(res, 200, {
    success: true,
    message: '激活成功。',
    authToken,
    licenseStatus: 'active',
    productName: license.product_name,
    activationUsage: nextUsage,
  });
}

async function handleValidate(req, res) {
  if (!requireSupabase(res)) return;

  const body = await parseBody(req);
  const authToken = String(body.authToken || '').trim();
  const deviceId = String(body.deviceId || '').trim();
  const toolName = String(body.toolName || 'toolbox').trim();

  if (!authToken || !deviceId) {
    return json(res, 400, { valid: false, message: '缺少必要参数。' });
  }

  const decoded = verifyToken(authToken);
  if (!decoded) {
    return json(res, 401, { valid: false, message: '授权令牌无效。' });
  }

  if (decoded.deviceId !== deviceId) {
    return json(res, 403, { valid: false, message: '当前设备与授权设备不匹配。' });
  }

  const license = await findLicenseByToken(authToken);
  if (!license) {
    return json(res, 404, { valid: false, message: '未找到授权记录。' });
  }

  if (license.status === 'disabled') {
    await insertEvent(license.id, 'validate_failed_disabled', { deviceId, toolName });
    return json(res, 403, { valid: false, status: 'disabled', message: '该授权已被停用。' });
  }

  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    await insertEvent(license.id, 'validate_failed_expired', { deviceId, toolName });
    return json(res, 403, { valid: false, status: 'expired', message: '该授权已过期。' });
  }

  if (license.device_id !== deviceId) {
    await insertEvent(license.id, 'validate_failed_device_mismatch', { deviceId, toolName });
    return json(res, 403, { valid: false, status: 'device_mismatch', message: '设备不匹配，请重新激活。' });
  }

  await insertEvent(license.id, 'validate_passed', { deviceId, toolName });
  return json(res, 200, { valid: true, status: 'active', message: '授权有效。' });
}

function checkAdmin(req) {
  const auth = String(req.headers.authorization || '');
  return ADMIN_BEARER_TOKEN && auth === `Bearer ${ADMIN_BEARER_TOKEN}`;
}

const DEFAULT_SITE_MODE_CONFIG = {
  mode: 'beta',
  theme: 'future',
  title: '签证工具箱',
  subtitle: '把常用的签证与在留判断工具放进一个更轻、更快、更未来感的入口。',
  announcement: '当前为内测版，默认免费开放，用来快速验证流程、内容和页面体验。',
  ctaLabel: '开始体验',
  requireLicenseInPaid: true,
  surveyGateEnabled: true,
};

async function getRuntimeConfig(configKey) {
  const { data, error } = await supabase
    .from('app_runtime_config')
    .select('*')
    .eq('config_key', configKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function upsertRuntimeConfig(configKey, configValue) {
  const payload = {
    config_key: configKey,
    config_value: configValue,
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from('app_runtime_config')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function createLicenseRecord({ customerEmail, customerName, orderId, productName, notes, licenseKey }) {
  const payload = {
    license_key: licenseKey || generateLicenseKey(),
    product_name: productName || '签证工具箱',
    order_id: orderId || null,
    customer_email: customerEmail,
    customer_name: customerName || null,
    status: 'pending',
    activation_limit: 1,
    activation_usage: 0,
    notes: notes || null,
  };

  const { data, error } = await supabase.from('licenses').insert(payload).select('*').single();
  if (error) throw error;

  await insertEvent(data.id, 'created', { customerEmail, orderId });
  return data;
}

async function handleAdminCreate(req, res) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  const body = await parseBody(req);
  const customerEmail = String(body.customerEmail || '').trim().toLowerCase();
  if (!customerEmail) return json(res, 400, { message: 'customerEmail 必填。' });

  try {
    const data = await createLicenseRecord({
      customerEmail,
      customerName: body.customerName,
      orderId: body.orderId,
      productName: body.productName,
      notes: body.notes,
      licenseKey: body.licenseKey,
    });
    return json(res, 200, { success: true, license: data });
  } catch (error) {
    return json(res, 500, { message: '创建授权失败。', detail: error.message });
  }
}

async function handleLemonSqueezyWebhook(req, res) {
  if (!requireSupabase(res)) return;
  const rawBody = await readRawBody(req);
  const signature = String(req.headers['x-signature'] || '');

  if (!verifyLemonSqueezySignature(rawBody, signature)) {
    return json(res, 401, { message: 'webhook 签名校验失败。' });
  }

  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json(res, 400, { message: 'webhook JSON 无效。' });
  }

  const eventName = body.meta?.event_name || body.event_name || '';
  if (!eventName.includes('order')) {
    return json(res, 200, { success: true, ignored: true, reason: '非订单事件' });
  }

  const attrs = body.data?.attributes || {};
  const orderId = String(attrs.order_number || attrs.identifier || body.data?.id || '').trim();
  const customerEmail = String(attrs.user_email || attrs.customer_email || '').trim().toLowerCase();
  const customerName = String(attrs.user_name || attrs.customer_name || '').trim();
  const productName = String(attrs.product_name || '签证工具箱').trim();

  if (!orderId || !customerEmail) {
    return json(res, 400, { message: '订单缺少 orderId 或 customerEmail。' });
  }

  const { data: existed, error: findError } = await supabase
    .from('licenses')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (findError) {
    return json(res, 500, { message: '查询订单授权失败。', detail: findError.message });
  }

  if (existed) {
    await insertEvent(existed.id, 'webhook_duplicate_order', { orderId, eventName });
    return json(res, 200, { success: true, duplicated: true, licenseId: existed.id });
  }

  try {
    const created = await createLicenseRecord({
      customerEmail,
      customerName,
      orderId,
      productName,
      notes: `lemonsqueezy:${eventName}`,
    });
    await insertEvent(created.id, 'lemonsqueezy_order_created', { orderId, eventName });
    return json(res, 200, { success: true, licenseId: created.id, licenseKey: created.license_key });
  } catch (error) {
    return json(res, 500, { message: '根据订单创建授权失败。', detail: error.message });
  }
}

async function handleAdminDisable(req, res, id) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  const { error } = await supabase.from('licenses').update({
    status: 'disabled',
    disabled_at: nowIso(),
    updated_at: nowIso(),
  }).eq('id', id);

  if (error) return json(res, 500, { message: '停用失败。', detail: error.message });
  await insertEvent(id, 'disabled', {});
  return json(res, 200, { success: true, message: '已停用。' });
}

async function handleAdminResetDevice(req, res, id) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  const { error } = await supabase.from('licenses').update({
    device_id: null,
    device_name: null,
    auth_token: null,
    status: 'pending',
    updated_at: nowIso(),
  }).eq('id', id);

  if (error) return json(res, 500, { message: '重置设备失败。', detail: error.message });
  await insertEvent(id, 'device_reset', {});
  return json(res, 200, { success: true, message: '设备绑定已重置。' });
}

async function handleAdminDelete(req, res, id) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  await insertEvent(id, 'deleted', {});
  const { error } = await supabase.from('licenses').delete().eq('id', id);
  if (error) return json(res, 500, { message: '删除授权失败。', detail: error.message });
  return json(res, 200, { success: true, message: '授权已删除。' });
}

async function handleFeedbackSubmit(req, res) {
  if (!requireSupabase(res)) return;

  const body = await parseBody(req);
  const payload = {
    mode: body.mode === 'survey-gate' ? 'survey-gate' : 'full',
    helpfulness: body.helpfulness || null,
    tool_used: body.toolUsed || null,
    value_focus: Array.isArray(body.valueFocus) ? body.valueFocus : null,
    main_issue: body.mainIssue || null,
    wanted_features: Array.isArray(body.wantedFeatures) ? body.wantedFeatures : null,
    pricing_preference: body.pricingPreference || null,
    recommendation: body.recommendation || null,
    extra_comment: body.extraComment || null,
    question_key: body.questionKey || null,
    answer: body.answer || null,
    source_tool: body.sourceTool || null,
    client_tag: body.clientTag || null,
  };

  const { error } = await supabase.from('feedback_entries').insert(payload);
  if (error) {
    return json(res, 500, { message: '保存评价失败。', detail: error.message });
  }

  return json(res, 200, { success: true, message: '评价已提交。' });
}

async function handleAdminFeedbackDelete(req, res, id) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  const { error } = await supabase.from('feedback_entries').delete().eq('id', id);
  if (error) return json(res, 500, { message: '删除评价失败。', detail: error.message });
  return json(res, 200, { success: true, message: '评价已删除。' });
}

function tally(items, key) {
  const map = {};
  for (const item of items) {
    const value = item?.[key];
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach(v => {
        if (!v) return;
        map[v] = (map[v] || 0) + 1;
      });
    } else {
      map[value] = (map[value] || 0) + 1;
    }
  }
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

async function handleAdminFeedbackList(req, res) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  await cleanupExpiredData();

  const { data, error } = await supabase
    .from('feedback_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return json(res, 500, { message: '查询评价失败。', detail: error.message });

  const stats = {
    total: data.length,
    byMode: tally(data, 'mode'),
    helpfulness: tally(data, 'helpfulness'),
    mainIssue: tally(data, 'main_issue'),
    pricingPreference: tally(data, 'pricing_preference'),
    recommendation: tally(data, 'recommendation'),
    toolUsed: tally(data.map(item => ({ tool_used: item.tool_used || item.source_tool })), 'tool_used'),
    wantedFeatures: tally(data, 'wanted_features'),
    valueFocus: tally(data, 'value_focus'),
  };

  return json(res, 200, { success: true, items: data, stats });
}

async function handlePublicSiteMode(req, res) {
  if (!requireSupabase(res)) return;

  try {
    const row = await getRuntimeConfig('site_mode');
    return json(res, 200, {
      success: true,
      config: {
        ...DEFAULT_SITE_MODE_CONFIG,
        ...(row?.config_value || {}),
      },
    });
  } catch (error) {
    return json(res, 500, { message: '读取站点模式失败。', detail: error.message });
  }
}

async function handleAdminSiteModeGet(req, res) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });
  return handlePublicSiteMode(req, res);
}

async function handleAdminSiteModeSet(req, res) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  try {
    const body = await parseBody(req);
    const nextConfig = {
      ...DEFAULT_SITE_MODE_CONFIG,
      ...(body.config || {}),
    };
    const saved = await upsertRuntimeConfig('site_mode', nextConfig);
    return json(res, 200, { success: true, config: saved.config_value });
  } catch (error) {
    return json(res, 500, { message: '保存站点模式失败。', detail: error.message });
  }
}

async function cleanupExpiredData() {
  if (!supabase) return { licensesDeleted: 0, feedbackDeleted: 0 };
  const cutoffIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldLicenses, error: oldLicensesError } = await supabase
    .from('licenses')
    .select('id')
    .lt('created_at', cutoffIso);
  if (oldLicensesError) throw oldLicensesError;

  let licensesDeleted = 0;
  if (oldLicenses?.length) {
    const ids = oldLicenses.map(item => item.id).filter(Boolean);
    const { error: deleteLicensesError } = await supabase
      .from('licenses')
      .delete()
      .in('id', ids);
    if (deleteLicensesError) throw deleteLicensesError;
    licensesDeleted = ids.length;
  }

  const { data: oldFeedback, error: oldFeedbackError } = await supabase
    .from('feedback_entries')
    .select('id')
    .lt('created_at', cutoffIso);
  if (oldFeedbackError) throw oldFeedbackError;

  let feedbackDeleted = 0;
  if (oldFeedback?.length) {
    const ids = oldFeedback.map(item => item.id).filter(Boolean);
    const { error: deleteFeedbackError } = await supabase
      .from('feedback_entries')
      .delete()
      .in('id', ids);
    if (deleteFeedbackError) throw deleteFeedbackError;
    feedbackDeleted = ids.length;
  }

  return { licensesDeleted, feedbackDeleted };
}

async function handleAdminCleanup(req, res) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  try {
    const summary = await cleanupExpiredData();
    return json(res, 200, { success: true, summary });
  } catch (error) {
    return json(res, 500, { message: '自动清理失败。', detail: error.message });
  }
}

async function handleAdminList(req, res) {
  if (!requireSupabase(res)) return;
  if (!checkAdmin(req)) return json(res, 401, { message: '管理员鉴权失败。' });

  await cleanupExpiredData();

  const { data, error } = await supabase
    .from('licenses')
    .select('id, license_key, product_name, customer_email, customer_name, status, activation_usage, device_name, created_at, activated_at, disabled_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return json(res, 500, { message: '查询授权失败。', detail: error.message });
  return json(res, 200, { success: true, items: data });
}

function classifyDatabaseError(error) {
  const message = String(error?.message || error || '未知数据库错误');
  const lower = message.toLowerCase();

  if (lower.includes('certificate') || lower.includes('tls') || lower.includes('ssl') || lower.includes('issuer')) {
    return {
      code: 'DB_TLS_ERROR',
      message: '数据库 TLS/证书链校验失败。',
      detail: message,
    };
  }

  if (lower.includes('relation') && lower.includes('does not exist')) {
    return {
      code: 'DB_TABLE_MISSING',
      message: '数据库已连接，但关键表不存在。',
      detail: message,
    };
  }

  if (lower.includes('permission denied') || lower.includes('not allowed') || lower.includes('row-level security')) {
    return {
      code: 'DB_PERMISSION_ERROR',
      message: '数据库已连接，但当前 key 权限不足。',
      detail: message,
    };
  }

  if (lower.includes('invalid api key') || lower.includes('invalid jwt') || lower.includes('jwt')) {
    return {
      code: 'DB_AUTH_ERROR',
      message: '数据库鉴权失败，请检查 Supabase key。',
      detail: message,
    };
  }

  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('getaddrinfo') || lower.includes('econnrefused') || lower.includes('enotfound')) {
    return {
      code: 'DB_NETWORK_ERROR',
      message: '数据库网络不可达。',
      detail: message,
    };
  }

  return {
    code: 'DB_UNKNOWN_ERROR',
    message: '数据库检查失败。',
    detail: message,
  };
}

async function checkDatabaseReady() {
  if (!supabase) {
    return {
      ok: false,
      code: 'DB_NOT_CONFIGURED',
      message: '数据库未配置。',
    };
  }

  try {
    const { error } = await supabase.from('licenses').select('id', { count: 'exact', head: true }).limit(1);
    if (error) {
      return {
        ok: false,
        ...classifyDatabaseError(error),
      };
    }
    return {
      ok: true,
      code: 'DB_OK',
      message: '数据库连接正常。',
    };
  } catch (error) {
    return {
      ok: false,
      ...classifyDatabaseError(error),
    };
  }
}

async function handleReady(req, res) {
  const database = await checkDatabaseReady();
  const payload = {
    ok: !hasCriticalConfigIssues() && database.ok,
    service: 'visa-toolbox-license-api',
    env: NODE_ENV,
    checks: {
      config: {
        ok: !hasCriticalConfigIssues(),
        message: hasCriticalConfigIssues() ? '配置不完整。' : '配置检查通过。',
        issues: configIssues,
      },
      database,
      auth: {
        ok: Boolean(ADMIN_BEARER_TOKEN),
        message: ADMIN_BEARER_TOKEN ? '管理员 token 已配置。' : '缺少 ADMIN_BEARER_TOKEN。',
      },
      tls: {
        ok: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
        message: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? '检测到全局关闭 TLS 校验。' : 'TLS 校验正常开启。',
      },
    },
  };

  return json(res, payload.ok ? 200 : 500, payload);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, hasCriticalConfigIssues() ? 500 : 200, {
        ok: !hasCriticalConfigIssues(),
        service: 'visa-toolbox-license-api',
        env: NODE_ENV,
        config: {
          supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
          adminTokenConfigured: Boolean(ADMIN_BEARER_TOKEN),
          licenseTokenConfigured: Boolean(LICENSE_TOKEN_SECRET && LICENSE_TOKEN_SECRET !== 'change-me'),
          tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0',
        },
        issues: configIssues,
      });
    }

    if (req.method === 'GET' && url.pathname === '/ready') {
      return handleReady(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/license/activate') {
      return handleActivate(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/license/validate') {
      return handleValidate(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/webhooks/lemonsqueezy') {
      return handleLemonSqueezyWebhook(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/feedback') {
      return handleFeedbackSubmit(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/site-mode') {
      return handlePublicSiteMode(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/feedback') {
      return handleAdminFeedbackList(req, res);
    }

    const feedbackDeleteMatch = url.pathname.match(/^\/api\/admin\/feedback\/([^/]+)$/);
    if (req.method === 'DELETE' && feedbackDeleteMatch) {
      return handleAdminFeedbackDelete(req, res, feedbackDeleteMatch[1]);
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/site-mode') {
      return handleAdminSiteModeGet(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/site-mode') {
      return handleAdminSiteModeSet(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/cleanup') {
      return handleAdminCleanup(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/licenses') {
      return handleAdminList(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/licenses') {
      return handleAdminCreate(req, res);
    }

    const disableMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/disable$/);
    if (req.method === 'POST' && disableMatch) {
      return handleAdminDisable(req, res, disableMatch[1]);
    }

    const resetMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/reset-device$/);
    if (req.method === 'POST' && resetMatch) {
      return handleAdminResetDevice(req, res, resetMatch[1]);
    }

    const deleteMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteMatch) {
      return handleAdminDelete(req, res, deleteMatch[1]);
    }

    return json(res, 404, { message: '接口不存在。' });
  } catch (error) {
    return json(res, 500, { message: error.message || '服务端错误。' });
  }
});

server.listen(PORT, () => {
  console.log(`[visa-toolbox-license-api] running at http://127.0.0.1:${PORT}`);
  console.log(`[visa-toolbox-license-api] NODE_ENV=${NODE_ENV}`);
  if (configIssues.length) {
    console.warn('[visa-toolbox-license-api] 配置自检发现问题:');
    configIssues.forEach(issue => console.warn(`- ${issue}`));
  } else {
    console.log('[visa-toolbox-license-api] 配置自检通过');
  }
});
