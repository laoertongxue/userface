# 第 2 阶段架构复盘

## A. 阶段目标回顾

### 原始目标

- 在不改变 `/api/analyze` 外部 contract 的前提下，把系统从 `V2EX` 单平台扩展到 `V2EX + 过早客`
- 两个平台都能走完“采集 -> 规范化 -> 画像 -> 展示”的单平台链路
- connector 需要具备最小降级能力和可回归测试保护

### 实际完成

- `CommunityConnector` contract 同时承载了：
  - `V2EX`：公开 JSON + HTML 混合接入
  - `过早客`：纯 DOM 列表页接入
- `StaticConnectorRegistry` 已注册 `V2EX`、`过早客`、`微博 OAuth 占位 connector`
- `/api/analyze` 已能接受 `community='v2ex'` 与 `community='guozaoke'`
- `/analyze` 页面已支持平台选择，但一次仍只提交一个平台和一个账号
- 两个平台都已有：
  - real connector
  - partial result / warning / diagnostics 语义
  - fixtures
  - parser / mapper / connector tests

### 明确不在本阶段范围内

- 多平台聚合画像
- 自动身份合并
- LLM narrative
- 微博 OAuth 实接
- 正式产品级 UI
- 生产治理体系

## B. 当前架构被验证成立的部分

### 1. Connector 抽象成立

当前代码已经验证：同一个 `CommunityConnector` contract 可以同时承载两类不同来源。

- `V2EX` 通过 profile JSON + replies/topics HTML 组合接入
- `过早客` 通过公开用户页 + replies/topics DOM 页面接入
- 两者最终都回到统一的 `ConnectorSnapshot`

这说明 `source-acquisition` 作为反腐层的边界是成立的，后续画像层不需要知道数据来自 JSON 还是 DOM。

### 2. CanonicalActivity 足够承载双平台

当前双平台共同验证过的基础字段是：

- `id`
- `community`
- `handle`
- `type`
- `url`
- `topicTitle`
- `nodeName`
- `contentText`
- `excerpt`
- `publishedAt`
- `sourceTrace`

当前判断：

- `topic` / `reply` 两种活动类型足够覆盖双平台当前接入范围
- `nodeName`、`stats.replyCount` 属于平台可选字段
- `publishedAt` 在两平台都可输出，但可靠度并不完全一致

结论：`CanonicalActivity` 的基础字段集已经足够支撑第 3 阶段，不需要在进入画像升级前再重开结构讨论。

### 3. ConnectorSnapshot / warnings / diagnostics 足够实用

当前 `ConnectorSnapshot = profile + activities + diagnostics + warnings` 这套结构，已经被双平台共同验证。

已证明必要的 warning code：

- `NOT_FOUND`
- `PARTIAL_RESULT`
- `SELECTOR_CHANGED`
- `RATE_LIMITED`
- `UNSUPPORTED`（用于未实现平台或保留 connector）

已证明实用的 diagnostics 字段：

- `fetchedPages`
- `fetchedItems`
- `elapsedMs`
- `degraded`
- `usedRoutes`

结论：这套快照结构已经足够支撑下一阶段的画像输入，不建议在第 3 阶段前继续扩大。

### 4. portrait-analysis 已基本与平台解耦

当前画像链路只消费：

- canonical activity stream
- snapshot warnings
- snapshot-level community breakdown

它并不知道：

- 页面来自 V2EX 还是过早客
- 数据来自 JSON 还是 DOM
- selector 是什么

这说明平台无关边界基本成立。

但仍有两个现实问题：

- 当前规则仍然非常基础，更像“活动量统计 + 简单标签”，还不能称为成熟画像引擎
- 零活动 fallback 文案仍带有“connector scaffolded / live fetching not implemented”这类阶段 1 残留表述，已经与当前事实不一致

## C. 第 2 阶段暴露出的真实问题

| 问题 | 现象 | 影响 | 是否阻塞第 3 阶段 | 建议处理时机 |
| --- | --- | --- | --- | --- |
| DOM 型站点天然不稳定 | 过早客完全依赖 DOM 结构，selector 变化会直接影响解析 | connector 维护成本高，线上波动更大 | 不阻塞 | 持续在 source-acquisition 处理 |
| selector drift 风险持续存在 | 已有 drift 防护，但本质上只能“发现变化”，不能消除变化 | 会导致 partial result 或 warnings 增多 | 不阻塞 | 第 3 阶段期间只修 bug，不重开架构 |
| profile 字段缺失是常态 | 双平台 profile 字段丰富度不同，部分字段经常缺失 | 画像层不能强依赖 displayName、bio、registeredAt、stats | 不阻塞 | 进入第 3 阶段前作为规则前提固定下来 |
| publishedAt 规范化仍有启发式成分 | 尤其是过早客 reply 时间，部分场景需要用 `fetchedAt` 兜底 | activeDays、时间分布等指标存在误差 | 部分阻塞：仅阻塞“强时间语义”规则 | 第 3 阶段早期先限制时间类规则的权重 |
| evidence 质量受平台信息密度影响 | 列表页信息少的平台，evidence 更弱 | 摘要可读性和可解释性不一致 | 不阻塞 | 第 3 阶段优化 evidence 选择策略 |
| 当前画像规则更偏“通用计数”，并不是真正的平台无偏画像 | 现有 tags 主要来自 topic/reply 比例、活动量、文本长度 | 双平台都能跑，但结论深度有限 | 不阻塞，但这是第 3 阶段核心任务 | 第 3 阶段主攻 |
| warning 粒度仍偏粗 | `PARTIAL_RESULT` 很实用，但对上层来说仍然偏聚合 | 排障时还需要结合 message 判断具体失败段 | 不阻塞 | 只在确有排障痛点时细化 |
| 当前 UI 只适合内部验收 | 页面已能切换平台，但仍是验证面板，不是正式产品交互 | 适合开发和 QA，不适合外部发布 | 不阻塞 | 延后到产品化阶段 |
| 零活动 fallback 文案过时 | 当前文案还在说 connector scaffolded/live fetching not implemented | 会误导验收和演示 | 不阻塞功能，但会影响认知 | 第 3 阶段开头顺手修正 |

