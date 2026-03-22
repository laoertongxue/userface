export const analysisConfig = {
  defaults: {
    maxPagesPerCommunity: 3,
    maxItemsPerCommunity: 120,
    includeTopics: true,
    includeReplies: true,
    locale: 'zh-CN' as const,
    llmProvider: 'none' as const,
  },
  evidenceLimit: 6,
};
