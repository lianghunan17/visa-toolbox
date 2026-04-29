# 签证工具箱授权后端说明

## 1. 目标

给当前静态前端补一个最小授权后端，满足：
- 首次激活
- 设备绑定
- 后续验权
- 管理员停用
- 管理员重置设备

---

## 2. 推荐部署

### 推荐组合
- API：Vercel Serverless Functions 或 Cloudflare Workers
- 数据库：Supabase Postgres
- 支付：Lemon Squeezy

---

## 3. 数据库 Schema（示例）

```sql
create table licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text unique not null,
  product_name text not null default '签证工具箱',
  order_id text,
  customer_email text not null,
  customer_name text,
  status text not null default 'pending',
  activation_limit integer not null default 1,
  activation_usage integer not null default 0,
  device_id text,
  device_name text,
  auth_token text,
  activated_at timestamptz,
  expires_at timestamptz,
  disabled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  event_type text not null,
  event_payload jsonb,
  created_at timestamptz not null default now()
);

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 4. 激活接口

### `POST /api/license/activate`

请求：
```json
{
  "email": "user@example.com",
  "licenseKey": "VT-XXXX-XXXX-XXXX",
  "deviceId": "hashed-device-id",
  "deviceName": "MacIntel / Mozilla..."
}
```

处理逻辑：
1. 查找 license_key
2. 校验 email 是否匹配
3. status 不能是 disabled / expired
4. 如果未绑定设备，则写入 device_id 和 device_name
5. 如果已绑定同设备，则允许通过
6. 如果已绑定其他设备且超过数量，则拒绝
7. 生成 auth_token
8. 写入 activated_at、activation_usage、status=active
9. 记录 license_events

返回：
```json
{
  "success": true,
  "message": "激活成功",
  "authToken": "server-generated-token",
  "licenseStatus": "active"
}
```

---

## 5. 验权接口

### `POST /api/license/validate`

请求：
```json
{
  "authToken": "server-generated-token",
  "deviceId": "hashed-device-id",
  "toolName": "visa-processing-time-tool"
}
```

处理逻辑：
1. 根据 auth_token 查找授权
2. 检查 status
3. 检查是否过期
4. 检查 device_id 是否匹配
5. 返回 valid=true/false
6. 记录 license_events

返回：
```json
{
  "valid": true,
  "status": "active",
  "message": "授权有效"
}
```

---

## 6. 管理后台最小接口

### 新建授权
`POST /api/admin/licenses`

### 授权列表
`GET /api/admin/licenses`

### 停用授权
`POST /api/admin/licenses/:id/disable`

### 重置设备
`POST /api/admin/licenses/:id/reset-device`

### 重发授权
`POST /api/admin/licenses/:id/resend`

---

## 7. 支付平台联动

### Lemon Squeezy 推荐逻辑
1. 用户支付成功
2. webhook 推送订单
3. 后端创建 license 记录
4. 如平台自带 license key，则直接保存平台 key
5. 给用户返回激活说明

### Stripe 替代逻辑
1. Checkout 支付成功
2. webhook 收到 `checkout.session.completed`
3. 服务端生成自有 license_key
4. 写入 licenses 表
5. 给用户发邮件

---

## 8. 安全要点

- auth_token 必须由服务端生成
- 管理员密码只保存 hash
- 前端不保存数据库密钥
- 不在静态站暴露 webhook secret
- license_key 不等于管理员密码

---

## 9. 最小上线顺序

1. 建表
2. 写激活接口
3. 写验权接口
4. 给前端接入
5. 做管理员停用和重置接口
6. 接支付 webhook

---

## 10. 环境变量建议

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_JWT_SECRET=
LICENSE_TOKEN_SECRET=
LEMON_SQUEEZY_WEBHOOK_SECRET=
STRIPE_WEBHOOK_SECRET=
```