## D. 第 3 阶段前建议冻结的内容

### 建议冻结

#### 1. `CanonicalActivity` 基础字段集

建议冻结为：

- `id`
- `community`
- `handle`
- `type`
- `url`
- `topicTitle`
- `nodeName`
- `contentText`
- `excerpt`
- `publishedAt`
- `stats?`
- `sourceTrace`

理由：

- 双平台都已在这个集合内落地
- 第 3 阶段画像规则不应再次倒逼 acquisition 改 envelope

#### 2. `ConnectorSnapshot` 基础结构

建议冻结为：

- `profile`
- `activities`
- `diagnostics`
- `warnings`

理由：

- V2EX 与过早客都已证明这四块足够表达成功、降级、失败和回溯信息

#### 3. warning code 基础集合

建议冻结现有基础集合：

- `NOT_FOUND`
- `PARTIAL_RESULT`
- `TOPICS_HIDDEN`
- `LOGIN_REQUIRED`
- `RATE_LIMITED`
- `SELECTOR_CHANGED`
- `UNSUPPORTED`

理由：

- 这些 code 已覆盖当前已知来源与保留平台
- 上层页面和报告层已经按这套语义消费

#### 4. diagnostics 核心字段

建议冻结：

- `fetchedPages`
- `fetchedItems`
- `elapsedMs`
- `degraded`
- `usedRoutes`

理由：

- 双平台 tests 已覆盖这些语义
- 这些字段足够支撑 QA、排障和后续画像调试

#### 5. `sourceTrace` 最小要求

建议冻结：

- `route`
- `fetchedAt`
- `contentHash`

理由：

- 这已经足够做去重、溯源和定位来源页面

#### 6. profile 的“软字段”约束

建议明确冻结以下结论：

- `displayName`、`avatarUrl`、`bio`、`homepageUrl`、`registeredAt`、`stats.*` 都是可选字段
- 画像规则不得把这些字段当成硬依赖

理由：

- 双平台 profile 丰富度不同
- DOM 型平台更容易缺字段

### 暂不建议冻结

#### 1. 时间归一化细节

不建议冻结 `publishedAt` 的具体解析启发式。

理由：

- V2EX 和过早客的时间文本差异很大
- 过早客 reply 时间目前仍有兜底逻辑
- 第 3 阶段若需要更强时间语义，可能仍要微调 mapper

#### 2. analyze request 的“多账号语义”

不建议现在把 request schema 收窄到单账号。

理由：

- 当前 UI 只提交一个账号
- 但 `identity.accounts[]` 的数组 envelope 已经是为后续聚合预留的
- 现在收窄会给第 4 阶段带来无意义回改

## E. 第 3 阶段的输入条件

进入第 3 阶段前，当前系统已经具备：

- 两个平台均已接入
- `/api/analyze` 输出 contract 已统一
- `/analyze` 可手工触发两个平台的单平台分析
- connector 已具备最小降级能力
- V2EX 与过早客都已有测试保护网

第 3 阶段最应该关注：

- 规则画像从“活动计数 + 简单标签”升级为更可信的信号体系
- evidence 选择与排序
- 双平台时间与文本差异对指标的影响
- 零活动 / 低活动 / partial-result 情况下的画像解释

第 3 阶段不应该再被这些问题反复打断：

- connector 基础接口是否成立
- `ConnectorSnapshot` 结构要不要改
- `CanonicalActivity` 基础字段要不要重开
- UI 是否能触发单平台分析

## F. 非目标与延期项

| 项目 | 当前不做的原因 |
| --- | --- |
| 多平台聚合画像 | 需要身份聚类和跨平台规则，不是第 2 阶段目标 |
| 自动身份合并 | 当前只验证单平台链路，避免过早引入误合并问题 |
| LLM narrative | 当前规则画像尚未稳定，先冻结结构再上自然语言层 |
| 微博 OAuth | 认证、权限和数据来源复杂度明显更高，应单独阶段处理 |
| 正式产品级 UI | 当前页面仅用于内部验收与调试 |
| 生产治理体系 | 限流、告警、缓存、观测平台不应与第 2 阶段耦合推进 |

## G. 最终结论

- 第 2 阶段已经达到阶段目标：`V2EX + 过早客` 的双平台单平台分析能力已成立
- 当前可以进入第 3 阶段
- 前提是：第 3 阶段默认冻结 connector contract、snapshot structure、warning code 基础集合和 diagnostics 核心字段
- 当前最大非阻塞问题不是 acquisition 还能不能跑，而是画像规则仍然过于基础，且部分零活动文案已经过时

结论：可以进入第 3 阶段，但不建议在第 3 阶段再反复重开 source-acquisition 的基础结构讨论，除非出现明确 bug。
