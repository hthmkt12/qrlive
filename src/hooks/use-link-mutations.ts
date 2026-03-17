import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createLinkInDB,
  updateLinkInDB,
  updateGeoRoutesInDB,
  deleteLinkInDB,
  QRLinkRow,
} from "@/lib/db";
import type { QrConfig } from "@/lib/db/models";
import { QUERY_KEYS } from "@/lib/query-keys";
import type { GroupedLink } from "@/lib/bulk-operations-schemas";

/** Invalidates the links query to trigger a background refetch */
function useInvalidateLinks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.links });
}

function useInvalidateDashboardAnalytics() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.analytics.all });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateLink() {
  const invalidateLinks = useInvalidateLinks();
  const invalidateAnalytics = useInvalidateDashboardAnalytics();
  return useMutation({
    mutationFn: ({
      name,
      defaultUrl,
      geoRoutes,
      userId,
      customShortCode,
      expiresAt,
      password,
      qrConfig,
      webhookUrl,
    }: {
      name: string;
      defaultUrl: string;
      geoRoutes: { country: string; countryCode: string; targetUrl: string }[];
      userId: string;
      customShortCode?: string;
      expiresAt?: string | null;
      password?: string;
      qrConfig?: QrConfig | null;
      webhookUrl?: string;
    }) => createLinkInDB(name, defaultUrl, geoRoutes, userId, customShortCode, expiresAt, password, qrConfig, webhookUrl),
    onSuccess: () => {
      invalidateLinks();
      invalidateAnalytics();
    },
  });
}

// ── Update link fields ───────────────────────────────────────────────────────

export function useUpdateLink() {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({
      id,
      updates,
      password,
    }: {
      id: string;
      updates: {
        name?: string;
        default_url?: string;
        webhook_url?: string | null;
        is_active?: boolean;
        expires_at?: string | null;
        qr_config?: QrConfig | null;
      };
      password?: string; // undefined = no change; "" = clear; non-empty = set new
    }) => updateLinkInDB(id, updates, password),
    onSuccess: invalidate,
  });
}

// ── Toggle active with optimistic update ────────────────────────────────────

export function useToggleActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateLinkInDB(id, { is_active: isActive }),
    onMutate: async ({ id, isActive }) => {
      // Cancel any in-flight refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.links });
      const previous = queryClient.getQueryData<QRLinkRow[]>(QUERY_KEYS.links);
      queryClient.setQueryData<QRLinkRow[]>(QUERY_KEYS.links, (old = []) =>
        old.map((link) => (link.id === id ? { ...link, is_active: isActive } : link))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on error
      queryClient.setQueryData(QUERY_KEYS.links, context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.links });
    },
  });
}

// ── Update geo routes ────────────────────────────────────────────────────────

export function useUpdateGeoRoutes() {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({
      linkId,
      geoRoutes,
    }: {
      linkId: string;
      geoRoutes: { country: string; countryCode: string; targetUrl: string }[];
    }) => updateGeoRoutesInDB(linkId, geoRoutes),
    onSuccess: invalidate,
  });
}

// ── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteLink() {
  const invalidateLinks = useInvalidateLinks();
  const invalidateAnalytics = useInvalidateDashboardAnalytics();
  return useMutation({
    mutationFn: (id: string) => deleteLinkInDB(id),
    onSuccess: () => {
      invalidateLinks();
      invalidateAnalytics();
    },
  });
}

// ── Bulk Create ───────────────────────────────────────────────────────────────

export interface BulkCreateResult {
  succeeded: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

/**
 * Bulk create links sequentially from grouped CSV rows.
 * Calls onProgress(completed, total) after each attempt for progress tracking.
 */
export function useBulkCreateLinks() {
  const invalidateLinks = useInvalidateLinks();
  const invalidateAnalytics = useInvalidateDashboardAnalytics();

  return useMutation({
    mutationFn: async ({
      links,
      userId,
      onProgress,
    }: {
      links: GroupedLink[];
      userId: string;
      onProgress?: (completed: number, total: number) => void;
    }): Promise<BulkCreateResult> => {
      const result: BulkCreateResult = { succeeded: 0, failed: 0, errors: [] };

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        try {
          await createLinkInDB(
            link.name,
            link.default_url,
            link.geo_routes,
            userId,
            link.custom_short_code || undefined,
            link.expires_at || null
          );
          result.succeeded++;
        } catch (err) {
          result.failed++;
          result.errors.push({
            name: link.name,
            error: err instanceof Error ? err.message : "Lỗi không xác định",
          });
        }
        onProgress?.(i + 1, links.length);
      }

      return result;
    },
    onSuccess: () => {
      invalidateLinks();
      invalidateAnalytics();
    },
  });
}
