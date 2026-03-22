# 第 3 阶段规则分类层说明

## 本步目标

第 3 阶段第 4 步只做规则分类层，不改 report 外部结构。

本步补齐四个内部服务：

- `SignalDerivationService`
- `TagCompositionService`
- `ArchetypeClassificationService`
- `CrossCommunitySynthesisService`

它们共同解决的问题是：

- 如何从 `FeatureVector + selectedEvidence + ConfidenceProfile` 产出稳定的 `Signal[]`
- 如何把内部 signals 收敛成可展示的 `PortraitTag[]`
- 如何用可解释规则选出一个 `primary archetype`
- 如何在多社区输入下区分 `stable traits` 与 `community-specific traits`

## SignalDerivationService

职责：

1. 从结构化特征推导少量、稳定、可解释的内部 signal
2. 给每个 signal 附上 `score / rationale / supportingEvidenceIds`
3. 保持 signal 词表小而稳

第一版 signal 规则覆盖：

- `DISCUSSION_HEAVY`
- `TOPIC_LED`
- `HIGH_OUTPUT`
- `LONG_FORM`
- `CROSS_COMMUNITY`
- `LOW_DATA`
- `QUESTION_ORIENTED`
- `FOCUSED_TOPICS`
- `DIVERSE_TOPICS`

关键阈值：

- `MIN_ACTIVITY_FOR_STRONG_SIGNAL = 8`
- `DISCUSSION_HEAVY_REPLY_RATIO = 0.65`
- `TOPIC_LED_TOPIC_RATIO = 0.55`
- `HIGH_OUTPUT_TOTAL_ACTIVITIES = 20`
- `LONG_FORM_RATIO_THRESHOLD = 0.35`
- `QUESTION_RATIO_THRESHOLD = 0.25`
- `FOCUSED_TOPIC_CONCENTRATION = 0.55`
- `DIVERSE_TOPIC_SCORE = 0.30`
- `CROSS_COMMUNITY_MIN_COUNT = 2`

## TagCompositionService

职责：

1. 仅把足够强的 signals 组合成对外稳定的 tags
2. 控制 tag 数量，避免 low-data 场景过度下结论
3. 处理互斥或近互斥标签，例如 `FOCUSED_TOPICS` 与 `DIVERSE_TOPICS`

第一版规则：

- `MIN_SIGNAL_SCORE_FOR_TAG = 0.55`
- 高 confidence 最多 `5` 个 tags
- 低 confidence 最多 `3` 个 tags
- `LOW_DATA` 强时必须出现，并收敛其他 tags
- `FOCUSED_TOPICS` 与 `DIVERSE_TOPICS` 默认只保留分数更强的一方

## ArchetypeClassificationService

职责：

1. 基于 `signals + tags + confidence` 选出一个 `primary archetype`
2. 规则必须可回溯，不能是黑箱分数
3. 采用 “高优先级兜底 + 候选评分 + 固定优先级” 结构

第一版 archetype 集合：

- `INSUFFICIENT_DATA`
- `DISCUSSION_ORIENTED`
- `TOPIC_ORIENTED`
- `COMMUNITY_PARTICIPANT`
- `OBSERVER`
- `PROBLEM_SOLVER`
- `INFORMATION_CURATOR`

判定边界：

- `INSUFFICIENT_DATA` 优先级最高之一，用于抑制低数据误判
- `PROBLEM_SOLVER` 需要 reply-heavy + substantive text
- `INFORMATION_CURATOR` 需要 topic-led + long-form 或 link-heavy
- `DISCUSSION_ORIENTED` 强调 reply-led
- `TOPIC_ORIENTED` 强调 topic-led
- `COMMUNITY_PARTICIPANT` 强调稳定参与且 reply/topic 不过度单边
- `OBSERVER` 只在不是 insufficient-data 的前提下兜底使用

## CrossCommunitySynthesisService

职责：

1. 单社区输入时提供最小可用的 `stableTraits + communityInsights`
2. 多社区输入时区分：
   - 全局稳定 traits
   - 社区侧 dominant traits

第一版规则：

- 单社区：`stableTraits` 近似等于全局 tags
- 多社区：优先保留高分 global tags 作为 `stableTraits`
- `communityInsights` 基于 `perCommunityMetrics` 做稳健差异判断：
  - reply-led
  - topic-led
  - long-form
  - question-oriented
  - high-output

这一步只做稳健差异，不做复杂“人格切换式”叙事。

## 当前不做的内容

当前明确不做：

- LLM narrative
- report 外观升级
- golden cases / regression baseline 库
- tag-specific evidence binding 图
- archetype-specific confidence 细化

这些都属于后续步骤，当前规则层只负责给第 5 步提供稳定输入。

## 第 5 步如何继续使用这些结果

第 5 步会直接消费：

- `primaryArchetype`
- `tags`
- `community synthesis result`

用途：

- 让 `portrait.summary` 更稳定、更面向展示
- 让 `communityBreakdowns` 的 summary / tags 更一致
- 在不改外部 contract 的前提下升级 report composition
