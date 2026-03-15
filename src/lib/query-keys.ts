// Centralized React Query key definitions — prevents key typos and enables targeted invalidation
export const QUERY_KEYS = {
  links: ["links"] as const,
  link: (id: string) => ["links", id] as const,
} as const;
