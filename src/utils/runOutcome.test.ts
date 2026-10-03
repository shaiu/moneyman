import {
  exitCode,
  recordFailure,
  resetRunOutcome,
  summary,
} from "./runOutcome.js";

const FLAG = "MONEYMAN_FAIL_ON_ERROR";

afterEach(() => {
  resetRunOutcome();
  delete process.env[FLAG];
});

describe("runOutcome", () => {
  it("exits 0 when the flag is unset, even after a failure", () => {
    recordFailure("storage:X", new Error("boom"));
    expect(exitCode()).toBe(0);
  });

  it("exits 0 when the flag is set and nothing failed", () => {
    process.env[FLAG] = "true";
    expect(exitCode()).toBe(0);
  });

  it("exits 1 when the flag is set and something failed", () => {
    process.env[FLAG] = "true";
    recordFailure("storage:X", new Error("boom"));
    expect(exitCode()).toBe(1);
  });

  it.each(["TRUE", "1"])("treats %s as enabled", (value) => {
    process.env[FLAG] = value;
    recordFailure("run", new Error("boom"));
    expect(exitCode()).toBe(1);
  });

  it.each(["false", "0", "yes", ""])("treats %p as disabled", (value) => {
    process.env[FLAG] = value;
    recordFailure("run", new Error("boom"));
    expect(exitCode()).toBe(0);
  });

  it("summarises each failure with its source, including non-Error values", () => {
    recordFailure("storage:A", new Error("a broke"));
    recordFailure("run", "plain string");
    const lines = summary();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("[storage:A]");
    expect(lines[0]).toContain("a broke");
    expect(lines[1]).toContain("[run]");
    expect(lines[1]).toContain("plain string");
  });
});
