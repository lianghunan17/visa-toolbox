# 上线执行手册

这份手册只保留最短可执行路径，适合准备正式公开时直接照着做。

---

## 0. 上线目标

当前建议目标：
- 先上线 **公测版**
- 不直接收费公开
- 先灰度，再放量

---

## 1. 上线前本地确认

### 1.1 后端自检

```bash
cd /Users/liang/.openclaw/workspace/pr-app/license-api
npm run preflight
```

要求：
- 必须通过

### 1.2 本地健康检查

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/ready
```

要求：
- 两个都返回 `ok: true`

### 1.3 后台页检查

打开：

- `http://127.0.0.1:8080/admin.html`

要求：
- 诊断面板全绿
- 授权列表可加载
- 能创建测试授权

---

## 2. 部署正式 API

你需要一个正式 Node 运行环境。

### 2.1 准备正式环境变量

至少要有：

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_BEARER_TOKEN=
LICENSE_TOKEN_SECRET=
CORS_ORIGIN=
PORT=8787
NODE_ENV=production
```

要求：
- `SUPABASE_SERVICE_ROLE_KEY` 只放服务端
- `LICENSE_TOKEN_SECRET` 用长随机字符串
- `ADMIN_BEARER_TOKEN` 不进入前端
- `CORS_ORIGIN` 改成正式前端域名

### 2.2 启动正式 API

最少命令形态：

```bash
cd license-api
npm install
node server.js
```

如果正式环境也遇到 Node 证书链问题，再参考当前开发环境的证书链修复思路，不要重新启用 `NODE_TLS_REJECT_UNAUTHORIZED=0`。

### 2.3 验证正式 API

部署后立刻检查：

```bash
curl https://你的-api-domain/health
curl https://你的-api-domain/ready
```

上线标准：
- `health.ok = true`
- `ready.ok = true`

如果 `ready` 不绿，不进入下一步。

---

## 3. 部署正式前端

### 3.1 部署目录

直接部署：

- `pr-app/`

推荐：
- Cloudflare Pages

### 3.2 正式 API 注入

正式环境必须显式注入：

```html
<script>
  window.__LICENSE_API_BASE__ = 'https://你的-api-domain';
</script>
```

如果漏配，前端现在会直接报错，不会静默连错地址。

参考文档：
- `PRODUCTION_API_INJECTION.md`

### 3.3 前端部署后检查

至少检查：
- 首页正常
- `/visa` 正常
- `/pr` 正常
- `admin.html` 正常
- 反馈页正常

---

## 4. 正式联调

上线前至少走通一次完整链路。

### 4.1 管理链路

验证：
- 后台能加载授权列表
- 能创建授权
- 能看到评价数据

### 4.2 用户链路

验证：
- 用户可输入激活码
- 激活成功
- 验权成功
- 已激活设备再次进入正常

### 4.3 诊断链路

验证：
- `/health` 正常
- `/ready` 正常
- 后台诊断面板显示正确

---

## 5. 公开实施顺序

### 5.1 灰度

先给 3 到 10 个真实用户。

要看：
- 页面是否能打开
- 是否出现报错
- 授权是否能用
- 用户能否理解页面

### 5.2 小范围扩散

灰度没问题后，再发到小范围社群。

### 5.3 正式公开

前两步稳定后，再正式放大。

---

## 6. 回滚原则

出问题时，优先：
1. 先停止继续扩散
2. 切回测试公告或维护中提示
3. 保留后台和诊断接口
4. 修完再恢复公开

不要让用户面对“无响应但无解释”的状态。

---

## 7. 上线完成定义

满足以下条件，才算真正可公开：

- `npm run preflight` 通过
- 正式 `/health` 为绿
- 正式 `/ready` 为绿
- 正式前端已注入正式 API 域名
- 后台可正常使用
- 授权创建 / 激活 / 验权至少走通一遍
- 有灰度计划
- 有回滚办法

只要有一项没满足，就不建议直接大范围公开。
