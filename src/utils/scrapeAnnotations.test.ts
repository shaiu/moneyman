import { CompanyTypes } from "israeli-bank-scrapers";
import { ScraperErrorTypes } from "israeli-bank-scrapers/lib/scrapers/errors.js";
import type { AccountScrapeResult } from "../types.js";

const mockLogToPublicLog = jest.fn();
jest.mock("./logger.js", () => ({
  createLogger: () => jest.fn(),
  logToPublicLog: (...a: unknown[]) => mockLogToPublicLog(...a),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  scrapeAnnotationLines,
  writeScrapeAnnotations,
} = require("./scrapeAnnotations.js");

const ok: AccountScrapeResult = {
  companyId: CompanyTypes.hapoalim,
  result: { success: true, accounts: [] },
};
const failed: AccountScrapeResult = {
  companyId: CompanyTypes.visaCal,
  result: {
    success: false,
    errorType: ScraperErrorTypes.Timeout,
    errorMessage: "waiting for redirect from https://login.example/secret",
  },
};

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.MONEYMAN_GITHUB_ANNOTATIONS;
});

describe("scrapeAnnotationLines", () => {
  it("marks a successful scrape, even with no transactions", () => {
    expect(scrapeAnnotationLines([ok])).toEqual([
      "::notice title=scrape-ok::hapoalim",
    ]);
  });

  it("marks a failed scrape with its error type", () => {
    expect(scrapeAnnotationLines([failed])).toEqual([
      "::warning title=scrape-failed::visaCal TIMEOUT",
    ]);
  });

  it("falls back to GENERIC and never leaks the error message", () => {
    const noType: AccountScrapeResult = {
      companyId: CompanyTypes.max,
      result: {
        success: false,
        errorMessage: "boom at https://bank.example/?token=abc",
      },
    };
    const lines = scrapeAnnotationLines([noType, failed]);
    expect(lines[0]).toBe("::warning title=scrape-failed::max GENERIC");
    expect(lines.join("\n")).not.toContain("https://");
  });

  it("writes one line per account, in order", () => {
    expect(scrapeAnnotationLines([ok, failed])).toHaveLength(2);
  });
});

describe("writeScrapeAnnotations", () => {
  it("writes nothing when the flag is unset", () => {
    writeScrapeAnnotations([ok, failed]);
    expect(mockLogToPublicLog).not.toHaveBeenCalled();
  });

  it("writes each line to the public log when the flag is set", () => {
    process.env.MONEYMAN_GITHUB_ANNOTATIONS = "true";
    writeScrapeAnnotations([ok, failed]);
    expect(mockLogToPublicLog.mock.calls.map((c) => c[0])).toEqual([
      "::notice title=scrape-ok::hapoalim",
      "::warning title=scrape-failed::visaCal TIMEOUT",
    ]);
  });
});
