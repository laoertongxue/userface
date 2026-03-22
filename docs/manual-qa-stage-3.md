# 第 3 阶段手工验收

## 文档目的

这是第 3 阶段的手工验收文档。

当前阶段目标是：画像引擎从占位规则升级为可解释规则体系。

当前仍不包含：

- 多平台聚合工作流
- LLM summary
- 微博 OAuth
- 正式产品级 UI

## 验收前置条件

1. 安装依赖：`npm install`
2. 启动开发环境：`npm run dev`
3. 打开页面：[http://localhost:3000/analyze](http://localhost:3000/analyze)
4. 可选地确认接口可用：
   - 浏览器发起一次页面分析
   - 或直接调用 `POST /api/analyze`
5. 当前阶段不依赖新增环境变量

## 验收范围

本阶段只覆盖：

- V2EX 单平台分析
- 过早客单平台分析
- `archetype / tags / summary / confidence / evidence / warnings / communityBreakdowns`
- `low-data / degraded` 的可见行为

本阶段不覆盖：

- 多平台聚合流程
- LLM
- 分享 / 导出
- 登录

## 验收用例矩阵

### 1. V2EX happy path

- 输入：选择 `v2ex`，输入一个真实存在的用户名
- 预期：
  - 能成功返回结果
  - `summary / tags / metrics / evidence / communityBreakdowns` 可见
  - 页面不崩溃
- 观察点：
  - `portrait.archetype` 是否存在
  - `portrait.tags` 是否存在
  - `evidence` 是否为 1~6 条合理证据
  - `warnings` 若为空，页面表现正常
- Pass / Fail：
  - Pass：以上区域都可见且结构完整
  - Fail：页面空白、字段缺失或结构断裂

### 2. 过早客 happy path

- 输入：选择 `guozaoke`，输入一个真实存在的用户标识
- 预期：
  - 能成功返回结果
  - `summary / tags / metrics / evidence / communityBreakdowns` 可见
  - 页面不崩溃
- 观察点：
  - `portrait.confidence` 是否存在
  - `warnings` 区域在无 warning 时是否正常
- Pass / Fail：
  - Pass：结构完整且可读
  - Fail：字段缺失或报错不可理解

### 3. low-data 场景观察

- 输入：选择任一平台，输入一个公开活动很少的账号
- 预期：
  - `archetype` 收敛到 low-data / insufficient-data 方向
  - `summary` 表达保守
  - `confidence` 较低
  - `LOW_DATA` 相关 tags 可见
- 观察点：
  - 是否仍有少量 `evidence`
  - 是否没有出现过度确定的结论
- Pass / Fail：
  - Pass：表达保守、结论收敛
  - Fail：低数据场景却给出高确定性画像

### 4. degraded / warnings 场景观察

- 输入：触发可复现 warning 的账号或环境
- 预期：
  - `warnings` 区域可见
  - `summary` 收敛
  - `confidence` 不应高于等价 clean 样本
- 观察点：
  - `warnings.code + warnings.message` 是否清晰
  - 页面是否仍然可展示 `evidence`
- Pass / Fail：
  - Pass：warnings 可见且结果不崩
  - Fail：warnings 被吞掉或页面失效

### 5. evidence 合理性观察

- 输入：任选一个活动较丰富的账号
- 预期：
  - `evidence` 不应是随机或重复内容
  - 证据条数保持小而稳定
  - `activityUrl` 可点击
- 观察点：
  - evidence 是否重复
  - evidence 是否明显来自同一条重复内容
- Pass / Fail：
  - Pass：证据具有代表性且不重复
  - Fail：重复证据明显或结构错误

### 6. archetype / tags / summary 一致性

- 输入：任选一个输出较明显的账号
- 预期：
  - `archetype` 与 tags 方向一致
  - `summary` 不应与 tags / archetype 自相矛盾
- 观察点：
  - 例如 topic-led 样本不应给出 discussion-heavy 风格 summary
- Pass / Fail：
  - Pass：三者方向基本一致
  - Fail：出现明显冲突

### 7. 平台切换不影响结果结构

- 输入：
  1. 分析一个 V2EX 账号
  2. 切换到过早客分析一个账号
  3. 再切回 V2EX
- 预期：
  - 请求能正常发起
  - `portrait / evidence / metrics / communityBreakdowns / warnings` 结构始终存在
- 观察点：
  - 结果区是否正确刷新
  - loading / success / error 是否切换正常
- Pass / Fail：
  - Pass：结构稳定
  - Fail：切换后结果结构断裂

### 8. typecheck / test / build 回归

- 执行：
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- 预期：
  - 三者全部通过
- Pass / Fail：
  - Pass：全部通过
  - Fail：任一失败

## 人工验收记录模板

- 用例名称：
- 测试平台：
- 输入：
- 结果：Pass / Fail
- 问题描述：
- 截图 / 日志位置：

## 验收通过标准

第 3 阶段手工验收通过，至少满足：

1. 两个平台单平台分析都可运行
2. `archetype / tags / confidence / evidence / warnings` 都能被观察
3. `low-data / degraded` 表达收敛
4. UI 不需要临时改代码就能完成一轮验收
5. `npm run typecheck / npm test / npm run build` 全部通过
