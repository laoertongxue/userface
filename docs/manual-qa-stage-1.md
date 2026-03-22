# 第 1 阶段手工验收清单

## 验收目标

第 1 阶段通过的定义是：

- 本地可以启动 Next.js 应用
- 可以在浏览器中打开 `/analyze`
- 可以输入一个真实的 V2EX 用户名并发起分析
- 页面能清晰展示 loading、成功态、失败态
- 成功返回后能看到 portrait summary、metrics、evidence、community breakdowns、warnings
- 不需要查看后端日志，也能完成一轮基础人工验收

## 启动方式

1. 在项目根目录安装依赖：

```bash
npm install
```

2. 启动本地开发服务：

```bash
npm run dev
```

3. 打开浏览器访问：

- 首页：`http://localhost:3000/`
- 分析页：`http://localhost:3000/analyze`

## Happy Path 验收步骤

建议先使用一个真实存在的 V2EX 用户名，例如 `Livid`。

1. 打开 `/analyze`
2. 在输入框中填入一个真实存在的 V2EX 用户名
3. 点击“开始分析”
4. 观察页面进入 loading 状态，按钮变为禁用
5. 等待请求完成
6. 核对页面是否展示以下内容：
   - Portrait Summary
   - Tags
   - Metrics
   - Evidence
   - Community Breakdowns
   - Warnings（如果后端返回）
7. 点击 evidence 中的活动链接，确认链接可打开

## 异常路径验收步骤

### 1. 空用户名

1. 清空输入框
2. 点击“开始分析”
3. 预期：
   - 页面不会提交请求
   - 页面展示结构化错误
   - error code 为 `INVALID_INPUT`

### 2. 不存在的用户名

可使用类似 `definitely_not_a_real_user_community_portrait_test` 的值。

1. 输入一个明显不存在的用户名
2. 点击“开始分析”
3. 预期：
   - 页面进入 loading
   - 最终展示错误或后端返回的结构化失败结果
   - 不会静默无反馈

### 3. 接口级失败展示

可以通过浏览器 DevTools 的 `Network -> Offline` 模式模拟。

1. 打开 DevTools
2. 切换到离线模式
3. 再次点击“开始分析”
4. 预期：
   - 页面展示错误区
   - 能看到明确的 error code 和 error message
   - 不会只显示模糊的“请求失败”

## 降级路径观察点

当后端返回 warnings 或 partial result 时，重点观察：

1. Warnings 区域是否单独显示
2. warnings 是否包含 code 和 message
3. 即使存在 warnings，Evidence 是否仍可见
4. 即使存在 warnings，Community Breakdowns 是否仍可见
5. 页面是否仍然保持可读，不需要查看控制台才能理解结果

## 验收通过标准

满足以下条件即可认为第 1 阶段前端演示闭环通过：

- 页面可访问
- 可以提交用户名
- 有清晰的 loading 状态
- 有成功态
- 有失败态
- warnings 可见
- evidence 可见
- community breakdown 可见
- 不依赖后端日志，也能完成一轮人工验收
