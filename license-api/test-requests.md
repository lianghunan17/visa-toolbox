# 本地测试请求示例

先启动后端：

```bash
cd pr-app/license-api
npm install
cp .env.example .env
npm run dev
```

假设你的 `.env` 里有：

```txt
ADMIN_BEARER_TOKEN=replace-with-your-secret
```

---

## 1. 健康检查

```bash
curl http://127.0.0.1:8787/health
```

---

## 2. 创建一个测试授权

```bash
curl -X POST http://127.0.0.1:8787/api/admin/licenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer replace-with-your-secret" \
  -d '{
    "customerEmail": "test@example.com",
    "customerName": "测试用户",
    "orderId": "ORDER-001",
    "productName": "签证工具箱"
  }'
```

返回里会有：
- `license.id`
- `license.license_key`

---

## 3. 激活授权

把下面的 `VT-XXXX` 替换成上一步生成的激活码：

```bash
curl -X POST http://127.0.0.1:8787/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "licenseKey": "VT-XXXX",
    "deviceId": "device-test-001",
    "deviceName": "Local Chrome Test"
  }'
```

返回里会有：
- `authToken`

---

## 4. 验证授权

把下面的 `AUTH_TOKEN` 替换成上一步拿到的 token：

```bash
curl -X POST http://127.0.0.1:8787/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{
    "authToken": "AUTH_TOKEN",
    "deviceId": "device-test-001",
    "toolName": "visa-processing-time-tool"
  }'
```

---

## 5. 查看授权列表

```bash
curl http://127.0.0.1:8787/api/admin/licenses \
  -H "Authorization: Bearer replace-with-your-secret"
```

---

## 6. 停用授权

把下面的 `LICENSE_ID` 替换成授权 id：

```bash
curl -X POST http://127.0.0.1:8787/api/admin/licenses/LICENSE_ID/disable \
  -H "Authorization: Bearer replace-with-your-secret"
```

---

## 7. 重置设备绑定

```bash
curl -X POST http://127.0.0.1:8787/api/admin/licenses/LICENSE_ID/reset-device \
  -H "Authorization: Bearer replace-with-your-secret"
```
