# Lemon Squeezy webhook 接入说明

## 1. 当前已支持的 webhook 入口

后端已预留：

`POST /api/webhooks/lemonsqueezy`

用途：
- 接收 Lemon Squeezy 支付成功后的订单事件
- 自动创建一条授权记录
- 自动生成激活码

---

## 2. 环境变量

需要配置：

```txt
LEMON_SQUEEZY_WEBHOOK_SECRET=
```

这个值来自 Lemon Squeezy webhook 配置页。

---

## 3. 当前处理逻辑

收到 webhook 后，后端会：

1. 校验 `x-signature`
2. 解析订单数据
3. 读取：
   - `order_id`
   - `customer_email`
   - `customer_name`
   - `product_name`
4. 检查这个订单号是否已经创建过授权
5. 如果没有，就自动创建授权
6. 自动生成 `VT-XXXX-XXXX-XXXX` 格式激活码
7. 写入 `licenses` 和 `license_events`

---

## 4. 当前阶段的定位

当前已经完成的是：
- 自动落授权记录
- 自动生成激活码
- 防止同订单重复建码

当前还没自动做的是：
- 自动发激活邮件
- 自动展示订单成功页里的激活码
- 用户自助查看订单授权

这些可以放下一阶段。

---

## 5. 推荐你在 Lemon Squeezy 后台怎么配

### 商品设置
- 商品：签证工具箱
- 价格：一次买断
- 不做订阅

### webhook 配置
URL 填：

```txt
https://你的-api-域名/api/webhooks/lemonsqueezy
```

勾选与订单成功相关的事件。

---

## 6. 当前最稳的上线方式

第一阶段：
- 用户下单
- webhook 自动建授权
- 你从后台看到激活码
- 再把激活码发给用户，或者在管理后台查给他

第二阶段：
- 自动邮件
- 自动订单成功页提示激活流程

这样最稳，不容易一开始就把自动化链路做炸。
