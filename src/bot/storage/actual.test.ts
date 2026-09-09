import { transactionRow, config } from "../../utils/tests.js";
import type { MoneymanConfig } from "../../config.js";
import { TransactionStatuses } from "israeli-bank-scrapers/lib/transactions.js";

const mockLog = jest.fn();
jest.mock("../../utils/logger.js", () => ({
  createLogger: () => mockLog,
}));

const mockInit = jest.fn();
const mockDownloadBudget = jest.fn();
const mockGetAccounts = jest.fn();
const mockGetPayees = jest.fn();
const mockImportTransactions = jest.fn();
const mockShutdown = jest.fn();

jest.mock("@actual-app/api", () => ({
  init: (...args: unknown[]) => mockInit(...args),
  downloadBudget: (...args: unknown[]) => mockDownloadBudget(...args),
  getAccounts: (...args: unknown[]) => mockGetAccounts(...args),
  getPayees: (...args: unknown[]) => mockGetPayees(...args),
  importTransactions: (...args: unknown[]) => mockImportTransactions(...args),
  shutdown: (...args: unknown[]) => mockShutdown(...args),
  utils: { amountToInteger: (n: number) => Math.round(n * 100) },
}));

// Import after the mocks are registered so the module under test picks up the
// mocked SDK.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ActualBudgetStorage } = require("./actual.js");

const mkConfig = (accounts: Record<string, string>): MoneymanConfig => {
  const cfg = config();
  cfg.storage = {
    actual: {
      serverUrl: "http://actual.test",
      password: "test-password",
      budgetId: "test-sync-id",
      accounts,
    },
  };
  return cfg;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInit.mockResolvedValue(undefined);
  mockDownloadBudget.mockResolvedValue(undefined);
  mockShutdown.mockResolvedValue(undefined);
  mockGetAccounts.mockResolvedValue([
    { id: "actual-hapoalim-uuid", name: "Hapoalim" },
    { id: "actual-cal8339-uuid", name: "Cal8339" },
    { id: "actual-cal7299-uuid", name: "Cal7299" },
  ]);
  mockGetPayees.mockResolvedValue([
    { id: "grocer-payee", name: "Grocer" },
    {
      id: "cal8339-transfer-payee",
      name: "Transfer: Cal8339",
      transfer_acct: "actual-cal8339-uuid",
    },
    {
      id: "cal7299-transfer-payee",
      name: "Transfer: Cal7299",
      transfer_acct: "actual-cal7299-uuid",
    },
  ]);
  mockImportTransactions.mockResolvedValue({
    added: [],
    updated: [],
    errors: [],
  });
});

describe("ActualBudgetStorage transfer routing by identifier", () => {
  const fullConfig = () =>
    mkConfig({
      "hapoalim-acct": "actual-hapoalim-uuid",
      "8339": "actual-cal8339-uuid",
      "7299": "actual-cal7299-uuid",
    });

  const sentTransactions = () => mockImportTransactions.mock.calls[0][1];

  it("routes a transaction as a transfer when tx.identifier matches another configured account", async () => {
    const storage = new ActualBudgetStorage(fullConfig());
    await storage.saveTransactions(
      [
        transactionRow({
          account: "hapoalim-acct",
          identifier: "8339",
          description: "כאל",
          chargedAmount: -2310.58,
          status: TransactionStatuses.Completed,
        }),
      ],
      async () => {},
    );

    const sent = sentTransactions();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      account: "actual-hapoalim-uuid",
      payee: "cal8339-transfer-payee",
    });
    // Transfers set payee only; payee_name must be absent so Actual derives
    // the display name from the transfer target.
    expect(sent[0].payee_name).toBeUndefined();
  });

  it("routes the second Cal card to its own account, not the first", async () => {
    const storage = new ActualBudgetStorage(fullConfig());
    await storage.saveTransactions(
      [
        transactionRow({
          account: "hapoalim-acct",
          identifier: "7299",
          description: "כאל",
          chargedAmount: -1645.0,
          status: TransactionStatuses.Completed,
        }),
      ],
      async () => {},
    );

    expect(sentTransactions()[0]).toMatchObject({
      payee: "cal7299-transfer-payee",
    });
  });

  it("sends a normal transaction when tx.identifier is missing", async () => {
    const storage = new ActualBudgetStorage(fullConfig());
    await storage.saveTransactions(
      [
        transactionRow({
          account: "hapoalim-acct",
          identifier: undefined,
          description: "כאל",
          status: TransactionStatuses.Completed,
        }),
      ],
      async () => {},
    );

    const sent = sentTransactions();
    expect(sent[0].payee).toBeUndefined();
    expect(sent[0].payee_name).toBe("כאל");
  });

  it("sends a normal transaction when tx.identifier matches no configured account", async () => {
    const storage = new ActualBudgetStorage(fullConfig());
    await storage.saveTransactions(
      [
        transactionRow({
          account: "hapoalim-acct",
          identifier: "9999",
          description: "כאל",
          status: TransactionStatuses.Completed,
        }),
      ],
      async () => {},
    );

    const sent = sentTransactions();
    expect(sent[0].payee).toBeUndefined();
    expect(sent[0].payee_name).toBe("כאל");
  });

  it("does not self-transfer when tx.identifier resolves to the source account", async () => {
    const storage = new ActualBudgetStorage(fullConfig());
    await storage.saveTransactions(
      [
        transactionRow({
          account: "8339",
          identifier: "8339",
          description: "כאל",
          status: TransactionStatuses.Completed,
        }),
      ],
      async () => {},
    );

    const sent = sentTransactions();
    expect(sent[0].payee).toBeUndefined();
    expect(sent[0].payee_name).toBe("כאל");
  });

  it("logs a debug line when a transaction is routed as a transfer", async () => {
    const storage = new ActualBudgetStorage(fullConfig());
    await storage.saveTransactions(
      [
        transactionRow({
          account: "hapoalim-acct",
          identifier: "8339",
          description: "כאל",
          status: TransactionStatuses.Completed,
        }),
      ],
      async () => {},
    );

    expect(
      mockLog.mock.calls.find(
        (args) =>
          typeof args[0] === "string" &&
          args[0].includes("routing tx as transfer"),
      ),
    ).toBeDefined();
  });
});
