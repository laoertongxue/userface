# 第 2 阶段手工验收清单

## 文档目的

这份文档用于验收【第 2 阶段：过早客 Connector 接入与双平台能力对齐】。

当前阶段目标是：

- 系统已支持 `V2EX` 与 `过早客`
- UI 已支持平台选择
- 但仍然只支持“一次一个平台、一个账号”的单平台分析

## 验收前置条件

### 1. 安装依赖

```bash
npm install
```

### 2. 启动项目

```bash
npm run dev
```

### 3. 打开页面

- 首页：`http://localhost:3000/`
- 分析页：`http://localhost:3000/analyze`

### 4. 确认本地环境已正常

- 首页可访问
- `/analyze` 可访问
- 页面可以在 `V2EX` 与 `过早客` 间切换
- 点击“开始分析”时按钮会进入禁用态

### 5. 确认 `/api/analyze` 可用

可通过浏览器页面直接验证，也可用一条最小请求确认：

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{
    "identity": {
      "accounts": [
        {
          "community": "v2ex",
          "handle": "<已确认存在的用户名>"
        }
      ]
    },
    "options": {
      "locale": "zh-CN"
    }
  }'
```

### 6. 环境变量说明

- 第 2 阶段手工验收不依赖额外环境变量
- 不需要数据库、缓存、认证或 LLM Key

## 验收范围

本阶段只覆盖：

- 单平台分析
- `V2EX`
- `过早客`
- 平台切换
- happy path
- not found
- warnings / degraded / partial result 观察点
- 前端 error 展示
- `npm run typecheck` / `npm test` / `npm run build` 回归

本阶段不覆盖：

- 多平台聚合
- 自动身份合并
- 微博
- LLM narrative
- 导出 / 分享
- 登录 / 授权

## 验收用例矩阵

### 1. V2EX happy path

步骤：

1. 打开 `/analyze`
2. 选择 `V2EX`
3. 输入一个你已经确认存在的 V2EX 用户名
4. 点击“开始分析”
5. 观察 loading
6. 等待结果返回

预期检查点：

- summary 可见
- tags 可见
- metrics 可见
- evidence 可见
- community breakdown 可见
- warnings 若为空，页面也应正常
- 页面未崩溃

### 2. 过早客 happy path

步骤：

1. 打开 `/analyze`
2. 选择 `过早客`
3. 输入一个你已经确认存在的过早客用户标识
4. 点击“开始分析”
5. 观察 loading
6. 等待结果返回

预期检查点：

- summary 可见
- tags 可见
- metrics 可见
- evidence 可见
- community breakdown 可见
- warnings 区域行为正确
- 页面未崩溃

### 3. 平台切换回归

步骤：

1. 先完成一次 `V2EX` 分析
2. 切换到 `过早客`
3. 输入过早客用户标识并再次分析
4. 再切回 `V2EX`
5. 再做一次分析

预期检查点：

- 请求中的 `community` 会随平台切换而变化
- 平台切换不会自动触发请求
- 平台切换会清空上一次结果和错误状态
- loading / success / error 状态切换合理
- 结果区能正确刷新

### 4. 空输入校验

步骤：

1. 选择任一平台
2. 输入空字符串或全空白
3. 点击“开始分析”

预期检查点：

- 前端阻止无意义提交
- 页面展示清晰的结构化错误提示
- 不应进入后端分析链路

### 5. 不存在用户

建议输入明显不存在的值，例如：

- `definitely_not_a_real_user_community_portrait_test`
- `definitely-not-a-real-user-community-portrait-test`

步骤：

1. 对 `V2EX` 测一次
2. 对 `过早客` 再测一次
3. 点击“开始分析”

预期检查点：

- 页面能展示结构化错误，或后端返回的明确 warning / not found 语义
- 不会只显示模糊的“请求失败”
- 页面不崩溃

### 6. warnings 展示

步骤：

1. 使用一个能自然触发 warnings 的账号，或采用本地可控条件触发局部失败
2. 发起分析
3. 观察 warnings 区域

预期检查点：

- warnings 区域单独展示
- 每条 warning 都有 `code` 和 `message`
- 能看出是哪个部分发生了降级

### 7. degraded / partial result 观察点

步骤：

1. 对至少一个平台尝试复现局部失败场景
2. 观察返回是否仍有 summary / evidence / breakdown

预期检查点：

- summary 仍可展示
- evidence 仍可展示
- warnings 明确
- 页面不崩

说明：

- 这条以“可复现则验证”为准
- 如果当轮验收无法稳定人工复现 partial result，请记录为 `N/A`
- 同时补充检查 `npm test` 已覆盖 connector 的 partial-result 路径

### 8. 构建与回归

执行：

```bash
npm run typecheck
npm test
npm run build
```

预期检查点：

- 三个命令均通过
- 说明第 2 阶段已形成可交付的回归基线

## 用例记录模板

可直接复制以下模板逐条填写：

```text
用例名称：
测试平台：
输入值：
结果：Pass / Fail / N/A
问题描述：
截图 / 日志位置：
```

## 验收通过标准

满足以下条件，可判定第 2 阶段手工验收通过：

- 两个平台的单平台分析都可跑通
- 平台切换正常
- happy path 正常
- not found / error / warnings 展示合理
- evidence 与 metrics 可见
- `npm run typecheck`、`npm test`、`npm run build` 全部通过
- 不需要查看后端源码，也能完成一轮人工验收
