import { createLinkMetadataCache, type LinkMetadataCache } from "../_shared/link-metadata-cache.ts";
import type { LinkRecord, SupabaseAdapter } from "./redirect-handler.ts";

export { createLinkMetadataCache };

export function withLinkMetadataCache(adapter: SupabaseAdapter, cache: LinkMetadataCache | null): SupabaseAdapter {
  if (!cache) return adapter;

  return {
    ...adapter,
    async fetchLink(shortCode) {
      try {
        const cachedLink = await cache.get<LinkRecord>(shortCode);
        if (cachedLink) return cachedLink;
      } catch (error) {
        console.warn("Link cache lookup failed:", error);
      }

      const link = await adapter.fetchLink(shortCode);
      if (!link) return null;

      try {
        await cache.set(link);
      } catch (error) {
        console.warn("Link cache write failed:", error);
      }

      return link;
    },
  };
}
