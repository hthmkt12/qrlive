// Data model interfaces for QR link system

export interface QRLinkRow {
  id: string;
  user_id: string;
  name: string;
  short_code: string;
  default_url: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  geo_routes: GeoRouteRow[];
}

export interface GeoRouteRow {
  id: string;
  link_id: string;
  country: string;
  country_code: string;
  target_url: string;
  bypass_url?: string | null;
  created_at?: string;
}

export interface ClickEventRow {
  id: string;
  link_id: string;
  country_code: string | null;
  referer: string | null;
  created_at: string;
}

export interface LinkAnalyticsSummaryRow {
  link_id: string;
  total_clicks: number;
  today_clicks: number;
  top_country_code: string | null;
}

export interface LinkAnalyticsDayRow {
  date: string;
  clicks: number;
}

export interface LinkAnalyticsCountryRow {
  country_code: string;
  clicks: number;
}

export interface LinkAnalyticsRefererRow {
  referer: string;
  clicks: number;
}

export interface LinkAnalyticsDetailRow {
  link_id: string;
  total_clicks: number;
  today_clicks: number;
  countries_count: number;
  clicks_by_day: LinkAnalyticsDayRow[];
  country_breakdown: LinkAnalyticsCountryRow[];
  referer_breakdown: LinkAnalyticsRefererRow[];
}
