/**
 * Scrape watchdog: exits 1 when an expected account has had no successful
 * scrape within MAX_AGE_HOURS, so GitHub emails a failed run. It reads the
 * `scrape-ok` annotations moneyman writes on each scrape run
 * (src/utils/scrapeAnnotations.ts).
 *
 * Node runs this file directly (built-in type stripping, no build), so it
 * imports only node: modules and uses only erasable TypeScript.
 */

export interface Expected {
  workflow: string;
  companyId: string;
}

export interface Observation {
  workflow: string;
  runId: number;
  createdAt: Date;
  oks: string[];
}

export interface Problem {
  workflow: string;
  companyId: string;
  reason: "no-runs" | "no-success";
  lastSuccess?: Date;
}

export interface Annotation {
  title?: string | null;
  message?: string | null;
}

const HOUR_MS = 3_600_000;

/** Parses `Workflow_Name: companyId` lines; blank lines and # comments are ignored. */
export function parseExpected(text: string): Expected[] {
  const expected: Expected[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([^:\s]+)\s*:\s*([^:\s]+)$/.exec(line);
    if (!match) {
      throw new Error(
        `Malformed EXPECTED line: "${line}" (want "Workflow_Name: companyId")`,
      );
    }
    expected.push({ workflow: match[1], companyId: match[2] });
  }
  if (expected.length === 0) {
    throw new Error("EXPECTED lists no accounts");
  }
  return expected;
}

export function parseMaxAgeHours(value: string | undefined): number {
  const hours = Number(value);
  if (!value?.trim() || !Number.isFinite(hours) || hours <= 0) {
    throw new Error(`MAX_AGE_HOURS must be a positive number, got "${value}"`);
  }
  return hours;
}

/** The companyIds a run marked as scraped successfully. */
export function oksFromAnnotations(annotations: Annotation[]): string[] {
  const oks: string[] = [];
  for (const a of annotations) {
    const companyId = a.message?.trim();
    if (a.title === "scrape-ok" && companyId) oks.push(companyId);
  }
  return oks;
}

function lastSuccess(
  e: Expected,
  observations: Observation[],
): Date | undefined {
  let latest: Date | undefined;
  for (const o of observations) {
    if (
      o.workflow === e.workflow &&
      o.oks.includes(e.companyId) &&
      (!latest || o.createdAt > latest)
    ) {
      latest = o.createdAt;
    }
  }
  return latest;
}

export function findStale(
  expected: Expected[],
  observations: Observation[],
  now: Date,
  maxAgeHours: number,
): Problem[] {
  const since = now.getTime() - maxAgeHours * HOUR_MS;
  const problems: Problem[] = [];
  for (const e of expected) {
    const recent = observations.filter(
      (o) => o.workflow === e.workflow && o.createdAt.getTime() >= since,
    );
    if (recent.some((o) => o.oks.includes(e.companyId))) continue;
    const problem: Problem = {
      ...e,
      reason: recent.length === 0 ? "no-runs" : "no-success",
    };
    const last = lastSuccess(e, observations);
    if (last) problem.lastSuccess = last;
    problems.push(problem);
  }
  return problems;
}

function formatTime(date: Date | undefined): string {
  return date
    ? `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`
    : "none in the last 7 days";
}

export function formatProblem(problem: Problem, maxAgeHours: number): string {
  const { workflow, companyId, reason, lastSuccess } = problem;
  return reason === "no-runs"
    ? `${workflow} has had no runs in ${maxAgeHours}h — last ${companyId} success ${formatTime(lastSuccess)}`
    : `no successful ${companyId} scrape (${workflow}) in ${maxAgeHours}h — last success ${formatTime(lastSuccess)}`;
}

/** Markdown for $GITHUB_STEP_SUMMARY: every expected account and its status. */
export function formatSummary(
  expected: Expected[],
  observations: Observation[],
  problems: Problem[],
): string {
  const rows = expected.map((e) => {
    const problem = problems.find(
      (p) => p.workflow === e.workflow && p.companyId === e.companyId,
    );
    const status = !problem
      ? "ok"
      : problem.reason === "no-runs"
        ? "no runs"
        : "no success";
    return `| ${e.workflow} | ${e.companyId} | ${formatTime(lastSuccess(e, observations))} | ${status} |`;
  });
  return [
    "## Scrape watchdog",
    "",
    "| Workflow | Bank | Last success | Status |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}
