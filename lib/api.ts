import { initialFinanceState } from "./mock-data";
import type { FinanceState } from "./types";

export type AuthUser = {
  id: number;
  username: string;
};

export async function getFinanceState(): Promise<FinanceState> {
  const res = await fetch("/api/finance", { cache: "no-store" });
  if (!res.ok) return initialFinanceState;
  return res.json();
}

export async function loginFinance(username: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Login gagal");
  return data.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data.user || null;
}

export async function registerFinance(username: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Gagal membuat akun");
  return data.user;
}

export async function logoutFinance(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function syncFinanceState(payload: FinanceState): Promise<FinanceState> {
  const res = await fetch("/api/finance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("Gagal sinkron data");
  return res.json();
}
