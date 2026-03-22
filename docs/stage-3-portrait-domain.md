# 第 3 阶段画像域建模说明

## 本步目标

第 3 阶段第 1 步不追求“更聪明的画像效果”，而是先冻结画像域的核心口径，避免后续实现一边做特征提取、一边反复改标签、信号和 archetype 词表。

本步完成的事情：

- 冻结 `FeatureVector`
- 冻结 `Signal` 语言与 `SignalCode`
- 冻结 `EvidenceCandidate`
- 冻结 `PortraitTag` 与 `TagCode`
- 冻结 `ArchetypeCode`
- 将现有占位规则迁移到 `BaselinePortraitEngine`

## 当前画像域要解决的问题

当前系统已经具备：

- 双平台 connector
- 统一的 `ConnectorSnapshot`
- 统一的 `CanonicalActivity`
- 单平台分析 UI 和完整后端链路

当前缺少的是“稳定的画像中间层”。

如果现在直接开始写特征提取或分类规则，会马上遇到这些问题：

- 特征字段还没冻结
- 信号命名还没冻结
- 对外标签和内部信号容易混用
- archetype 口径会在实现中被反复改写

因此本步先冻结语言，再继续做引擎。

## 冻结的核心术语

### FeatureVector

`FeatureVector` 是画像引擎的结构化输入，不直接对前端暴露。

当前冻结为五组：

- `activity`
- `content`
- `topic`
- `community`
- `dataQuality`

它的作用是承接“活动流 -> 可分析特征”的中间层。

### Signal

`Signal` 是特征到标签 / archetype 之间的中间分析语言。

固定字段：

- `code`
- `score`
- `rationale`
- `supportingEvidenceIds`
- `communityScope`

Signal 不直接等于对外标签。

### EvidenceCandidate

`EvidenceCandidate` 是候选证据，不是最终 report evidence。

固定字段：

- `id`
- `activityId`
- `community`
- `labelHint`
- `excerpt`
- `activityUrl`
- `publishedAt`
- `reasons`
- `score?`

后续第 3 步会基于它做筛选和排序。

### PortraitTag

`PortraitTag` 是对外展示标签的内部定义。

固定字段：

- `code`
- `displayName`
- `summaryHint`
- `supportingSignalCodes`

Tag 是展示语言，Signal 是内部分析语言，两者不再混用。

### Archetype

`ArchetypeCode` 是画像原型词表。

本步只冻结 code，不在这里写复杂分类规则。

## 当前建议冻结的 code 集合

### SignalCode

- `DISCUSSION_HEAVY`
- `TOPIC_LED`
- `HIGH_OUTPUT`
- `LONG_FORM`
- `CROSS_COMMUNITY`
- `LOW_DATA`
- `QUESTION_ORIENTED`
- `FOCUSED_TOPICS`
- `DIVERSE_TOPICS`

### TagCode

- `DISCUSSION_HEAVY`
- `TOPIC_LED`
- `HIGH_OUTPUT`
- `LONG_FORM`
- `CROSS_COMMUNITY`
- `LOW_DATA`

### ArchetypeCode

- `INSUFFICIENT_DATA`
- `DISCUSSION_ORIENTED`
- `TOPIC_ORIENTED`
- `COMMUNITY_PARTICIPANT`
- `OBSERVER`
- `PROBLEM_SOLVER`
- `INFORMATION_CURATOR`

## 为什么先冻结口径，而不是直接写特征提取

原因很简单：第 2~4 步都会往画像域持续加代码。

如果现在不先冻结这些模型，后续会出现：

- 特征提取一步一个字段名
- evidence 选择自己发明一套 candidate 结构
- archetype 规则直接读取原始 activity
- tag 与 signal 混在一起

这会让第 3 阶段后半段变成持续返工。

因此，本步的优先级高于“先写更多规则”。

## 第 2~4 步将基于哪些模型继续实现

### 第 2 步：特征提取引擎

基于：

- `FeatureVector`

目标：

- 将活动流中的统计、文本、主题、社区分布和数据质量信息稳定写入 `FeatureVector`

### 第 3 步：证据选择与置信度模型

基于：

- `EvidenceCandidate`
- `Signal`

目标：

- 从候选证据中做筛选、排序和信号支持关系绑定

### 第 4 步：archetype / tag / 跨平台综合画像规则

基于：

- `FeatureVector`
- `Signal`
- `PortraitTag`
- `ArchetypeCode`

目标：

- 将当前 baseline 规则升级为更可解释的分类规则体系

## 当前实现位置

当前占位规则已从 `AnalyzeIdentityCluster` 中迁移到：

- `BaselinePortraitEngine`

这意味着：

- `AnalyzeIdentityCluster` 现在只负责 use case 编排
- 后续第 2~4 步的画像升级将主要发生在画像域内部，不需要继续把逻辑堆在一个 use case 文件里
