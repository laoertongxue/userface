# 第 3 阶段黄金样本说明

本文件记录第 3 阶段画像引擎的黄金样本。它们全部基于标准化后的输入构造：

- `CanonicalActivity[]`
- `ConnectorSnapshot[]`
- `ActivityStream`

不依赖真实网络请求，也不依赖 live connector。

## 1. discussion-heavy-single-community

- 目的：验证 reply-heavy 单社区样本的 discussion-heavy 方向画像
- 关键特征：
  - `replyRatio` 高
  - `activeDays` 足够
  - 文本质量不低，但不刻意强化 problem-solver
- 预期边界：
  - archetype 应落在 discussion-oriented 方向
  - 必须出现 `DISCUSSION_HEAVY`
  - 不应以 `LOW_DATA` 为主标签
  - evidence 以 reply 为主但不应失控

## 2. topic-led-output-heavy-single-community

- 目的：验证 topic-led 且 output-heavy 的输出型样本
- 关键特征：
  - `topicRatio` 高
  - `totalActivities` 高
  - 存在 long-form / link-heavy 内容
- 预期边界：
  - archetype 应落在 `TOPIC_ORIENTED` 或 `INFORMATION_CURATOR`
  - 必须出现 `TOPIC_LED`
  - 应出现 `HIGH_OUTPUT`

## 3. low-data-insufficient

- 目的：验证 low-data / insufficient-data 兜底
- 关键特征：
  - 活动量低
  - 活跃天数低
  - 文本密度低
- 预期边界：
  - archetype = `INSUFFICIENT_DATA`
  - `LOW_DATA` 必须出现
  - confidence 应明显偏低
  - summary 应保守

## 4. long-form-substantive

- 目的：验证 long-form 与 substantive text 的特征链条
- 关键特征：
  - `avgTextLength` 高
  - `longFormRatio` 高
  - `evidenceDensity` 高
- 预期边界：
  - tags 应包含 `LONG_FORM`
  - confidence 不应偏低
  - evidence 应优先选择长文本代表内容

## 5. cross-community-balanced

- 目的：验证 cross-community 信号与 community synthesis
- 关键特征：
  - 至少 2 个 community
  - 各社区活动分布存在差异
- 预期边界：
  - tags 可出现 `CROSS_COMMUNITY`
  - synthesis 结果中应有 stable traits
  - communityBreakdowns 不应完全相同

## 6. degraded-source-partial-result

- 目的：验证 degraded / partial-result 对 confidence 和 summary 的影响
- 关键特征：
  - `degraded = true`
  - warnings 非空
  - 数据量不一定低，但来源质量下降
- 预期边界：
  - confidence 低于等价 clean 样本
  - summary 应收敛
  - warnings 必须保留
  - 不应误判为高确定性画像
