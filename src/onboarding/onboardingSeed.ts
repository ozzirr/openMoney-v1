import { withTransaction } from "@/db/db";
import { createWallet, listWallets, DEFAULT_WALLET_COLOR } from "@/repositories/walletsRepo";
import { createExpenseCategory, listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import { getInitialSeedDone, setInitialSeedDone } from "@/onboarding/onboardingStorage";

const CATEGORY_COLOR = "#9B7BFF";
const DEFAULT_CATEGORIES = ["Casa", "Spesa", "Trasporti", "Svago", "Salute", "Abbonamenti"];

type WalletForm = {
  name: string;
  balance: string;
};

type InvestmentWalletForm = WalletForm & {
  id: string;
};

type RecurringIncomeForm = {
  name: string;
  amount: string;
  frequency: "monthly";
  nextDate: string;
  walletName: string;
};

type OnboardingExpenseForm = {
  id: string;
  title: string;
  amount: string;
  category: string;
  wallet: string;
  date: string;
  recurring: boolean;
  nextDate: string;
};

type OnboardingDraft = {
  liquidityWallet: WalletForm;
  hasInvestments: boolean;
  investmentWallets: InvestmentWalletForm[];
  categories: string[];
  customCategories: string[];
  recurringIncome: RecurringIncomeForm;
  expenses: OnboardingExpenseForm[];
};

function parseNumber(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString().split("T")[0];
    }
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export async function seedOnboardingData(draft: OnboardingDraft): Promise<void> {
  await withTransaction(async (db) => {
    const tablesToClear = ["expense_entries", "income_entries", "wallets", "expense_categories"];
    for (const table of tablesToClear) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    const walletIds: Record<string, number> = {};
    const createWalletRecord = async (name: string, type: "LIQUIDITY" | "INVEST") => {
      const cleaned = name.trim() || (type === "LIQUIDITY" ? "Conto principale" : "Investimento");
      const result = await db.runAsync(
        "INSERT INTO wallets (name, type, currency, tag, active, color) VALUES (?, ?, 'EUR', NULL, 1, ?)",
        [cleaned, type, DEFAULT_WALLET_COLOR]
      );
      walletIds[cleaned] = result.lastInsertRowId ?? 0;
      return cleaned;
    };

    const liquidityName = await createWalletRecord(draft.liquidityWallet.name, "LIQUIDITY");
    for (const wallet of draft.investmentWallets) {
      await createWalletRecord(wallet.name, "INVEST");
    }
    const categories = Array.from(
      new Set(
        draft.categories
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );
    if (!categories.length) {
      categories.push("Altro");
    }
    const categoryIds: Record<string, number> = {};
    for (const category of categories) {
      const result = await db.runAsync(
        "INSERT INTO expense_categories (name, color, active) VALUES (?, ?, 1)",
        [category, CATEGORY_COLOR]
      );
      categoryIds[category] = result.lastInsertRowId ?? 0;
    }

    const recurringAmount = parseNumber(draft.recurringIncome.amount);
    if (recurringAmount === null || recurringAmount <= 0) {
      throw new Error("Importo entrata ricorrente non valido");
    }
    const recurringWallet =
      walletIds[draft.recurringIncome.walletName.trim()] ?? walletIds[liquidityName];
    await db.runAsync(
      `INSERT INTO income_entries
       (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id)
       VALUES (?, ?, ?, 'MONTHLY', 1, 0, NULL, 1, ?)`,
      [
        draft.recurringIncome.name.trim() || "Stipendio",
        recurringAmount,
        normalizeDate(draft.recurringIncome.nextDate),
        recurringWallet,
      ]
    );

    for (const expense of draft.expenses) {
      const amount = parseNumber(expense.amount);
      if (amount === null || amount <= 0) continue;
      const cleanedCategory = expense.category.trim() || categories[0];
      const categoryId = categoryIds[cleanedCategory] ?? categoryIds[categories[0]];
      const cleanedWallet = expense.wallet.trim() || liquidityName;
      const expenseWalletId = walletIds[cleanedWallet] ?? walletIds[liquidityName];
      const recurrenceFrequency = expense.recurring ? "MONTHLY" : null;
      const recurrenceInterval = expense.recurring ? 1 : null;
      const oneShot = expense.recurring ? 0 : 1;
      await db.runAsync(
        `INSERT INTO expense_entries
         (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id, expense_category_id)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
        [
          expense.title.trim() || "Spesa",
          amount,
          normalizeDate(expense.date),
          recurrenceFrequency,
          recurrenceInterval,
          oneShot,
          expenseWalletId,
          categoryId,
        ]
      );
    }
  });
}

export async function seedInitialData({ hasInvestments }: { hasInvestments: boolean }): Promise<void> {
  const alreadySeeded = await getInitialSeedDone();
  if (alreadySeeded) return;

  try {
    const wallets = await listWallets();
    if (wallets.length === 0) {
      await createWallet("Liquidità", "LIQUIDITY", "EUR", "Liquidità", 1);
      if (hasInvestments) {
        await createWallet("Investimenti", "INVEST", "EUR", "Investimenti", 1);
      }
    }

    const categories = await listExpenseCategories();
    if (categories.length === 0) {
      for (const name of DEFAULT_CATEGORIES) {
        await createExpenseCategory(name, CATEGORY_COLOR);
      }
    }

    await setInitialSeedDone(true);
  } catch (error) {
    console.warn("Failed to seed initial data:", error);
  }
}
