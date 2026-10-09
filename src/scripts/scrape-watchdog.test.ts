import {
  findStale,
  formatProblem,
  formatSummary,
  oksFromAnnotations,
  parseExpected,
  parseMaxAgeHours,
  type Observation,
} from "./scrape-watchdog.js";

const NOW = new Date("2026-10-09T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const run = (
  workflow: string,
  createdAt: Date,
  oks: string[],
  runId = 1,
): Observation => ({ workflow, runId, createdAt, oks });

const HAPOALIM = { workflow: "Scrape_Hapoalim", companyId: "hapoalim" };

describe("parseExpected", () => {
  it("parses workflow: companyId lines", () => {
    expect(parseExpected("Scrape_Hapoalim: hapoalim\nScrape_Max: max")).toEqual(
      [HAPOALIM, { workflow: "Scrape_Max", companyId: "max" }],
    );
  });

  it("ignores CRLF, trailing spaces, blank lines and # comments", () => {
    const text =
      "# accounts\r\n  Scrape_Hapoalim:hapoalim   \r\n\r\nScrape_Max : max\r\n";
    expect(parseExpected(text)).toEqual([
      HAPOALIM,
      { workflow: "Scrape_Max", companyId: "max" },
    ]);
  });

  it("rejects a malformed line, naming it", () => {
    expect(() => parseExpected("Scrape_Hapoalim hapoalim")).toThrow(
      /Scrape_Hapoalim hapoalim/,
    );
  });

  it("rejects an empty list", () => {
    expect(() => parseExpected("\n# nothing\n")).toThrow(/no accounts/);
  });
});

describe("parseMaxAgeHours", () => {
  it("accepts a positive number", () => {
    expect(parseMaxAgeHours("30")).toBe(30);
    expect(parseMaxAgeHours("1")).toBe(1);
  });

  it.each(["abc", "0", "-1", "", "  ", undefined])("rejects %p", (value) => {
    expect(() => parseMaxAgeHours(value)).toThrow(/MAX_AGE_HOURS/);
  });
});

describe("oksFromAnnotations", () => {
  it("keeps only scrape-ok messages, trimmed", () => {
    expect(
      oksFromAnnotations([
        { title: "scrape-ok", message: " hapoalim\n" },
        { title: "scrape-failed", message: "max TIMEOUT" },
        { title: null, message: "hapoalim" },
        { title: "scrape-ok", message: null },
      ]),
    ).toEqual(["hapoalim"]);
  });
});

describe("findStale", () => {
  it("is healthy with a recent scrape-ok", () => {
    expect(
      findStale(
        [HAPOALIM],
        [run("Scrape_Hapoalim", hoursAgo(2), ["hapoalim"])],
        NOW,
        30,
      ),
    ).toEqual([]);
  });

  it("counts a run exactly maxAgeHours old as inside the window", () => {
    expect(
      findStale(
        [HAPOALIM],
        [run("Scrape_Hapoalim", hoursAgo(30), ["hapoalim"])],
        NOW,
        30,
      ),
    ).toEqual([]);
  });

  it("reports no-success with the last success when recent runs all failed", () => {
    const problems = findStale(
      [HAPOALIM],
      [
        run("Scrape_Hapoalim", hoursAgo(5), [], 3),
        run("Scrape_Hapoalim", hoursAgo(17), [], 2),
        run("Scrape_Hapoalim", hoursAgo(50), ["hapoalim"], 1),
      ],
      NOW,
      30,
    );
    expect(problems).toEqual([
      { ...HAPOALIM, reason: "no-success", lastSuccess: hoursAgo(50) },
    ]);
  });

  it("reports no-runs when the workflow has not run in the window", () => {
    const problems = findStale(
      [HAPOALIM],
      [run("Scrape_Hapoalim", hoursAgo(40), ["hapoalim"])],
      NOW,
      30,
    );
    expect(problems).toEqual([
      { ...HAPOALIM, reason: "no-runs", lastSuccess: hoursAgo(40) },
    ]);
  });

  it("does not count another bank's success", () => {
    const problems = findStale(
      [HAPOALIM],
      [run("Scrape_Hapoalim", hoursAgo(2), ["max"])],
      NOW,
      30,
    );
    expect(problems).toEqual([{ ...HAPOALIM, reason: "no-success" }]);
  });

  it("does not let one workflow's success satisfy another workflow with the same bank", () => {
    const cal1 = { workflow: "Scrape_Cal_1", companyId: "visaCal" };
    const cal2 = { workflow: "Scrape_Cal_2", companyId: "visaCal" };
    const problems = findStale(
      [cal1, cal2],
      [run("Scrape_Cal_1", hoursAgo(2), ["visaCal"])],
      NOW,
      30,
    );
    expect(problems).toEqual([{ ...cal2, reason: "no-runs" }]);
  });
});

describe("formatProblem", () => {
  it("names the bank, workflow, window and last success", () => {
    expect(
      formatProblem(
        {
          ...HAPOALIM,
          reason: "no-success",
          lastSuccess: new Date("2026-10-08T10:05:00Z"),
        },
        30,
      ),
    ).toBe(
      "no successful hapoalim scrape (Scrape_Hapoalim) in 30h — last success 2026-10-08 10:05 UTC",
    );
  });

  it("says the workflow has not run, and when nothing succeeded in 7 days", () => {
    expect(formatProblem({ ...HAPOALIM, reason: "no-runs" }, 30)).toBe(
      "Scrape_Hapoalim has had no runs in 30h — last hapoalim success none in the last 7 days",
    );
  });
});

describe("formatSummary", () => {
  it("has one row per expected account with its status", () => {
    const max = { workflow: "Scrape_Max", companyId: "max" };
    const summary = formatSummary(
      [HAPOALIM, max],
      [run("Scrape_Hapoalim", new Date("2026-10-09T10:05:00Z"), ["hapoalim"])],
      [{ ...max, reason: "no-runs" }],
    );
    expect(summary).toContain(
      "| Scrape_Hapoalim | hapoalim | 2026-10-09 10:05 UTC | ok |",
    );
    expect(summary).toContain(
      "| Scrape_Max | max | none in the last 7 days | no runs |",
    );
  });
});
