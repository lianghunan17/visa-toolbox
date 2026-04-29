# 正式环境 API 注入说明

当前前端脚本已统一改为：
- 本地开发时允许自动使用 `http://127.0.0.1:8787`
- 非本地环境必须显式注入 `window.__LICENSE_API_BASE__`

这样做的目的：
- 防止正式环境误连本地地址
- 防止正式环境残留示例地址
- 让部署配置更明确、可检查

## 适用文件

当前会读取 `window.__LICENSE_API_BASE__` 的前端脚本有：
- `admin.js`
- `license-client.js`
- `mode-config.js`
- `feedback-api.js`

## 正式环境必须加的注入代码

在正式 HTML 页面里，在相关脚本前加入：

```html
<script>
  window.__LICENSE_API_BASE__ = 'https://你的-api-domain';
</script>
```

然后再加载业务脚本，例如：

```html
<script>
  window.__LICENSE_API_BASE__ = 'https://api.example.com';
</script>
<script src="./admin.js"></script>
```

## 当前本地开发示例

本地联调时可保持：

```html
<script>
  window.__LICENSE_API_BASE__ = 'http://127.0.0.1:8787';
</script>
```

## 正式部署检查点

上线前必须确认：
1. 页面源码里不再残留 `127.0.0.1`
2. 页面源码里不再残留示例域名
3. `window.__LICENSE_API_BASE__` 已指向正式 API 域名
4. 正式 API 的 `CORS_ORIGIN` 已允许正式前端域名

## 如果漏配会发生什么

现在漏配时，前端会直接报：

- `当前页面未配置后端 API 地址，请先注入 window.__LICENSE_API_BASE__。`

这是故意的，用来避免静默连错地址。
