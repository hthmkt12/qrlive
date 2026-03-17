// Zod schemas for CSV row validation in bulk import/export operations
import { z } from "zod";

/** Schema for a single CSV row — geo columns are optional */
export const csvRowSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  default_url: z.string().url("URL không hợp lệ"),
  custom_short_code: z.string().optional().or(z.literal("")),
  expires_at: z.string().optional().or(z.literal("")),
  geo_country_code: z.string().optional().or(z.literal("")),
  geo_target_url: z
    .string()
    .url("Geo URL không hợp lệ")
    .optional()
    .or(z.literal("")),
  geo_bypass_url: z
    .string()
    .url("Bypass URL không hợp lệ")
    .optional()
    .or(z.literal("")),
});

export type CSVRow = z.infer<typeof csvRowSchema>;

/** A link grouped from one or more CSV rows sharing the same name+short_code */
export interface GroupedLink {
  name: string;
  default_url: string;
  custom_short_code: string;
  expires_at: string;
  geo_routes: Array<{
    countryCode: string;
    country: string;
    targetUrl: string;
    bypassUrl: string;
  }>;
}
