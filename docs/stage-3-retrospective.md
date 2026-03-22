# 第 3 阶段复盘

## 阶段目标回顾

第 3 阶段的原始目标是把画像引擎从“占位统计 + 少量硬编码标签”升级为一套可解释规则体系。

本阶段实际完成了：

- 画像域核心语言冻结
- `FeatureVector` 建模与特征提取
- `EvidenceSelectionService`
- `ConfidenceScoringService`
- `SignalDerivationService`
- `TagCompositionService`
- `ArchetypeClassificationService`
- `CrossCommunitySynthesisService`
- `ReportBuilder` 主导的最终报告组装

本阶段明确不包含：

- 多平台聚合工作流
- LLM narrative
- 微博 OAuth
- 正式产品级 UI

## 当前已被验证成立的部分

### 1. 画像域建模成立

当前以下模型已经形成稳定分层：

- `FeatureVector`
- `Signal`
- `EvidenceCandidate`
- `PortraitTag`
- `Archetype`

这意味着后续规则扩展不再需要频繁改外部 report contract。

### 2. 特征提取层成立

当前特征提取已覆盖：

- activity
- content
- topic
- community
- dataQuality

公式与阈值已经集中在 policy 中，足以支撑后续规则，而不是继续从原始 activities 临时计数。

### 3. 证据选择与 confidence 层成立

当前已经解决两个关键问题：

- evidence 不再是随机抽样
- confidence 不再是空壳字段

虽然这仍是启发式模型，但已经具备稳定输入、稳定口径和测试保护网。

### 4. 规则分类层成立

当前 `signal -> tag -> archetype -> synthesis` 已形成闭环。

这意味着：

- archetype 不再直接由临时 if-else 和 topic/reply 计数决定
- tag 不再是旧字符串逻辑与新规则混用
- cross-community traits 已在模型层成立

### 5. report composition 成立

当前 `ReportBuilder` 已成为最终 `PortraitReport` 的事实源入口。

`portrait / evidence / metrics / communityBreakdowns / warnings` 的来源优先级已经固定，避免了多处重复拼装。

## 当前暴露出的真实问题

### 1. archetype 边界仍偏启发式

- 现象：`DISCUSSION_ORIENTED / PROBLEM_SOLVER / COMMUNITY_PARTICIPANT` 等 archetype 仍有边界重叠
- 影响：某些边界样本会落在“方向正确但不是唯一最优”的 archetype
- 是否阻塞第 4 阶段：不阻塞
- 建议处理时机：第 4 阶段在多社区聚合和更丰富样本下再校准

### 2. low-data 与 observer 的边界风险仍存在

- 现象：低输出但跨度较长的样本，容易逼近 observer 规则
- 影响：需要持续防止 observer 吞掉 insufficient-data
- 是否阻塞第 4 阶段：不阻塞，但必须继续保留回归测试
- 建议处理时机：第 4 阶段前半段继续盯防

### 3. evidence label 仍较粗糙

- 现象：当前 evidence label 主要来自 `activityType / reasons / labelHint`
- 影响：对内部验证足够，但对正式产品展示还不够自然
- 是否阻塞第 4 阶段：不阻塞
- 建议处理时机：第 5 阶段或 LLM narrative 之后再细化

### 4. summary 仍偏规则化

- 现象：当前 summary 是稳定、保守的规则文案，不是自然语言 polished 输出
- 影响：适合验证，不适合最终产品体验
- 是否阻塞第 4 阶段：不阻塞
- 建议处理时机：后续 LLM narrative 阶段再处理

### 5. 多社区工作流尚未落地

- 现象：cross-community 规则已经存在，但当前 UI 与主流程仍以单平台分析为主
- 影响：规则层已准备好，工作流层尚未真正放大其价值
- 是否阻塞第 4 阶段：不阻塞，第 4 阶段正是解决它
- 建议处理时机：第 4 阶段

### 6. connector 来源波动仍会影响 confidence

- 现象：source degradation 仍然通过 warnings / degraded 影响 confidence
- 影响：画像稳定性仍部分受上游公开页面质量影响
- 是否阻塞第 4 阶段：不阻塞
- 建议处理时机：后续生产治理阶段系统化处理

### 7. 当前 UI 仍偏内部验证页

- 现象：页面适合人工验收，不适合正式产品
- 影响：对工程推进没问题，但不应被误认为可直接上线的用户界面
- 是否阻塞第 4 阶段：不阻塞
- 建议处理时机：正式产品阶段

## 第 4 阶段前建议冻结的内容

### 建议冻结

1. `FeatureVector` 基础字段集
2. `SignalCode` 集合
3. `TagCode` 集合
4. `ArchetypeCode` 集合
5. `ConfidenceProfile` 基础结构
6. `PortraitReport` 外部 contract
7. `communityBreakdowns` 的最小结构
8. warnings 基础集合

原因：

- 这些是当前测试、规则和报告层共同依赖的基线
- 如果在第 4 阶段继续频繁改动，会让聚合工作流和回归验证失去稳定锚点

### 暂不建议冻结

1. archetype 边界阈值的精细数值
2. evidence label 的展示策略
3. summary 的规则文案细节

原因：

- 这些仍需要随着更多样本和多社区工作流校准

## 第 4 阶段输入条件

进入第 4 阶段前，当前系统已经具备：

- 双平台单平台能力
- 可解释规则画像引擎
- 稳定 report composition
- 黄金样本回归测试
- 手工验收文档

第 4 阶段最应该关注：

- 多社区聚合工作流
- stable traits 与 community-specific traits 如何进入真实产品流程
- 多账号 / 多社区输入后的 orchestration

第 4 阶段不应该再被反复打断的问题：

- 基础字段集反复变动
- report contract 反复变动
- signal/tag/archetype 词汇体系反复变动

## 非目标与延期项

当前明确不做：

- 多账号自动身份合并
- 多平台聚合交互工作流
- LLM narrative
- 微博 OAuth
- 生产治理
- 正式产品级 UI

这些内容不在当前阶段处理，是为了避免“规则引擎未稳定就继续叠新能力”。

## 最终结论

第 3 阶段已经达到阶段目标。

可以进入第 4 阶段，前提是：

- 继续冻结当前基础 contract
- 把第 4 阶段重心放在多社区工作流，而不是再次重写规则层

当前不需要再补新的画像基础能力；后续主要任务应转向：

- 聚合输入编排
- 多社区 traits 的实际工作流落地
- 更系统的人工校验样本积累
