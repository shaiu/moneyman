const mockSendMessage = jest.fn();
let mockDeprecationHandler: (id: string, message: string) => void = () => {};

jest.mock("telegraf", () => ({
  Telegraf: class {
    telegram = { sendMessage: (...a: unknown[]) => mockSendMessage(...a) };
  },
  TelegramError: class extends Error {},
}));
jest.mock("telegraf/filters", () => ({ message: jest.fn() }));
jest.mock("./deprecationManager.js", () => ({
  assignDeprecationHandler: (h: typeof mockDeprecationHandler) => {
    mockDeprecationHandler = h;
  },
}));
jest.mock("../config.js", () => {
  const cfg = jest.requireActual("../utils/tests.js").config();
  cfg.options.notifications = { telegram: { apiKey: "key", chatId: "1" } };
  return { config: cfg };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendError } = require("./notifier.js");

// Callers fire these without awaiting. A rejection would surface as an
// unhandled rejection, which the uncaughtException handler records, turning
// the run red for a Telegram hiccup rather than a lost write.
describe("notifier error reporting never rejects", () => {
  beforeEach(() => {
    mockSendMessage.mockRejectedValue(new Error("429: Too Many Requests"));
  });

  it("sendError resolves when Telegram rejects", async () => {
    await expect(sendError(new Error("boom"), "caller")).resolves.toBe(
      undefined,
    );
  });

  it("deprecation messages swallow Telegram rejections", async () => {
    const rejections: unknown[] = [];
    const onRejection = (e: unknown) => rejections.push(e);
    process.on("unhandledRejection", onRejection);
    try {
      mockDeprecationHandler("some-id", "deprecated");
      await new Promise((r) => setImmediate(r));
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });
});
