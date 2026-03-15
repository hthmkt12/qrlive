import { useQuery } from "@tanstack/react-query";
import { fetchLinks } from "@/lib/db";
import { QUERY_KEYS } from "@/lib/query-keys";

/** Fetches all QR links for the current user, refreshes when tab regains focus */
export function useLinks() {
  return useQuery({
    queryKey: QUERY_KEYS.links,
    queryFn: fetchLinks,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
