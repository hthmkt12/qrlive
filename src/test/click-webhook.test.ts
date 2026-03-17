import { describe, expect, it, vi } from "vitest";
import {
  buildClickWebhookPayload,
  dispatchClickWebhook,
  redactWebhookUrl,
  reportClickWebhookError,
  validateWebhookUrl,
} from "../../supabase/functions/redirect/click-webhook";

describe("click webhook helpers", () => {
  it("builds the click.created payload shape", () => {
    expect(
      buildClickWebhookPayload({
        countryCode: "VN",
        defaultUrl: "https://example.com",
        linkId: "link-1",
        linkName: "Summer Campaign",
        occurredAt: "2026-03-17T10:00:00.000Z",
        redirectUrl: "https://example.com/vn",
        referer: "https://google.com",
        shortCode: "SUMMER",
      })
    ).toEqual({
      event: "click.created",
      version: 1,
      occurred_at: "2026-03-17T10:00:00.000Z",
      link: { id: "link-1", name: "Summer Campaign", short_code: "SUMMER" },
      destination: {
        default_url: "https://example.com",
        redirect_url: "https://example.com/vn",
        geo_routed: true,
      },
      click: { country_code: "VN", referer: "https://google.com" },
    });
  });

  it("dispatches a POST request with webhook headers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const resolveDnsImpl = vi.fn().mockResolvedValue(["93.184.216.34"]);
    await dispatchClickWebhook(
      "https://hooks.example.com/clicks",
      buildClickWebhookPayload({
        countryCode: "US",
        defaultUrl: "https://example.com",
        linkId: "link-1",
        linkName: "Launch",
        occurredAt: "2026-03-17T10:00:00.000Z",
        redirectUrl: "https://example.com",
        referer: "direct",
        shortCode: "LAUNCH",
      }),
      fetchImpl,
      resolveDnsImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://hooks.example.com/clicks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-QRLive-Event": "click.created",
          "X-QRLive-Version": "1",
        }),
      })
    );
  });

  it("throws when the webhook target returns a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const resolveDnsImpl = vi.fn().mockResolvedValue(["93.184.216.34"]);
    await expect(
      dispatchClickWebhook(
        "https://hooks.example.com/fail",
        buildClickWebhookPayload({
          countryCode: "US",
          defaultUrl: "https://example.com",
          linkId: "link-1",
          linkName: "Launch",
          occurredAt: "2026-03-17T10:00:00.000Z",
          redirectUrl: "https://example.com",
          referer: "direct",
          shortCode: "LAUNCH",
        }),
        fetchImpl,
        resolveDnsImpl
      )
    ).rejects.toThrow("WEBHOOK_HTTP_500");
  });

  it("rejects non-https, localhost, and IP-literal webhook targets before any fetch", async () => {
    const fetchImpl = vi.fn();
    const payload = buildClickWebhookPayload({
      countryCode: "US",
      defaultUrl: "https://example.com",
      linkId: "link-1",
      linkName: "Launch",
      occurredAt: "2026-03-17T10:00:00.000Z",
      redirectUrl: "https://example.com",
      referer: "direct",
      shortCode: "LAUNCH",
    });

    await expect(dispatchClickWebhook("https://127.0.0.1:8080/hook", payload, fetchImpl)).rejects.toThrow("WEBHOOK_URL_BLOCKED");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(() => validateWebhookUrl("http://hooks.example.com/webhook")).toThrow("WEBHOOK_URL_INVALID");
    expect(() => validateWebhookUrl("https://localhost/webhook")).toThrow("WEBHOOK_URL_BLOCKED");
  });

  it("rejects domains that resolve to private IP ranges", async () => {
    const fetchImpl = vi.fn();
    const resolveDnsImpl = vi.fn().mockImplementation(async (_hostname: string, recordType: "A" | "AAAA") => (
      recordType === "A" ? ["10.0.0.5"] : []
    ));

    await expect(
      dispatchClickWebhook(
        "https://hooks.example.com/clicks",
        buildClickWebhookPayload({
          countryCode: "US",
          defaultUrl: "https://example.com",
          linkId: "link-1",
          linkName: "Launch",
          occurredAt: "2026-03-17T10:00:00.000Z",
          redirectUrl: "https://example.com",
          referer: "direct",
          shortCode: "LAUNCH",
        }),
        fetchImpl,
        resolveDnsImpl
      )
    ).rejects.toThrow("WEBHOOK_URL_BLOCKED");

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("redacts webhook URLs in error logs", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportClickWebhookError("https://hooks.example.com/secret-token?sig=123", new Error("network down"));

    expect(redactWebhookUrl("https://hooks.example.com/secret-token?sig=123")).toBe("https://hooks.example.com/...");
    expect(consoleError).toHaveBeenCalledWith(
      "Click webhook delivery failed for https://hooks.example.com/...: network down"
    );
  });
});
