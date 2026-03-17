import { z } from "zod";

const BLOCKED_WEBHOOK_HOSTS = new Set(["localhost"]);
const BLOCKED_WEBHOOK_SUFFIXES = [".internal", ".lan", ".local", ".localhost", ".home"];

function normalizeWebhookHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function isIPv4Literal(hostname: string) {
  const octets = hostname.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => /^\d+$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
}

function isSafeWebhookUrl(value: string) {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return false;
  }

  const hostname = normalizeWebhookHostname(target.hostname);
  if (!hostname || !hostname.includes(".")) return false;
  if (BLOCKED_WEBHOOK_HOSTS.has(hostname)) return false;
  if (BLOCKED_WEBHOOK_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;
  return !isIPv4Literal(hostname) && !hostname.includes(":");
}

const webhookUrlSchema = z.preprocess(
  (value) => typeof value === "string" ? value.trim() : value,
  z.union([
    z.literal(""),
    z.string()
      .url("Webhook URL không hợp lệ")
      .refine(
        (value) => /^https?:\/\//i.test(value),
        "Webhook URL phải bắt đầu bằng http:// hoặc https://"
      )
      .refine(
        (value) => isSafeWebhookUrl(value),
        "Webhook URL phải dùng domain public, không dùng localhost hoặc địa chỉ IP"
      ),
  ])
);

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
  // Optional custom short code: empty string means auto-generate; normalized to uppercase
  customShortCode: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(
      z.string().regex(
        /^[A-Z0-9_-]{3,20}$/,
        "Short code chỉ chứa chữ, số, - hoặc _, dài 3-20 ký tự"
      )
    )
    .optional()
    .or(z.literal("")),
  // Optional expiration date: ISO date string (YYYY-MM-DD) or empty string = no expiration
  expiresAt: z.string().optional().or(z.literal("")),
  // Optional link password: min 4 chars if provided; empty string = no password / clear existing
  linkPassword: z
    .string()
    .min(4, "Mật khẩu tối thiểu 4 ký tự")
    .max(100, "Mật khẩu quá dài")
    .optional()
    .or(z.literal("")),
  // Optional click-event webhook: empty string disables notifications
  webhookUrl: webhookUrlSchema.optional(),
});

// Login / Signup form
export const authSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export type GeoRouteInput = z.infer<typeof geoRouteSchema>;
export type LinkFormInput = z.infer<typeof linkFormSchema>;
export type AuthInput = z.infer<typeof authSchema>;
