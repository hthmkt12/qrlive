import { useQuery } from "@tanstack/react-query";
import { fetchLinks } from "@/lib/db";
import { QUERY_KEYS } from "@/lib/query-keys";

/** Fetches all QR links for the current user, auto-refreshing every 10 seconds */
export function useLinks() {
  return useQuery({
    queryKey: QUERY_KEYS.links,
    queryFn: fetchLinks,
    refetchInterval: 10_000,
  });
}
