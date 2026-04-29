# 签证工具箱

一个适合公开部署的静态小工具箱，当前包含三个入口：

1. 日本在留审理时间预测
2. 日本永驻申请判断
3. 使用评价

项目风格：
- 简约风
- 手机优先
- 兼容电脑端
- 适合部署到 Cloudflare Pages / Vercel / Netlify

---

## 目录结构

- `index.html`
  - 工具箱首页
- `visa-time-index.html`
  - 在留审理时间预测页面
- `visa-time-app.js`
  - 在留审理时间预测逻辑
- `visa-time-data.json`
  - 历史数据
- `visa-regional-sources.json`
  - 地方局公开信号摘要
- `prefecture-bureau-map.json`
  - 都道府县到局体系映射
- `prefecture-office-map.json`
  - 都道府县到可能受理点映射
- `pr-index.html`
  - 永驻申请判断页面
- `app.js`
  - 永驻申请判断逻辑
- `styles.css`
  - 统一样式
- `_headers`
  - 静态站响应头配置
- `_redirects`
  - 静态站路由映射
- `DEPLOY.md`
  - 部署说明

---

## 当前功能

## 当前阶段

当前默认按“公开测试版”运行：
- 免费开放使用
- 首页保留使用评价入口
- 切换工具时可能弹出 1 题轻量评价
- 评价优先提交到后端，失败时本地兜底

### 1. 在留审理时间预测
- 全国官方历史处理期间预测
- 地方近似修正
- 都道府县自动归属局体系
- 推荐 / 备选受理点
- 历史趋势图
- PDF 下载
- 一键复制结果
- 多案例保存、搜索、排序、回填、删除

### 2. 永驻申请判断
- 基于常见规则与风险点的粗略判断
- 风险 / 优势 / 材料建议
- 跟踪备注
- PDF 下载
- 一键复制结果
- 多案例保存、搜索、排序、回填、删除

---

## 使用方式

### 本地打开
如果只是自己本地使用，建议用简单静态服务打开，而不是直接双击 HTML。

例如：

```bash
cd pr-app
python3 -m http.server 8000
```

然后浏览器访问：

```txt
http://127.0.0.1:8000/
```

---

## 部署建议

推荐平台：
- Cloudflare Pages（优先推荐）
- Vercel
- Netlify

详细部署说明见：
- `DEPLOY.md`
- `PUBLIC_LAUNCH_CHECKLIST.md`
- `GO_LIVE_RUNBOOK.md`
- `FRONTEND_DEPLOYMENT.md`
- `ADMIN_DEPLOYMENT.md`

---

## 重要说明

### 在留审理时间预测
当前地方结果不是地方局官方平均审理时长，而是：
- 全国官方历史均值
- 加地方近似修正

### 永驻申请判断
这是规则化粗略判断工具：
- 不构成法律意见
- 不代表官方承诺
- 最终仍以官方资料与实际审查为准

---

## 适合的下一步

如果后续继续增强，推荐方向：
- Cloudflare 自定义域名
- Cloudflare Analytics
- 案例导出 / 导入
- 更细的地方局数据
- 更多签证相关工具页
- 评价统计图形化
- 测试版评价驱动的收费版切换
