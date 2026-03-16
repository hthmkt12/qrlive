import { z } from "zod";

// Single geo route: country + target URL + optional bypass URL for geo-block evasion
export const geoRouteSchema = z.object({
  country: z.string(),
  countryCode: z.string().min(2, "Chọn quốc gia"),
  targetUrl: z.string().url("URL không hợp lệ"),
  bypassUrl: z.union([z.string().url("Bypass URL không hợp lệ"), z.literal("")]).optional(),
});

// Create / Edit link form
export const linkFormSchema = z.object({
  name: z.string().min(1, "Tên không được để trống").max(100, "Tên quá dài"),
  defaultUrl: z.string().url("URL mặc định không hợp lệ"),
  geoRoutes: z.array(geoRouteSchema).default([]),
  // Optional custom short code — empty string means auto-generate; normalized to uppercase
  customShortCode: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9_-]{3,20}$/, "Short code chỉ chứa chữ, số, - hoặc _, 3–20 ký tự"))
    .optional()
    .or(z.literal("")),
  // Optional expiration date — ISO date string (YYYY-MM-DD) or empty string = no expiration
  expiresAt: z.string().optional().or(z.literal("")),
});

// Login / Signup form
export const authSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export type GeoRouteInput = z.infer<typeof geoRouteSchema>;
export type LinkFormInput = z.infer<typeof linkFormSchema>;
export type AuthInput = z.infer<typeof authSchema>;
