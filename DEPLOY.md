# 部署说明（Cloudflare Pages 优先）

当前项目 `pr-app/` 已整理为适合公开部署的静态站版本。

## 推荐平台

首选：**Cloudflare Pages**

原因：
- 免费额度足够
- 纯静态站支持很好
- 上传快
- 后续如要接自定义域名、基础保护、分析也方便

---

## 部署目录

直接把 `pr-app/` 当作静态站根目录部署。

关键入口：
- `index.html`：工具箱首页
- `visa-time-index.html`：在留审理时间预测
- `pr-index.html`：永驻申请判断

已包含：
- `_headers`
- `_redirects`

其中：
- `/visa` 会映射到 `visa-time-index.html`
- `/pr` 会映射到 `pr-index.html`

---

## Cloudflare Pages，最简单做法

### 方法 1，直接上传静态文件
1. 登录 Cloudflare Dashboard
2. 进入 Pages
3. 创建新项目
4. 选择 **Direct Upload**
5. 上传 `pr-app/` 目录中的全部文件
6. 部署完成

---

## 如果接 Git 仓库

### Cloudflare Pages 配置
- Framework preset: **None**
- Build command: 留空
- Build output directory: `pr-app`

如果仓库根目录就是当前工作区，则输出目录填：

```txt
pr-app
```

---

## 路由效果

部署后可访问：
- `/` → 工具箱首页
- `/visa` → 在留审理时间预测
- `/pr` → 永驻申请判断

---

## 公开版注意事项

当前版本是公开静态站，因此：
- 页面逻辑会在浏览器端执行
- JSON 数据会被访问者下载到本地浏览器
- 案例保存依赖 `localStorage`，不同设备之间不会自动同步

所以请注意：
- 不要把真正敏感的密钥放进前端
- 不要把私人案例数据直接预置进静态文件

---

## 页面说明建议保留

建议保留页面中的免责声明，明确：
- 仅供参考
- 不构成法律意见
- 不代表官方承诺
- 以日本出入国在留管理庁最新公开信息为准

---

## 如需下一步增强

后续可以继续做：
- 自定义域名
- Cloudflare Analytics
- Cloudflare Access（如果以后要限制访问）
- 案例导出 / 导入
- 后端化与账号体系
