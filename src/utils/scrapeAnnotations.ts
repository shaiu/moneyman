import { BooleanEnvVarSchema } from "../config.schema.js";
import type { AccountScrapeResult } from "../types.js";
import { logToPublicLog } from "./logger.js";

/**
 * GitHub workflow-command lines marking each account's scrape outcome, which
 * GitHub turns into run annotations for the scrape watchdog to read back
 * (src/scripts/scrape-watchdog.ts). Only the bank id and the error type: the
 * fork's run pages are public, and errorMessage can carry bank URLs and tokens.
 */
export function scrapeAnnotationLines(
  results: Array<AccountScrapeResult>,
): string[] {
  return results.map(({ companyId, result }) =>
    result.success
      ? `::notice title=scrape-ok::${companyId}`
      : `::warning title=scrape-failed::${companyId} ${result.errorType ?? "GENERIC"}`,
  );
}

/** Writes the lines to the job's stdout, only when MONEYMAN_GITHUB_ANNOTATIONS is set. */
export function writeScrapeAnnotations(
  results: Array<AccountScrapeResult>,
): void {
  if (!BooleanEnvVarSchema.parse(process.env.MONEYMAN_GITHUB_ANNOTATIONS)) {
    return;
  }
  for (const line of scrapeAnnotationLines(results)) {
    logToPublicLog(line);
  }
}
