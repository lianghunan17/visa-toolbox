# 后台页面部署说明

当前后台入口分为两个：

## 1. 本地联调入口

- `admin.local.html`

用途：
- 仅用于本地开发
- 已自动注入本地 API：`http://127.0.0.1:8787`

本地访问：

```txt
http://127.0.0.1:8000/admin.local.html
```

## 2. 正式部署入口

- `admin.html`

用途：
- 用于正式环境
- 不再默认写死任何 API 地址
- 必须显式注入 `window.__LICENSE_API_BASE__`

正式部署时，必须在加载 `admin.js` 前加入：

```html
<script>
  window.__LICENSE_API_BASE__ = 'https://你的-api-domain';
</script>
```

如果漏配，后台会直接提示：

- `当前页面未配置后端 API 地址，请先注入 window.__LICENSE_API_BASE__。`

## 3. 部署建议

- `admin.html` 不建议从公开首页直接暴露入口
- 管理后台只给自己或内部使用
- 正式环境下确保 API 域名、CORS、管理员 token 都已配置正确

## 4. 上线前检查

1. `admin.local.html` 不用于正式公开
2. `admin.html` 已注入正式 API 域名
3. 正式 `/health` 为绿
4. 正式 `/ready` 为绿
5. 后台诊断面板显示正常
