const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArrayValue(value) {
  return value
    .slice(1, -1)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^['"]|['"]$/g, ""));
}

function parseScalarValue(value) {
  if (!value) return "";
  if (value.startsWith("[") && value.endsWith("]")) return parseArrayValue(value);
  return value.replace(/^['"]|['"]$/g, "");
}

function stringifyScalarValue(value) {
  if (/^[A-Za-z0-9_.:-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function stringifyValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stringifyScalarValue(String(entry))).join(", ")}]`;
  }
  return stringifyScalarValue(String(value));
}

export function normalizePlanStatus(rawValue, fallback = "pending") {
  if (!rawValue) return fallback;
  const normalized = String(rawValue).toLowerCase();
  if (normalized.includes("complete") || normalized.includes("done")) return "completed";
  if (normalized.includes("progress")) return "in-progress";
  if (normalized.includes("pending") || normalized.includes("todo")) return "pending";
  return fallback;
}

export function parseFrontmatterDocument(content) {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return {
      body: content,
      frontmatter: {},
      hasFrontmatter: false,
    };
  }

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    frontmatter[key] = parseScalarValue(value);
  }

  return {
    body: content.slice(match[0].length),
    frontmatter,
    hasFrontmatter: true,
  };
}

export function extractLegacyPlanMetadata(body) {
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const infoMatch = body.match(
    /\*\*Date:\*\*\s*([0-9-]+)\s*\|\s*\*\*Branch:\*\*\s*([^|]+?)\s*\|\s*\*\*Status:\*\*\s*([^\n]+)/
  );

  return {
    branch: infoMatch?.[2]?.trim(),
    created: infoMatch?.[1]?.trim(),
    status: normalizePlanStatus(infoMatch?.[3]),
    title: titleMatch?.[1]?.trim(),
  };
}

export function serializeFrontmatter(frontmatter) {
  const preferredOrder = [
    "title",
    "description",
    "status",
    "priority",
    "effort",
    "branch",
    "tags",
    "created",
    "completed",
  ];

  const orderedKeys = preferredOrder
    .filter((key) => key in frontmatter)
    .concat(
      Object.keys(frontmatter)
        .filter((key) => !preferredOrder.includes(key))
        .sort()
    );

  const lines = orderedKeys.map((key) => `${key}: ${stringifyValue(frontmatter[key])}`);
  return `---\n${lines.join("\n")}\n---`;
}

export function upsertManagedBlock(body, block, startMarker, endMarker) {
  const pattern = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`,
    "m"
  );

  if (body.includes(startMarker) && body.includes(endMarker)) {
    return body.replace(pattern, `${block}\n\n`).trimStart();
  }

  return `${block}\n\n${body.trimStart()}`;
}
