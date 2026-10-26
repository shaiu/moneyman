// moneyman launches full Chrome (headless: true), never chrome-headless-shell,
// so skip downloading it. The copy pinned by israeli-bank-scrapers' bundled
// puppeteer unpacks with extract-zip 2.0.1, which silently stops after two
// files on Node 26 and leaves a folder that fails every later `npm ci`.
/** @type {import("puppeteer").Configuration} */
module.exports = {
  "chrome-headless-shell": { skipDownload: true },
};
