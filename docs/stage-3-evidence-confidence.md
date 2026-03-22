# 第 3 阶段证据选择与置信度说明

## 本步目标

第 3 阶段第 3 步的目标是补齐两层中间能力：

- `EvidenceSelectionService`
- `ConfidenceScoringService`

它们解决的问题分别是：

- 哪些 activities 更适合作为“代表性证据”进入 report
- 当前画像结论的基础是否足够强，应该给出多高的 confidence

本步不做：

- archetype 分类升级
- tag composition 规则系统
- cross-community synthesis 规则系统
- LLM narrative confidence

## EvidenceSelectionService 的职责

`EvidenceSelectionService` 负责：

1. 从 `CanonicalActivity[]` 生成 `EvidenceCandidate`
2. 对候选做稳定去重
3. 在不依赖平台细节的前提下，按代表性和多样性选出 `selected`

### 第一版 evidence ranking 规则

评分因子：

- text richness：文本长度越高，分数越高，但上限封顶
- substantive content：达到最小正文阈值后明显加分
- node/topic context：有 `nodeName` / `topicTitle` 时轻微加分
- URL / publishedAt presence：有可追溯链接和时间时轻微加分
- recency soft bonus：最近活动有小幅加成，但不足以垄断结果

### 第一版 dedupe 规则

按以下顺序做稳定去重：

1. `activityId` 相同
2. `excerpt` 归一化后完全相同
3. `activityUrl + normalizedText` 相同

### 第一版 diversity 规则

在数据允许时，最终 selected 会优先兼顾：

- `topic` / `reply` 两类 activity
- 不同 community 的覆盖

默认上限：

- `MAX_SELECTED_EVIDENCE = 5`

## ConfidenceScoringService 的职责

`ConfidenceScoringService` 负责根据特征和证据覆盖情况，生成内部 `ConfidenceProfile`。

输出包括：

- `overall`
- `dataVolume`
- `activitySpan`
- `textQuality`
- `sourceQuality`
- `coverage`
- `flags`
- `reasons`

它不是“真实准确率预测”，而是一个稳定、可解释的置信度近似模型。

## 第一版置信度维度与公式

### 维度

- `dataVolume`
- `activitySpan`
- `textQuality`
- `sourceQuality`
- `coverage`

### 权重

- `dataVolume = 0.26`
- `activitySpan = 0.18`
- `textQuality = 0.22`
- `sourceQuality = 0.18`
- `coverage = 0.16`

### penalty / bonus

- `DEGRADED_PENALTY = 0.18`
- `LOW_TEXT_DENSITY_PENALTY = 0.12`
- `LOW_EVIDENCE_COVERAGE_PENALTY = 0.10`
- `CROSS_COMMUNITY_STRONGER_BASIS_BONUS = 0.04`

### 第一版 flags

- `LOW_ACTIVITY_VOLUME`
- `LOW_ACTIVE_DAYS`
- `LOW_TEXT_DENSITY`
- `LOW_EVIDENCE_COVERAGE`
- `DEGRADED_SOURCE`
- `CROSS_COMMUNITY_STRONGER_BASIS`

## 当前不做的内容

当前明确不做：

- tag-specific evidence binding
- archetype-specific confidence
- LLM narrative confidence
- 复杂语义相似去重
- NLP 关键词抽取

原因很简单：这些都属于第 4 步之后的规则层或表达层，不应该反向污染当前的基础口径。

## 第 4 步将如何继续使用这些模型

第 4 步会直接消费：

- `selectedEvidence`
- `ConfidenceProfile`
- `Signal`
- `Tag`
- `Archetype`

具体方向：

- 用 `selectedEvidence` 绑定更具体的 tags / archetype supporting evidence
- 用 `ConfidenceProfile` 调整最终 archetype / tag 的输出强度
- 在不改外部 contract 的前提下，让 `portrait.confidence` 不再只是占位值
