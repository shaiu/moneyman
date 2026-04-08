/**
 * Launches a browser with the configured profile path, waits for you to log in
 * and complete OTP, then exports cookies as JSON to stdout.
 *
 * Usage:
 *   npm run export-cookies -- --url https://www.your-bank.co.il
 *
 * Steps:
 *   1. A browser window opens and navigates to the given URL.
 *   2. Log in manually and complete OTP / 2FA.
 *   3. Press Enter in the terminal when done.
 *   4. Cookies are printed as JSON — save them as a GitHub secret.
 */
import puppeteer from "puppeteer";
import { browserArgs, browserExecutablePath } from "../scraper/browser.js";
import { createInterface } from "readline";

const url = process.argv.find((a, i) => process.argv[i - 1] === "--url");
if (!url) {
  console.error("Usage: npm run export-cookies -- --url <bank-login-url>");
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: false,
  args: browserArgs,
  executablePath: browserExecutablePath,
  ignoreDefaultArgs: ["--enable-automation"],
});

const page = await browser.newPage();
await page.goto(url);

const rl = createInterface({ input: process.stdin, output: process.stderr });
await new Promise<void>((resolve) =>
  rl.question("Log in and complete OTP, then press Enter...", () => {
    rl.close();
    resolve();
  }),
);

const cookies = await page.cookies();
await browser.close();

console.log(JSON.stringify(cookies));
