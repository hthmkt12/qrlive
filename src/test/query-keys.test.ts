import { describe, it, expect } from "vitest";
import { QUERY_KEYS } from "@/lib/query-keys";

describe("QUERY_KEYS", () => {
  it("links root key is ['links']", () => {
    expect(QUERY_KEYS.links).toEqual(["links"]);
  });

  it("link(id) includes the id", () => {
    expect(QUERY_KEYS.link("abc")).toEqual(["links", "abc"]);
  });

  it("analytics.all is ['links', 'analytics']", () => {
    expect(QUERY_KEYS.analytics.all).toEqual(["links", "analytics"]);
  });

  it("analytics.summaries spreads link ids into key", () => {
    const key = QUERY_KEYS.analytics.summaries(["b", "a"]);
    expect(key).toEqual(["links", "analytics", "summaries", "b", "a"]);
  });

  it("analytics.detail includes link id", () => {
    expect(QUERY_KEYS.analytics.detail("link-1")).toEqual([
      "links", "analytics", "detail", "link-1",
    ]);
  });

  it("analytics.detailV2 uses 'default' when dates omitted", () => {
    const key = QUERY_KEYS.analytics.detailV2("link-1");
    expect(key).toEqual(["links", "analytics", "detail", "link-1", "default", "default"]);
  });

  it("analytics.detailV2 includes dates when provided", () => {
    const key = QUERY_KEYS.analytics.detailV2("link-1", "2026-03-01", "2026-03-16");
    expect(key).toEqual(["links", "analytics", "detail", "link-1", "2026-03-01", "2026-03-16"]);
  });
});
