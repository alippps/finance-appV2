import { FinanceApp } from "@/components/finance-app";
import { createFreshFinanceState } from "@/lib/mock-data";

export default function Home() {
  return <FinanceApp initialState={createFreshFinanceState()} />;
}
