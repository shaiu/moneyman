import {
  createScraper,
  ScraperOptions,
  ScraperScrapingResult,
} from "israeli-bank-scrapers";
import { AccountConfig } from "../types.js";
import { ScraperErrorTypes } from "israeli-bank-scrapers/lib/scrapers/errors.js";
import { createLogger } from "../utils/logger.js";
import { prepareAccountCredentials } from "./otp.js";
import { saveCookies } from "./cookies.js";

const logger = createLogger("scrape");

export async function getAccountTransactions(
  account: AccountConfig,
  options: ScraperOptions,
  onProgress: (companyId: string, status: string) => void,
): Promise<ScraperScrapingResult> {
  logger(`started`);
  try {
    const scraper = createScraper(options);

    scraper.onProgress(async (companyId, { type }) => {
      logger(`[${companyId}] ${type}`);
      onProgress(companyId, type);

      // Save cookies before pages are closed (during END_SCRAPING event)
      if (type === "END_SCRAPING") {
        console.log("[DEBUG] END_SCRAPING event detected, saving cookies now");
        try {
          const optionsWithContext = options as any;
          if (optionsWithContext.browserContext) {
            const pages = await optionsWithContext.browserContext.pages();
            console.log(
              `[DEBUG] Pages available during END_SCRAPING: ${pages.length}`,
            );
            if (pages.length > 0) {
              console.log(
                `[DEBUG] Saving cookies during scraping for ${companyId}`,
              );
              await saveCookies(pages[0], companyId);
            } else {
              console.log("[DEBUG] No pages available during END_SCRAPING");
            }
          }
        } catch (e) {
          console.log("[DEBUG] Failed to save cookies during scraping:", e);
          logger(`Failed to save cookies during scraping`, e);
        }
      }
    });

    const result = await scraper.scrape({
      ...account,
      ...prepareAccountCredentials(account),
    });

    if (!result.success) {
      logger(`error: ${result.errorType} ${result.errorMessage}`);
    }
    logger(`ended`);

    return result;
  } catch (e) {
    logger(e);
    return {
      success: false,
      errorType: ScraperErrorTypes.Generic,
      errorMessage: String(e),
    };
  }
}
