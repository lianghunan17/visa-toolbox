# visa-toolbox license api

这是给 `pr-app/` 配套的最小授权后端。

当前已支持：
- 激活接口
- 验权接口
- 管理员创建授权
- 管理员查看授权列表
- 管理员停用授权
- 管理员重置设备绑定
- Lemon Squeezy webhook 自动建授权

## 1. 安装

```bash
cd pr-app/license-api
npm install
cp .env.example .env
```

## 2. 先初始化数据库

在 Supabase SQL Editor 里执行：

- `supabase-init.sql`

这个文件会创建：
- `licenses`
- `license_events`
- `admin_users`
- `updated_at` 自动更新时间触发器

## 3. 配置环境变量

```txt
PORT=8787
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LICENSE_TOKEN_SECRET=
ADMIN_BEARER_TOKEN=
LEMON_SQUEEZY_WEBHOOK_SECRET=
CORS_ORIGIN=http://127.0.0.1:8000
```

说明：
- `SUPABASE_SERVICE_ROLE_KEY` 只放后端
- `LICENSE_TOKEN_SECRET` 用长随机字符串
- `ADMIN_BEARER_TOKEN` 是你自己调用管理接口时的令牌

## 4. 启动

```bash
npm run dev
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

## 5. 本地联调

前端静态站：

```bash
cd pr-app
python3 -m http.server 8000
```

后端：

```bash
cd pr-app/license-api
npm run dev
```

然后在本地联调页面里显式注入 API 地址。

推荐方式：
- 本地后台使用 `admin.local.html`
- 正式页面按 `../PRODUCTION_API_INJECTION.md` 注入 `window.__LICENSE_API_BASE__`

本地注入示例：

```html
<script>
  window.__LICENSE_API_BASE__ = 'http://127.0.0.1:8787';
</script>
```

正式上线时必须改成真实 API 域名，不要继续保留本地地址。

## 6. 接口说明

### 激活
`POST /api/license/activate`

请求示例：

```json
{
  "email": "user@example.com",
  "licenseKey": "VT-1234-5678",
  "deviceId": "hashed-device-id",
  "deviceName": "MacIntel / Mozilla"
}
```

### 验权
`POST /api/license/validate`

请求示例：

```json
{
  "authToken": "...",
  "deviceId": "hashed-device-id",
  "toolName": "visa-processing-time-tool"
}
```

### 管理员创建授权
`POST /api/admin/licenses`

Header：

```txt
Authorization: Bearer 你的 ADMIN_BEARER_TOKEN
```

请求示例：

```json
{
  "customerEmail": "user@example.com",
  "customerName": "张三",
  "orderId": "ORDER-001",
  "productName": "签证工具箱"
}
```

### 管理员查看授权
`GET /api/admin/licenses`

### 管理员停用授权
`POST /api/admin/licenses/:id/disable`

### 管理员重置设备
`POST /api/admin/licenses/:id/reset-device`

### Lemon Squeezy webhook
`POST /api/webhooks/lemonsqueezy`

说明：
- 校验 `x-signature`
- 自动按订单创建授权记录
- 自动防重

详细看：
- `LEMON_SQUEEZY_WEBHOOK.md`

## 7. 本地测试请求

看这个文件：
- `test-requests.md`

里面已经给了完整的 `curl` 示例。

## 8. 上线建议

推荐：
- 前端部署到 Cloudflare Pages
- API 部署到 Vercel
- 数据库存到 Supabase

## 9. 下一步建议

1. 把数据库 schema 跑起来
2. 本地联调激活流程
3. 做支付 webhook 自动创建授权
4. 再加一个轻量管理后台页面
