// Barrel re-export — preserves all existing import paths (no breaking changes)
export type {
  QRLinkRow,
  GeoRouteRow,
  ClickEventRow,
  LinkAnalyticsSummaryRow,
  LinkAnalyticsDayRow,
  LinkAnalyticsCountryRow,
  LinkAnalyticsRefererRow,
  LinkAnalyticsDetailRow,
  QrConfig,
} from "./db/models";

export {
  fetchLinks,
  fetchLinkAnalyticsSummaries,
  fetchLinkAnalyticsDetail,
  fetchLinkAnalyticsDetailV2,
} from "./db/queries";

export {
  generateShortCode,
  createLinkInDB,
  updateLinkInDB,
  updateGeoRoutesInDB,
  deleteLinkInDB,
} from "./db/mutations";

export { getRedirectUrl, normalizeAnalyticsRows } from "./db/utils";
