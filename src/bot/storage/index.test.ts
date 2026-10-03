import { CompanyTypes } from "israeli-bank-scrapers";
import type { AccountScrapeResult, TransactionStorage } from "../../types.js";
import { transaction } from "../../utils/tests.js";
import { createSaveStats } from "../saveStats.js";
import { exitCode, resetRunOutcome, summary } from "../../utils/runOutcome.js";

const mockSend = jest.fn();
const mockEditMessage = jest.fn();
const mockSendError = jest.fn();
jest.mock("../notifier.js", () => ({
  __esModule: true,
  send: (...a: unknown[]) => mockSend(...a),
  editMessage: (...a: unknown[]) => mockEditMessage(...a),
  sendError: (...a: unknown[]) => mockSendError(...a),
}));
// These storages' SDKs ship ESM that jest's CommonJS transform can't load.
// None is configured in the test config, so a stub that never saves is exact.
const unconfigured = () =>
  class {
    canSave() {
      return false;
    }
  };
jest.mock("./azure-data-explorer.js", () => ({
  AzureDataExplorerStorage: unconfigured(),
}));
jest.mock("./sheets.js", () => ({ GoogleSheetsStorage: unconfigured() }));
jest.mock("../../config.js", () => ({
  config: jest.requireActual("../../utils/tests.js").config(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveResults } = require("./index.js");

function fakeStorage(
  name: string,
  save: TransactionStorage["saveTransactions"],
): TransactionStorage {
  const Storage = class {
    canSave() {
      return true;
    }
    saveTransactions = save;
  };
  Object.defineProperty(Storage, "name", { value: name });
  return new Storage();
}

const ok = (name: string) =>
  fakeStorage(name, async (txns) => createSaveStats(name, "", txns));
const failing = (name: string) =>
  fakeStorage(name, async () => {
    throw new Error(`${name} is down`);
  });

const results: AccountScrapeResult[] = [
  {
    companyId: CompanyTypes.hapoalim,
    result: {
      success: true,
      accounts: [{ accountNumber: "1234", txns: [transaction({})] }],
    },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.MONEYMAN_FAIL_ON_ERROR = "true";
  mockSend.mockResolvedValue({ message_id: 1 });
  mockEditMessage.mockResolvedValue(undefined);
});

afterEach(() => {
  resetRunOutcome();
  delete process.env.MONEYMAN_FAIL_ON_ERROR;
});

describe("saveResults failure recording", () => {
  it("records a storage whose save throws", async () => {
    await saveResults(results, [failing("BadStorage")]);
    expect(exitCode()).toBe(1);
    expect(summary()[0]).toContain("[storage:BadStorage]");
    expect(mockSendError).toHaveBeenCalled();
  });

  it("does not record a storage that saves successfully", async () => {
    await saveResults(results, [ok("GoodStorage")]);
    expect(exitCode()).toBe(0);
  });

  it("records each failing storage when several fail", async () => {
    await saveResults(results, [failing("A"), ok("B"), failing("C")]);
    expect(summary()).toHaveLength(2);
    expect(summary().some((l) => l.includes("[storage:A]"))).toBe(true);
    expect(summary().some((l) => l.includes("[storage:C]"))).toBe(true);
  });

  it("does not record when Telegram fails after a successful save", async () => {
    mockEditMessage.mockRejectedValue(new Error("telegram 500"));
    await saveResults(results, [ok("GoodStorage")]);
    expect(exitCode()).toBe(0);
    expect(mockSendError).toHaveBeenCalled();
  });

  it("records when Telegram fails before the save, so nothing was written", async () => {
    mockSend.mockRejectedValue(new Error("telegram 500"));
    const save = jest.fn();
    await saveResults(results, [fakeStorage("GoodStorage", save)]);
    expect(save).not.toHaveBeenCalled();
    expect(exitCode()).toBe(1);
  });
});
