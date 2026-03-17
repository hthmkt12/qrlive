import { describe, expect, it, vi } from "vitest";
import {
  buildClickWebhookPayload,
  dispatchClickWebhook,
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
      fetchImpl
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
        fetchImpl
      )
    ).rejects.toThrow("WEBHOOK_HTTP_500");
  });
});
