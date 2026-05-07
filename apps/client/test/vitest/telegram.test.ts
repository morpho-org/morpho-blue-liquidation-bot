import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TELEGRAM_CHAT_ID = "-1001234567890";
const TELEGRAM_BOT_TOKEN = "123456:ABC";

describe("TelegramNotifier", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("returns undefined when Telegram variables are missing", async () => {
    const { createTelegramNotifier } = await import("../../src/utils/telegram.js");
    expect(createTelegramNotifier()).toBeUndefined();
  });

  it("creates a notifier when Telegram variables are present", async () => {
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID;
    const { createTelegramNotifier } = await import("../../src/utils/telegram.js");

    expect(createTelegramNotifier()).toBeDefined();
  });

  it("sends a message through the Telegram HTTP API", async () => {
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID;
    let capturedUrl: string | undefined;
    let capturedBody: unknown;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url instanceof URL ? url.href : url instanceof Request ? url.url : url;
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      return { ok: true } as Response;
    }) as typeof fetch;

    const { createTelegramNotifier } = await import("../../src/utils/telegram.js");
    const notifier = createTelegramNotifier();
    expect(notifier).toBeDefined();

    await notifier?.liquidationDetected(
      11155111,
      "market",
      "0xborrower",
      "0xcollateral",
      "1000",
      "liquidation",
    );

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(capturedUrl).toContain("api.telegram.org/bot123456:ABC/sendMessage");
    expect(capturedBody).toMatchObject({
      chat_id: TELEGRAM_CHAT_ID,
      text: expect.stringContaining("Liquidation détectée"),
    });
  });
});
