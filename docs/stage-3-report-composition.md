# 第 3 阶段报告组装说明

## 本步目标

第 3 阶段第 5 步只做一件事：

- 把规则引擎结果稳定映射为最终 `PortraitReport`

本步不改外部 API contract，不改 connector，不改 UI。

## ReportBuilder 的职责边界

`ReportBuilder` 是最终 `PortraitReport` 的唯一组装入口。

它负责：

1. `portrait` 组装
2. `metrics` 映射
3. `evidence` 映射
4. `communityBreakdowns` 映射
5. `warnings` 整理

它不负责：

- signal 推导
- tag 组合
- archetype 分类
- cross-community synthesis

这些都属于画像规则层，不能重新塞回 report 组装层。

## 各字段的来源优先级

### `portrait.archetype`

来源优先级：

1. `primaryArchetype.code`
2. 仅在内部结果缺失时，才允许走最小 fallback

### `portrait.tags`

来源优先级：

1. `TagCompositionService` 产出的 `PortraitTag[]`
2. 若为空，则最小回退到 `LOW_DATA`

对外仍输出 `string[]`，但内部事实源不再混用旧字符串标签。

### `portrait.summary`

来源优先级：

1. `primaryArchetype`
2. 前 2 个显著 tags
3. `stableTraits`
4. `confidence / degraded / low-data` 收敛提示

summary 只做简洁、规则化、克制的表达，不做 LLM 文案。

### `portrait.confidence`

来源优先级：

1. `ConfidenceProfile.overall`

本步不重新计算第二套 confidence。

### `evidence`

来源优先级：

1. `selectedEvidence`

映射规则：

- 稳定去重
- label 由 `activityType / reasons / labelHint` 做简化映射
- excerpt 做最小截断
- 保留 `activityUrl / community / publishedAt`

### `metrics`

来源优先级：

1. `FeatureVector`

当前保留前端兼容字段：

- `totalActivities`
- `topicCount`
- `replyCount`
- `avgTextLength`
- `activeDays`

### `communityBreakdowns`

来源优先级：

1. `CrossCommunitySynthesisService`
2. `FeatureVector.community.perCommunityMetrics`

单社区输入也必须产出最小可用 breakdown。

### `warnings`

来源优先级：

1. 上游 warnings 透传
2. report 层只做去重和组织展示

report 层不新增新的业务 warning 体系。

## 为什么本步不改外部 API contract

当前前端和 `/api/analyze` 已经依赖：

- `portrait`
- `evidence`
- `metrics`
- `communityBreakdowns`
- `warnings`

本步的目标是稳定这些字段的事实源，而不是重新设计 API。

## 为什么 ReportBuilder 不应承担规则分类职责

如果 `ReportBuilder` 再次推导 archetype、tags 或 signals，会导致：

- 规则来源重复
- report 结果与规则层结果可能冲突
- 后续回归难以定位问题

因此本步明确冻结职责：

- 规则层负责“判定”
- 组装层负责“映射”

## 第 6 步如何继续使用当前结构

第 6 步会围绕当前结构做：

1. 回归验证
2. 人工校验
3. 阶段复盘

重点检查：

- `portrait.archetype / tags / confidence` 是否稳定
- `evidence` 是否来自正确的 `selectedEvidence`
- `communityBreakdowns` 是否与 community synthesis 一致
- `/api/analyze` 外部输出是否保持兼容
