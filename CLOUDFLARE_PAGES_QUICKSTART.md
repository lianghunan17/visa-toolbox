# Cloudflare Pages 最短上线步骤

适用目录：`pr-app/`

## 方式 1，最快，直接上传

1. 打开 Cloudflare Dashboard
2. 进入 **Pages**
3. 点击 **Create a project**
4. 选择 **Direct Upload**
5. 把 `pr-app/` 目录里的全部文件上传
6. 等待部署完成

部署成功后，你会得到一个 `*.pages.dev` 地址。

---

## 方式 2，接 Git 仓库

如果你把 `pr-app/` 放进一个 Git 仓库：

### Cloudflare Pages 配置
- Production branch: 你的主分支（通常是 `main`）
- Framework preset: `None`
- Build command: 留空
- Build output directory: `pr-app`

如果仓库本身就是 `pr-app` 单独仓库，则输出目录可以填：

```txt
.
```

---

## 推荐访问路径

部署后可直接使用：
- `/` → 工具箱首页
- `/visa` → 在留审理时间预测
- `/pr` → 永驻申请判断

---

## 上线后立刻检查

1. 首页是否可打开
2. `/visa` 是否可打开
3. `/pr` 是否可打开
4. 数据是否能正常加载
5. 复制按钮是否正常
6. PDF 导出是否正常
7. 手机端是否正常显示

---

## 发布提醒

请保留页面中的免责声明，避免用户误解为官方或法律结论工具。
