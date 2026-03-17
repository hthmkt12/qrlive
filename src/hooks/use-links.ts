import { useQuery } from "@tanstack/react-query";
import { fetchLinkAnalyticsDetail, fetchLinkAnalyticsDetailV2, fetchLinkAnalyticsSummaries, fetchLinks } from "@/lib/db";
import { QUERY_KEYS } from "@/lib/query-keys";

/** Fetches all QR links for the current user, refreshes when tab regains focus */
export function useLinks() {
  return useQuery({
    queryKey: QUERY_KEYS.links,
    queryFn: fetchLinks,
    staleTime: 30_000,
  });
}

export function useLinkAnalyticsSummaries(linkIds: string[]) {
  const normalizedLinkIds = [...linkIds].sort();

  return useQuery({
    queryKey: QUERY_KEYS.analytics.summaries(normalizedLinkIds),
    queryFn: () => fetchLinkAnalyticsSummaries(normalizedLinkIds),
    enabled: normalizedLinkIds.length > 0,
    staleTime: 30_000,
  });
}

export function useLinkAnalyticsDetail(linkId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.analytics.detail(linkId || "none"),
    queryFn: () => fetchLinkAnalyticsDetail(linkId!),
    enabled: !!linkId,
    staleTime: 30_000,
  });
}

export function useLinkAnalyticsDetailV2(
  linkId: string | null,
  startDate?: string,
  endDate?: string,
  countryCode?: string
) {
  return useQuery({
    queryKey: QUERY_KEYS.analytics.detailV2(linkId || "none", startDate, endDate, countryCode),
    queryFn: () => fetchLinkAnalyticsDetailV2(linkId!, startDate, endDate, countryCode),
    enabled: !!linkId,
    staleTime: 30_000,
  });
}
