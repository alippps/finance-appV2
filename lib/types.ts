export type TransactionType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: TransactionType | "both";
  short: string;
  color: string;
};

export type Account = {
  id: string;
  name: string;
  balance: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  title: string;
  categoryId: string;
  accountId: string;
  amount: number;
  date: string;
  note?: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
};

export type AppSettings = {
  displayName: string;
  monthlyTarget: number;
};

export type FinanceState = {
  settings: AppSettings;
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  transactions: Transaction[];
};
