import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_REDIRECT_BASE_URL = "https://r.worldgate.space";
const DEFAULT_BYPASS_URL = "https://qrlive-jp-proxy.fly.dev/";
const DEFAULT_DEFAULT_URL = "https://example.com/default";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

function getConfig() {
  const env = { ...readEnvFile(path.resolve(process.cwd(), ".env.local")), ...process.env };
  const config = {
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD,
  };

  for (const [key, value] of Object.entries(config)) {
    if (!value) throw new Error(`Missing required config: ${key}`);
  }

  return config;
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = rest[index + 1] && !rest[index + 1].startsWith("--") ? rest[++index] : "true";
    options[key] = value;
  }

  return { command, options };
}

function createSupabaseClient(config) {
  return createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticate(supabase, config) {
  const { error } = await supabase.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });
  if (error) throw error;
}

async function resolveLinkId(supabase, options) {
  if (options["link-id"]) return options["link-id"];
  if (!options["short-code"]) throw new Error("Provide --link-id or --short-code");

  const { data, error } = await supabase
    .from("qr_links")
    .select("id")
    .eq("short_code", options["short-code"].toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error(`Link not found for short code ${options["short-code"]}`);
  return data.id;
}

async function createSmokeLink(supabase, options) {
  const country = (options.country ?? "CN").toUpperCase();
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  const shortCode = (options["short-code"] ?? `CN${suffix}`).toUpperCase().slice(0, 20);
  const namePrefix = options["name-prefix"] ?? "cn-smoke";
  const targetUrl = options["target-url"] ?? `https://example.com/${country.toLowerCase()}-target`;
  const defaultUrl = options["default-url"] ?? DEFAULT_DEFAULT_URL;
  const bypassUrl = options["bypass-url"] ?? DEFAULT_BYPASS_URL;
  const redirectBaseUrl = options["redirect-base-url"] ?? DEFAULT_REDIRECT_BASE_URL;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authenticated user not found");

  const { data: link, error: linkError } = await supabase
    .from("qr_links")
    .insert({
      name: `${namePrefix}-${suffix}`.slice(0, 120),
      short_code: shortCode,
      default_url: defaultUrl,
      user_id: user.id,
    })
    .select("id, name, short_code, default_url")
    .single();

  if (linkError) throw linkError;

  const { error: routeError } = await supabase.from("geo_routes").insert({
    link_id: link.id,
    country,
    country_code: country,
    target_url: targetUrl,
    bypass_url: bypassUrl,
  });

  if (routeError) {
    await supabase.from("qr_links").delete().eq("id", link.id);
    throw routeError;
  }

  const output = {
    action: "create",
    linkId: link.id,
    name: link.name,
    shortCode: link.short_code,
    scanUrl: `${redirectBaseUrl.replace(/\/$/, "")}/${link.short_code}`,
    defaultUrl,
    targetUrl,
    bypassUrl,
    expectedCountry: country,
    expectedBypassHost: new URL(bypassUrl).host,
    verifyCommand: `npm run smoke:cn -- verify --link-id ${link.id} --expect-country ${country}`,
    cleanupCommand: `npm run smoke:cn -- cleanup --link-id ${link.id}`,
  };

  console.log(JSON.stringify(output, null, 2));
}

async function verifySmokeLink(supabase, options) {
  const linkId = await resolveLinkId(supabase, options);
  const expectCountry = options["expect-country"]?.toUpperCase();

  const { data: link, error: linkError } = await supabase
    .from("qr_links")
    .select("id, name, short_code, default_url, geo_routes(country_code, target_url, bypass_url)")
    .eq("id", linkId)
    .single();
  if (linkError) throw linkError;

  const { data: clicks, error: clickError } = await supabase
    .from("click_events")
    .select("country_code, referer, created_at")
    .eq("link_id", linkId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (clickError) throw clickError;

  const latestClick = clicks?.[0] ?? null;
  const matchesCountry = expectCountry ? latestClick?.country_code === expectCountry : null;

  const output = {
    action: "verify",
    linkId: link.id,
    shortCode: link.short_code,
    latestClick,
    matchesExpectedCountry: matchesCountry,
    geoRoutes: link.geo_routes,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!latestClick) process.exitCode = 1;
  if (expectCountry && !matchesCountry) process.exitCode = 1;
}

async function cleanupSmokeLink(supabase, options) {
  const linkId = await resolveLinkId(supabase, options);

  const { error: routesError } = await supabase.from("geo_routes").delete().eq("link_id", linkId);
  if (routesError) throw routesError;

  const { error: clicksError } = await supabase.from("click_events").delete().eq("link_id", linkId);
  if (clicksError) throw clicksError;

  const { error: linkError } = await supabase.from("qr_links").delete().eq("id", linkId);
  if (linkError) throw linkError;

  console.log(JSON.stringify({ action: "cleanup", linkId, deleted: true }, null, 2));
}

function printHelp() {
  console.log(`Usage:
  npm run smoke:cn -- create [--country CN] [--target-url https://...] [--bypass-url https://...]
  npm run smoke:cn -- verify --link-id <uuid> [--expect-country CN]
  npm run smoke:cn -- cleanup --link-id <uuid>

Defaults:
  redirect base: ${DEFAULT_REDIRECT_BASE_URL}
  bypass url:    ${DEFAULT_BYPASS_URL}`);
}

const { command, options } = parseArgs(process.argv.slice(2));

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

const config = getConfig();
const supabase = createSupabaseClient(config);

try {
  await authenticate(supabase, config);

  if (command === "create") {
    await createSmokeLink(supabase, options);
  } else if (command === "verify") {
    await verifySmokeLink(supabase, options);
  } else if (command === "cleanup") {
    await cleanupSmokeLink(supabase, options);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} finally {
  await supabase.auth.signOut();
}
