# 前台页面部署说明

这份说明只针对公开前台页面，不包含后台管理页。

## 1. 哪些页面会访问后端 API

当前至少包括：
- `index.html`
- `feedback.html`
- `license.html`
- 以及它们依赖的：
  - `license-client.js`
  - `mode-config.js`
  - `feedback-api.js`

## 2. 正式部署原则

正式环境下：
- 不允许继续依赖本地地址
- 不允许继续保留示例地址
- 必须显式注入 `window.__LICENSE_API_BASE__`

## 3. 最简单做法

在需要访问 API 的页面里，在相关脚本之前插入：

```html
<script>
  window.__LICENSE_API_BASE__ = 'https://你的-api-domain';
</script>
```

你也可以直接参考模板文件：

- `api-base.production.template.html`

## 4. 建议插入位置

### index.html
在这些脚本之前：
- `mode-config.js`
- `license-client.js`
- `feedback-api.js`

### feedback.html
在这些脚本之前：
- `mode-config.js`
- `feedback-api.js`

### license.html
在这些脚本之前：
- `license-client.js`

## 5. 漏配时的表现

现在如果漏配，前端不会静默连错地址，而是直接报：

- `当前页面未配置后端 API 地址，请先注入 window.__LICENSE_API_BASE__。`

这是故意保留下来的保护机制。

## 6. 正式上线前检查

上线前请确认：
1. 页面源码里没有 `127.0.0.1`
2. 页面源码里没有示例 API 域名
3. `window.__LICENSE_API_BASE__` 已指向正式 API 域名
4. 正式 `/health` 为绿
5. 正式 `/ready` 为绿
6. 首页、激活页、反馈页都至少打开测试一次
