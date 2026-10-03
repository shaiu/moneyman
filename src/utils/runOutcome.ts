import { BooleanEnvVarSchema } from "../config.schema.js";
import { formatUnknownError } from "./utils.js";

/**
 * Remembers whether this run failed, so the process can exit non-zero and
 * GitHub can alert. Only failures that mean data was not saved, or the run
 * crashed, are recorded — a single bank's failed login is not.
 */
const failures: Array<{ source: string; message: string }> = [];

export function recordFailure(source: string, error: unknown): void {
  failures.push({ source, message: formatUnknownError(error) });
}

export function summary(): string[] {
  return failures.map((f) => `run failure [${f.source}]: ${f.message}`);
}

/** 1 only when MONEYMAN_FAIL_ON_ERROR is enabled and something failed. */
export function exitCode(): 0 | 1 {
  const enabled = BooleanEnvVarSchema.parse(process.env.MONEYMAN_FAIL_ON_ERROR);
  return enabled && failures.length > 0 ? 1 : 0;
}

/** Test-only: clear recorded failures between cases. */
export function resetRunOutcome(): void {
  failures.length = 0;
}
