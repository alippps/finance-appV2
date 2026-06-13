import type { FinanceState, TransactionType } from "./types";

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

export const initialFinanceState: FinanceState = {
  settings: {
    displayName: "Alif",
    monthlyTarget: 2500000
  },
  categories: [
    category("cat-gaji", "Gaji", "income", "GJ", "#42d392"),
    category("cat-bonus", "Bonus", "income", "BN", "#6ea8fe"),
    category("cat-investasi", "Investasi", "income", "IV", "#9a8cff"),
    category("cat-freelance", "Freelance", "income", "FR", "#f8b84e"),
    category("cat-makanan", "Makanan", "expense", "MK", "#ff8b5f"),
    category("cat-transport", "Transport", "expense", "TR", "#6ea8fe"),
    category("cat-rumah", "Rumah", "expense", "RM", "#9a8cff"),
    category("cat-tagihan", "Tagihan", "expense", "TG", "#f8b84e"),
    category("cat-belanja", "Belanja", "expense", "BJ", "#ff6b6b"),
    category("cat-hiburan", "Hiburan", "expense", "HB", "#42d392"),
    category("cat-kesehatan", "Kesehatan", "expense", "KS", "#63d6ff"),
    category("cat-lainnya", "Lainnya", "both", "LN", "#98a4b7")
  ],
  accounts: [
    { id: "acc-cash", name: "Cash", balance: 950000 },
    { id: "acc-bank", name: "Bank Utama", balance: 8750000 },
    { id: "acc-wallet", name: "E-Wallet", balance: 1250000 },
    { id: "acc-invest", name: "Investasi", balance: 6200000 }
  ],
  budgets: [
    { id: "budget-food", categoryId: "cat-makanan", month: currentMonth, limit: 1400000 },
    { id: "budget-transport", categoryId: "cat-transport", month: currentMonth, limit: 650000 },
    { id: "budget-shopping", categoryId: "cat-belanja", month: currentMonth, limit: 900000 },
    { id: "budget-entertainment", categoryId: "cat-hiburan", month: currentMonth, limit: 500000 },
    { id: "budget-bills", categoryId: "cat-tagihan", month: currentMonth, limit: 900000 }
  ],
  transactions: [
    tx("tx-1", "income", "Gaji bulanan", "cat-gaji", "acc-bank", 8500000, 1),
    tx("tx-2", "income", "Freelance landing page", "cat-freelance", "acc-bank", 1800000, 4),
    tx("tx-3", "expense", "Groceries mingguan", "cat-makanan", "acc-cash", 460000, 5),
    tx("tx-4", "expense", "Bayar listrik", "cat-tagihan", "acc-bank", 330000, 7),
    tx("tx-5", "expense", "Transport online", "cat-transport", "acc-wallet", 190000, 9),
    tx("tx-6", "expense", "Langganan streaming", "cat-hiburan", "acc-bank", 159000, 10),
    tx("tx-7", "income", "Bonus project", "cat-bonus", "acc-bank", 2200000, 12),
    tx("tx-8", "expense", "Makan siang kantor", "cat-makanan", "acc-wallet", 285000, 14),
    tx("tx-9", "expense", "Beli kemeja", "cat-belanja", "acc-bank", 375000, 15),
    tx("tx-10", "expense", "Vitamin", "cat-kesehatan", "acc-cash", 135000, 16),
    tx("tx-11", "income", "Dividen saham", "cat-investasi", "acc-invest", 760000, 18)
  ]
};

export function createFreshFinanceState(displayName = "User"): FinanceState {
  return {
    settings: {
      displayName,
      monthlyTarget: initialFinanceState.settings.monthlyTarget
    },
    categories: initialFinanceState.categories.map((category) => ({ ...category })),
    accounts: initialFinanceState.accounts.map((account) => ({ ...account, balance: 0 })),
    budgets: [],
    transactions: []
  };
}

function category(id: string, name: string, type: TransactionType | "both", short: string, color: string) {
  return { id, name, type, short, color };
}

function tx(
  id: string,
  type: TransactionType,
  title: string,
  categoryId: string,
  accountId: string,
  amount: number,
  day: number
) {
  return {
    id,
    type,
    title,
    categoryId,
    accountId,
    amount,
    date: `${currentMonth}-${String(day).padStart(2, "0")}`,
    note: ""
  };
}
