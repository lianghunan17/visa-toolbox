# 本地一键启动说明

## 启动前准备

先确认：
- `pr-app/license-api/.env` 已存在
- `.env` 里已填好 Supabase 配置

如果还没有：

```bash
cd /Users/liang/.openclaw/workspace/pr-app/license-api
cp .env.example .env
```

然后把数据库配置补进去。

---

## 一键启动

在 `pr-app/` 目录下执行：

```bash
bash start-local.sh
```

启动后可访问：
- 首页：`http://127.0.0.1:8000/`
- 评价页：`http://127.0.0.1:8000/feedback.html`
- 后台本地入口：`http://127.0.0.1:8000/admin.local.html`
- 后端健康检查：`http://127.0.0.1:8787/health`
- 后端就绪检查：`http://127.0.0.1:8787/ready`

脚本启动完成后，还会直接把后台管理员 token 打印出来，方便你复制进后台页面。

---

## 停止服务

```bash
bash stop-local.sh
```

---

## 日志位置

运行日志会写到：
- `pr-app/.run/frontend.log`
- `pr-app/.run/backend.log`

PID 文件会写到：
- `pr-app/.run/frontend.pid`
- `pr-app/.run/backend.pid`

---

## 常见问题

### 1. 提示没找到 `.env`
说明你还没给后端配置环境变量。

### 2. 后台看不到后端评价
先检查：
- Supabase SQL 是否已执行
- `.env` 是否正确
- `http://127.0.0.1:8787/health` 是否能打开
- `http://127.0.0.1:8787/ready` 是否为绿

### 3. 页面能开，但评价没进库
通常是后端没启动，或者数据库没配好。
