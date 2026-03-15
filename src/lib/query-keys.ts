// Centralized React Query key definitions — prevents key typos and enables targeted invalidation
export const QUERY_KEYS = {
  links: ["links"] as const,
  link: (id: string) => ["links", id] as const,
  analytics: {
    all: ["links", "analytics"] as const,
    summaries: (linkIds: string[]) => ["links", "analytics", "summaries", ...linkIds] as const,
    detail: (id: string) => ["links", "analytics", "detail", id] as const,
  },
} as const;
