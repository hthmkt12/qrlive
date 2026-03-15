import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createLinkInDB,
  updateLinkInDB,
  updateGeoRoutesInDB,
  deleteLinkInDB,
  QRLinkRow,
} from "@/lib/db";
import { QUERY_KEYS } from "@/lib/query-keys";

/** Invalidates the links query to trigger a background refetch */
function useInvalidateLinks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.links });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateLink() {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({
      name,
      defaultUrl,
      geoRoutes,
      userId,
    }: {
      name: string;
      defaultUrl: string;
      geoRoutes: { country: string; countryCode: string; targetUrl: string }[];
      userId: string;
    }) => createLinkInDB(name, defaultUrl, geoRoutes, userId),
    onSuccess: invalidate,
  });
}

// ── Update link fields ───────────────────────────────────────────────────────

export function useUpdateLink() {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: { name?: string; default_url?: string; is_active?: boolean };
    }) => updateLinkInDB(id, updates),
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
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: (id: string) => deleteLinkInDB(id),
    onSuccess: invalidate,
  });
}
