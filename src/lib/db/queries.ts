// Read operations: fetch links and analytics data from Supabase

import { supabase } from "@/integrations/supabase/client";
import { normalizeAnalyticsRows } from "./utils";
import type {
  QRLinkRow,
  LinkAnalyticsSummaryRow,
  LinkAnalyticsDetailRow,
} from "./models";

export async function fetchLinks(): Promise<QRLinkRow[]> {
  const { data, error } = await supabase
    .from("qr_links")
    // has_password is a server-side generated column — password_hash is never selected here
    .select("id, user_id, name, short_code, default_url, webhook_url, is_active, created_at, expires_at, has_password, qr_config, geo_routes(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as QRLinkRow[];
}

export async function fetchLinkAnalyticsSummaries(
  linkIds: string[]
): Promise<LinkAnalyticsSummaryRow[]> {
  if (linkIds.length === 0) return [];

  const { data, error } = await supabase.rpc("get_link_click_summaries", {
    p_link_ids: linkIds,
  });

  if (error) throw error;

  return ((data as LinkAnalyticsSummaryRow[] | null) || []).map((row) => ({
    ...row,
    total_clicks: Number(row.total_clicks || 0),
    today_clicks: Number(row.today_clicks || 0),
  }));
}

export async function fetchLinkAnalyticsDetailV2(
  linkId: string,
  startDate?: string,
  endDate?: string
): Promise<LinkAnalyticsDetailRow> {
  const params: Record<string, unknown> = { p_link_id: linkId };
  if (startDate) params.p_start_date = startDate;
  if (endDate) params.p_end_date = endDate;

  const { data, error } = await supabase.rpc("get_link_click_detail_v2", params);

  if (error) throw error;

  const row = ((data as LinkAnalyticsDetailRow[] | null) || [])[0];
  if (!row) {
    return {
      link_id: linkId,
      total_clicks: 0,
      today_clicks: 0,
      countries_count: 0,
      clicks_by_day: [],
      country_breakdown: [],
      referer_breakdown: [],
    };
  }

  return {
    link_id: row.link_id,
    total_clicks: Number(row.total_clicks || 0),
    today_clicks: Number(row.today_clicks || 0),
    countries_count: Number(row.countries_count || 0),
    clicks_by_day: normalizeAnalyticsRows(row.clicks_by_day, (entry) => ({
      date: String(entry.date || ""),
      clicks: Number(entry.clicks || 0),
    })),
    country_breakdown: normalizeAnalyticsRows(row.country_breakdown, (entry) => ({
      country_code: String(entry.country_code || ""),
      clicks: Number(entry.clicks || 0),
    })),
    referer_breakdown: normalizeAnalyticsRows(row.referer_breakdown, (entry) => ({
      referer: String(entry.referer || "direct"),
      clicks: Number(entry.clicks || 0),
    })),
  };
}

export async function fetchLinkAnalyticsDetail(linkId: string): Promise<LinkAnalyticsDetailRow> {
  const { data, error } = await supabase.rpc("get_link_click_detail", {
    p_link_id: linkId,
  });

  if (error) throw error;

  const row = ((data as LinkAnalyticsDetailRow[] | null) || [])[0];
  if (!row) {
    return {
      link_id: linkId,
      total_clicks: 0,
      today_clicks: 0,
      countries_count: 0,
      clicks_by_day: [],
      country_breakdown: [],
      referer_breakdown: [],
    };
  }

  return {
    link_id: row.link_id,
    total_clicks: Number(row.total_clicks || 0),
    today_clicks: Number(row.today_clicks || 0),
    countries_count: Number(row.countries_count || 0),
    clicks_by_day: normalizeAnalyticsRows(row.clicks_by_day, (entry) => ({
      date: String(entry.date || ""),
      clicks: Number(entry.clicks || 0),
    })),
    country_breakdown: normalizeAnalyticsRows(row.country_breakdown, (entry) => ({
      country_code: String(entry.country_code || ""),
      clicks: Number(entry.clicks || 0),
    })),
    referer_breakdown: normalizeAnalyticsRows(row.referer_breakdown, (entry) => ({
      referer: String(entry.referer || "direct"),
      clicks: Number(entry.clicks || 0),
    })),
  };
}
