import { exitCode, resetRunOutcome, summary } from "../utils/runOutcome.js";

jest.mock("./storage/index.js", () => ({
  __esModule: true,
  storages: [],
  saveResults: jest.fn(),
}));
jest.mock("./notifier.js", () => ({
  __esModule: true,
  send: jest.fn().mockResolvedValue(undefined),
  editMessage: jest.fn().mockResolvedValue(undefined),
  sendError: jest.fn(),
  sendJSON: jest.fn(),
  sendPhotos: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runWithStorage } = require("./index.js");

afterEach(() => {
  resetRunOutcome();
  delete process.env.MONEYMAN_FAIL_ON_ERROR;
});

describe("runWithStorage", () => {
  it("records a config failure and does not scrape when no storage is configured", async () => {
    process.env.MONEYMAN_FAIL_ON_ERROR = "true";
    const runScraper = jest.fn();
    await runWithStorage(runScraper);
    expect(runScraper).not.toHaveBeenCalled();
    expect(exitCode()).toBe(1);
    expect(summary()[0]).toContain("[config]");
  });
});
