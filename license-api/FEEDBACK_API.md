# Feedback API 说明

## 当前已支持

### 用户提交评价
`POST /api/feedback`

支持两种模式：
- `full`，完整评价页提交
- `survey-gate`，首页单题轻拦截评价

---

## 评价数据表

使用表：
- `feedback_entries`

已包含字段：
- mode
- helpfulness
- tool_used
- value_focus
- main_issue
- wanted_features
- pricing_preference
- recommendation
- extra_comment
- question_key
- answer
- source_tool
- client_tag
- created_at

---

## 管理后台读取

### 管理员查看评价
`GET /api/admin/feedback`

需要：
- `Authorization: Bearer ADMIN_BEARER_TOKEN`

---

## 当前前端行为

### feedback.html
- 提交后先本地保存
- 再尝试提交到后端
- 即使后端失败，用户也不会卡住

### 首页轻拦截单题评价
- 先本地保存
- 再尝试提交到后端
- 如果提交失败，仍然允许继续进入工具

这种做法适合测试版阶段，用户体验更顺。
