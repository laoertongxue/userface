# 第 2 阶段第 1 步边界说明

本步只完成了过早客接入边界对齐，没有实现真实抓取。

已确认可直接复用的现有 contract：

- `CommunityId` 已支持 `v2ex | guozaoke | weibo`
- `CommunityConnector` / `ConnectorCapabilities` 足以表达纯 DOM 型社区
- `ConnectorWarningCode` 已覆盖 `UNSUPPORTED`、`PARTIAL_RESULT`、`SELECTOR_CHANGED` 等后续需要的语义
- `ConnectorDiagnostics` 已具备 `fetchedPages`、`fetchedItems`、`elapsedMs`、`degraded`、`usedRoutes`
- `CanonicalActivity` 当前字段足以承载基于列表页 DOM 抽取出的 topic / reply 数据

本步新增和固定的行为：

- `analyze` 请求协议通过现有 schema 正式接受 `community='guozaoke'`
- `StaticConnectorRegistry` 正式包含 `guozaoke` connector
- `GuozaokeConnector` 当前是明确的 scaffold：会返回 `UNSUPPORTED`，不会伪造成功 profile 或 activities

留待第 2 步实现的内容：

- 真实 fetchers
- 真实 DOM parsers
- 真实 mappers
- 真实 `probe()` / `fetchSnapshot()` 采集逻辑
