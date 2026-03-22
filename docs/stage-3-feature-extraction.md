# 第 3 阶段特征提取说明

## 本步目标

第 3 阶段第 2 步的目标是把 `ActivityStream` 稳定提炼成 `FeatureVector`，让后续证据选择、置信度和 archetype 规则都建立在统一特征层上，而不是继续直接读取原始 activities。

本步完成的事情：

- 新增 `FeatureExtractionPolicy`
- 新增 `FeatureExtractionService`
- 将 `ActivityStream` 转换为结构化 `FeatureVector`
- 在 `AnalyzeIdentityCluster` 中先抽特征，再调用 `BaselinePortraitEngine`

本步没有做：

- evidence ranking
- confidence scoring
- archetype 分类升级
- tag composition 规则升级
- NLP 关键词抽取

## FeatureVector 结构概览

`FeatureVector` 当前分为五组：

- `activity`
- `content`
- `topic`
- `community`
- `dataQuality`

### activity

用于描述活动规模、节奏和时间跨度：

- `totalActivities`
- `topicCount`
- `replyCount`
- `topicRatio`
- `replyRatio`
- `activeDays`
- `activeSpanDays`
- `avgActivitiesPerActiveDay`
- `firstActivityAt`
- `lastActivityAt`
- `activeCommunities`
- `activeCommunityCount`

### content

用于描述文本量级和基础表达形态：

- `avgTextLength`
- `nonEmptyContentRatio`
- `longFormRatio`
- `questionRatio`
- `linkRatio`
- `substantiveTextRatio`

### topic

用于描述节点覆盖和主题集中度：

- `dominantTopics`
- `dominantNodes`
- `uniqueNodeCount`
- `topicConcentration`
- `diversityScore`
- `nodeCoverageRatio`

### community

用于描述跨社区分布和社区切片：

- `communityActivityShare`
- `perCommunityMetrics`
- `crossCommunity`

### dataQuality

用于描述数据是否足够支撑后续画像规则：

- `degraded`
- `evidenceDensity`
- `sufficientData`
- `qualityFlags`

## 第一版冻结的公式与阈值

固定阈值：

- `LONG_FORM_THRESHOLD_CHARS = 200`
- `SUBSTANTIVE_TEXT_THRESHOLD_CHARS = 20`
- `SUFFICIENT_DATA_MIN_ACTIVITIES = 8`
- `SUFFICIENT_DATA_MIN_ACTIVE_DAYS = 3`
- `SUFFICIENT_DATA_MIN_EVIDENCE_DENSITY = 0.5`
- `DOMINANT_NODE_LIMIT = 5`

### 文本归一化

第一版只做最小处理：

- `trim`
- 连续空白压缩为单个空格

不做：

- HTML 清洗
- markdown 解析
- 中文分词
- NLP 摘要

### 问句识别

第一版规则：

- 文本包含 `?` 或 `？`

### 链接识别

第一版规则：

- 文本包含 `http://`
- 或 `https://`
- 或 `www.`

### 时间口径

- 优先使用 `publishedAt`
- 若 `publishedAt` 不可解析，则回退到 `sourceTrace.fetchedAt`
- `activeDays` 和 `activeSpanDays` 统一按 UTC 日粒度计算

### sufficientData

第一版规则：

只有同时满足以下条件时才为 `true`：

- `totalActivities >= 8`
- `activeDays >= 3`
- `evidenceDensity >= 0.5`

### qualityFlags

第一版规则：

- `LOW_ACTIVITY_VOLUME`: `totalActivities < 8`
- `LOW_ACTIVE_DAYS`: `activeDays < 3`
- `LOW_TEXT_DENSITY`: `evidenceDensity < 0.5`
- `DEGRADED_SOURCE`: 上游 snapshot 标记为 degraded 或带 warnings

## 为什么当前不做更复杂的特征

当前先不做以下内容，是为了保持规则口径稳定：

- evidence ranking：这属于第 3 步
- NLP 关键词抽取：当前 connector 提供的是列表页文本，不适合现在引入复杂文本管线
- archetype 分类：这属于第 4 步

如果现在同时推进这些内容，会再次把“特征层”和“规则层”混在一起。

## 第 3~4 步如何继续使用 FeatureVector

### 第 3 步：证据选择与置信度模型

将直接使用：

- `content`
- `topic`
- `community`
- `dataQuality`

目标：

- 判断哪些活动更值得成为证据
- 根据数据质量和特征密度估计置信度

### 第 4 步：archetype / tag / 综合画像规则

将直接使用：

- `activity`
- `content`
- `topic`
- `community`
- `dataQuality`

目标：

- 用统一特征层生成更可解释的 `Signal`
- 再由 `Signal` 组合成 tags 和 archetype
