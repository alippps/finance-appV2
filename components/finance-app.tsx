"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, loginFinance, logoutFinance, registerFinance, syncFinanceState, type AuthUser } from "@/lib/api";
import { formatDate, money, monthKey, monthLabel } from "@/lib/format";
import { createFreshFinanceState } from "@/lib/mock-data";
import type { Account, Budget, Category, FinanceState, Transaction, TransactionType } from "@/lib/types";

type View = "dashboard" | "transactions" | "add" | "budgets" | "reports" | "settings";
type ModalState = {
  badge: string;
  title: string;
  message: string;
  body?: React.ReactNode;
  actions?: React.ReactNode;
};

const navItems: Array<{ view: View; code: string; label: string; mobile: string }> = [
  { view: "dashboard", code: "01", label: "Dasbor", mobile: "Dasbor" },
  { view: "transactions", code: "02", label: "Transaksi", mobile: "Riwayat" },
  { view: "add", code: "03", label: "Catat", mobile: "Catat" },
  { view: "budgets", code: "04", label: "Anggaran", mobile: "Budget" },
  { view: "reports", code: "05", label: "Laporan", mobile: "Laporan" },
  { view: "settings", code: "06", label: "Setelan", mobile: "Setelan" }
];

const legacySessionStorageKey = "financeos:session";
const stateStoragePrefix = "financeos:state:";

export function FinanceApp({ initialState }: { initialState: FinanceState }) {
  const [state, setState] = useState(initialState);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [activeMonth, setActiveMonth] = useState(monthKey());
  const [activeType, setActiveType] = useState<TransactionType>("expense");
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  const categoriesById = useMemo(() => mapById(state.categories), [state.categories]);
  const accountsById = useMemo(() => mapById(state.accounts), [state.accounts]);
  const monthTransactions = useMemo(
    () => state.transactions.filter((transaction) => transaction.date.startsWith(activeMonth)),
    [state.transactions, activeMonth]
  );
  const monthTotals = useMemo(() => totals(monthTransactions), [monthTransactions]);
  const allTotals = useMemo(() => totals(state.transactions), [state.transactions]);
  const savingRate = monthTotals.income ? Math.round((monthTotals.balance / monthTotals.income) * 100) : 0;

  useEffect(() => {
    let isCancelled = false;

    async function restoreSession() {
      removeStorage(legacySessionStorageKey);
      const user = await getCurrentUser();
      if (isCancelled) return;

      if (user?.username) {
        const savedState = readStorage<FinanceState>(financeStateStorageKey(user.username));
        setCurrentUser(user);
        setState(savedState || { ...initialState, settings: { ...initialState.settings, displayName: user.username } });
        setIsAuthenticated(true);
      }

      setHasRestoredSession(true);
    }

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [initialState]);

  useEffect(() => {
    if (!hasRestoredSession || !isAuthenticated || !currentUser?.username) return;
    writeStorage(financeStateStorageKey(currentUser.username), state);
  }, [currentUser, hasRestoredSession, isAuthenticated, state]);

  function updateState(next: FinanceState) {
    setState(next);
    setSyncStatus("idle");
  }

  function shiftMonth(delta: number) {
    const [year, month] = activeMonth.split("-").map(Number);
    setActiveMonth(monthKey(new Date(year, month - 1 + delta, 1)));
  }

  function editTransaction(id: string) {
    const item = state.transactions.find((transaction) => transaction.id === id);
    if (!item) return;
    setEditingId(id);
    setActiveType(item.type);
    setView("add");
  }

  function upsertTransaction(formData: FormData) {
    const title = String(formData.get("title") || "").trim();
    const amount = Number(formData.get("amount"));
    const date = String(formData.get("date") || "");
    const categoryId = String(formData.get("categoryId") || "");
    const accountId = String(formData.get("accountId") || "");
    const note = String(formData.get("note") || "").trim();
    if (!title || !amount || amount <= 0 || !date || !categoryId || !accountId) return;

    const payload: Transaction = {
      id: editingId || crypto.randomUUID(),
      type: activeType,
      title,
      amount,
      date,
      categoryId,
      accountId,
      note
    };

    const next = {
      ...state,
      transactions: editingId
        ? state.transactions.map((transaction) => (transaction.id === editingId ? payload : transaction))
        : [payload, ...state.transactions]
    };
    updateState(next);
    setActiveMonth(payload.date.slice(0, 7));
    setEditingId(null);
    setModal({
      badge: "OK",
      title: editingId ? "Transaksi diperbarui" : "Transaksi tersimpan",
      message: `${payload.title} masuk ke catatan ${monthLabel(payload.date.slice(0, 7))}.`,
      actions: (
        <>
          <button className="btn" onClick={() => setModal(null)}>Tutup</button>
          <button className="btn primary" onClick={() => { setModal(null); setView("transactions"); }}>Riwayat</button>
        </>
      )
    });
  }

  function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    upsertTransaction(new FormData(event.currentTarget));
  }

  function deleteTransaction(id: string) {
    updateState({ ...state, transactions: state.transactions.filter((transaction) => transaction.id !== id) });
    setModal(null);
  }

  function saveBudget(formData: FormData) {
    const categoryId = String(formData.get("categoryId") || "");
    const limit = Number(formData.get("limit"));
    if (!categoryId || limit <= 0) return;
    const existing = state.budgets.find((budget) => budget.categoryId === categoryId && budget.month === activeMonth);
    const budgets = existing
      ? state.budgets.map((budget) => budget.id === existing.id ? { ...budget, limit } : budget)
      : [{ id: crypto.randomUUID(), categoryId, month: activeMonth, limit }, ...state.budgets];
    updateState({ ...state, budgets });
    setModal(null);
  }

  function handleBudgetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveBudget(new FormData(event.currentTarget));
  }

  async function syncNow() {
    setSyncStatus("syncing");
    try {
      const next = await syncFinanceState(state);
      setState(next);
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }
  }

  function saveSettings(formData: FormData) {
    updateState({
      ...state,
      settings: {
        displayName: String(formData.get("displayName") || "User").trim(),
        monthlyTarget: Number(formData.get("monthlyTarget")) || 0
      }
    });
    setModal({ badge: "OK", title: "Setelan tersimpan", message: "Target dan nama tampilan sudah diperbarui." });
  }

  function handleSettingsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSettings(new FormData(event.currentTarget));
  }

  async function login(formData: FormData) {
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    setLoginError("");
    setIsLoggingIn(true);
    try {
      const user = await loginFinance(username, password);
      const savedState = readStorage<FinanceState>(financeStateStorageKey(user.username));
      updateState(savedState || { ...state, settings: { ...state.settings, displayName: user.username } });
      setCurrentUser(user);
      setIsAuthenticated(true);
      setView("dashboard");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login gagal");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function register(formData: FormData) {
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    setLoginError("");
    if (password !== confirmPassword) {
      setLoginError("Konfirmasi password tidak sama.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const user = await registerFinance(username, password);
      const freshState = createFreshFinanceState(user.username);
      updateState(freshState);
      setCurrentUser(user);
      writeStorage(financeStateStorageKey(user.username), freshState);
      setActiveMonth(monthKey());
      setSearch("");
      setFilter("all");
      setEditingId(null);
      setIsAuthenticated(true);
      setView("dashboard");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Gagal membuat akun");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function requestLogout() {
    setModal({
      badge: "OUT",
      title: "Keluar aplikasi?",
      message: "Kalau pilih Yes, sesi ditutup dan kamu balik ke halaman login.",
      actions: (
        <>
          <button className="btn" onClick={() => setModal(null)}>No</button>
          <button className="btn danger" onClick={confirmLogout}>Yes</button>
        </>
      )
    });
  }

  async function confirmLogout() {
    await logoutFinance().catch(() => undefined);
    setView("dashboard");
    setSearch("");
    setFilter("all");
    setEditingId(null);
    setModal(null);
    setLoginError("");
    setCurrentUser(null);
    removeStorage(legacySessionStorageKey);
    setIsAuthenticated(false);
  }

  function requestResetData() {
    setModal({
      badge: "RST",
      title: "Reset semua data?",
      message: "Transaksi, budget, dan saldo akun akan dikosongkan. Kategori tetap disimpan supaya kamu bisa mulai catat lagi.",
      actions: (
        <>
          <button className="btn" onClick={() => setModal(null)}>Batal</button>
          <button className="btn danger" onClick={confirmResetData}>Reset data</button>
        </>
      )
    });
  }

  function confirmResetData() {
    updateState(createFreshFinanceState(state.settings.displayName));
    setActiveMonth(monthKey());
    setSearch("");
    setFilter("all");
    setEditingId(null);
    setView("dashboard");
    setModal(null);
  }

  const pageTitle = navItems.find((item) => item.view === view)?.label || "FinanceOS";

  if (!hasRestoredSession) {
    return (
      <main className="login-screen">
        <section className="login-panel card">
          <div className="login-content">
            <p className="kicker">FinanceOS</p>
            <h2>Memuat sesi...</h2>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        error={loginError}
        isLoading={isLoggingIn}
        onLogin={login}
        onRegister={register}
      />
    );
  }

  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => setView("dashboard")}>
            <span className="brand-mark">F</span>
            <span>
              <strong>FinanceOS</strong>
            </span>
          </button>

          <nav className="side-nav" aria-label="Navigasi utama">
            {navItems.map((item) => (
              <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => setView(item.view)}>
                <span className="nav-code">{item.code}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <section className="side-card">
            <p className="kicker">Bulan aktif</p>
            <strong>{monthLabel(activeMonth)}</strong>
            <p className="muted">Saldo {money(monthTotals.balance, true)}</p>
            <p className="muted">Masuk {money(monthTotals.income, true)} · Keluar {money(monthTotals.expense, true)}</p>
          </section>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="page-heading">
              <p className="kicker">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <h1>{pageTitle}</h1>
              <p className="welcome-text">Selamat datang, {state.settings.displayName}</p>
            </div>
            <div className="top-actions">
              <div className="month-control" aria-label="Pilih bulan">
                <button className="month-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya">
                  <span className="month-arrow" aria-hidden="true">{"<"}</span>
                  <span className="month-btn-label">Sebelumnya</span>
                </button>
                <input className="input month-input" type="month" value={activeMonth} onChange={(event) => setActiveMonth(event.target.value)} aria-label="Bulan aktif" />
                <button className="month-nav-btn" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya">
                  <span className="month-btn-label">Berikutnya</span>
                  <span className="month-arrow" aria-hidden="true">{">"}</span>
                </button>
              </div>
              <button className="btn" onClick={syncNow}>{syncStatus === "syncing" ? "Sync..." : syncStatus === "synced" ? "Synced" : "Sinkron"}</button>
              <button className="btn danger" onClick={requestLogout}>Keluar</button>
            </div>
          </header>

          {view === "dashboard" && renderDashboard()}
          {view === "transactions" && renderTransactions()}
          {view === "add" && renderForm()}
          {view === "budgets" && renderBudgets()}
          {view === "reports" && renderReports()}
          {view === "settings" && renderSettings()}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {navItems.map((item) => (
          <button key={item.view} className={`mobile-item ${item.view === "add" ? "add" : ""} ${view === item.view ? "active" : ""}`} onClick={() => setView(item.view)}>
            {item.mobile}
          </button>
        ))}
      </nav>

      {modal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setModal(null)}>
          <section className="card modal">
            <div className="modal-head">
              <span className="avatar modal-badge">{modal.badge}</span>
              <div>
                <h2>{modal.title}</h2>
                <p>{modal.message}</p>
              </div>
            </div>
            {modal.body}
            <div className="modal-actions">
              {modal.actions || <button className="btn primary" onClick={() => setModal(null)}>Oke</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );

  function renderDashboard() {
    const budgetLimit = state.budgets.filter((budget) => budget.month === activeMonth).reduce((sum, budget) => sum + budget.limit, 0);
    const budgetPct = budgetLimit ? Math.round((monthTotals.expense / budgetLimit) * 100) : 0;
    const recent = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    return (
      <>
        <div className="grid cards-3">
          <Metric label="Pemasukan" value={money(monthTotals.income)} note={`${monthTransactions.filter((item) => item.type === "income").length} transaksi masuk`} tone="positive" />
          <Metric label="Pengeluaran" value={money(monthTotals.expense)} note={`${monthTransactions.filter((item) => item.type === "expense").length} transaksi keluar`} tone="negative" />
          <Metric label="Saldo bulan ini" value={money(monthTotals.balance)} note={`${savingRate}% rasio tabungan`} tone="warning" />
        </div>

        <div className="grid dashboard-grid dashboard-stack">
          <div className="grid">
            <section className="card pad">
              <div className="section-head">
                <div>
                  <p className="kicker">Performa</p>
                  <h2>Tren 6 bulan</h2>
                  <p className="section-note">Perbandingan pemasukan dan pengeluaran per bulan.</p>
                </div>
                <div className="legend"><span><i className="dot income" />Masuk</span><span><i className="dot expense" />Keluar</span></div>
              </div>
              <Bars activeMonth={activeMonth} transactions={state.transactions} />
            </section>
            <section className="card pad">
              <div className="section-head">
                <div>
                  <p className="kicker">Terbaru</p>
                  <h2>Aktivitas transaksi</h2>
                  <p className="section-note">Transaksi paling baru di bulan aktif.</p>
                </div>
                <button className="btn" onClick={() => setView("transactions")}>Lihat semua</button>
              </div>
              <div className="list">{recent.length ? recent.map(row) : <Empty text="Belum ada transaksi bulan ini" />}</div>
            </section>
          </div>
          <div className="grid">
            <section className="card pad">
              <div className="section-head">
                <div>
                  <p className="kicker">Anggaran</p>
                  <h2>{budgetPct}% terpakai</h2>
                  <p className="section-note">{money(monthTotals.expense)} dari {money(budgetLimit)}</p>
                </div>
              </div>
              <Progress value={budgetPct} />
            </section>
            <section className="card pad">
              <div className="section-head">
                <div>
                  <p className="kicker">Kategori</p>
                  <h2>Pengeluaran terbesar</h2>
                  <p className="section-note">Kategori dengan porsi pengeluaran tertinggi.</p>
                </div>
              </div>
              <div className="list">{categoryBreakdown().length ? categoryBreakdown().map(categoryRow) : <Empty text="Belum ada pengeluaran" />}</div>
            </section>
            <section className="card pad">
              <div className="section-head">
                <div>
                  <p className="kicker">Aset</p>
                  <h2>Saldo akun</h2>
                  <p className="section-note">Ringkasan saldo manual tiap akun.</p>
                </div>
              </div>
              <div className="list">{state.accounts.map(accountRow)}</div>
            </section>
          </div>
        </div>
      </>
    );
  }

  function renderTransactions() {
    const filtered = state.transactions
      .filter((item) => filter === "all" || item.type === filter)
      .filter((item) => {
        const q = search.toLowerCase();
        const category = categoriesById[item.categoryId]?.name || "";
        const account = accountsById[item.accountId]?.name || "";
        return [item.title, category, account, item.note].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    const filteredTotals = totals(filtered);

    return (
      <>
        <div className="summary-strip">
          <Summary label="Total masuk" value={money(filteredTotals.income)} tone="positive" />
          <Summary label="Total keluar" value={money(filteredTotals.expense)} tone="negative" />
          <Summary label="Net" value={money(filteredTotals.balance)} />
          <Summary label="Jumlah data" value={String(filtered.length)} />
        </div>
        <section className="card pad">
          <div className="filters">
            <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kategori, akun..." />
            {(["all", "income", "expense"] as const).map((item) => (
              <button key={item} className={`chip ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
                {item === "all" ? "Semua" : item === "income" ? "Masuk" : "Keluar"}
              </button>
            ))}
            <button className="btn primary" onClick={() => { setEditingId(null); setView("add"); }}>Tambah</button>
          </div>
          <div className="list">{filtered.length ? filtered.map(row) : <Empty text="Tidak ada transaksi yang cocok" />}</div>
        </section>
      </>
    );
  }

  function renderForm() {
    const editing = editingId ? state.transactions.find((transaction) => transaction.id === editingId) : null;
    const type = editing?.type || activeType;
    const categories = state.categories.filter((category) => category.type === type || category.type === "both");

    return (
      <section className="card pad">
        <div className="section-head">
          <div>
            <p className="kicker">{editing ? "Edit data" : "Input baru"}</p>
            <h2>{editing ? "Ubah transaksi" : "Catat transaksi"}</h2>
          </div>
        </div>
        <div className="type-tabs">
          <button className={`chip ${activeType === "expense" ? "active" : ""}`} onClick={() => setActiveType("expense")}>Pengeluaran</button>
          <button className={`chip ${activeType === "income" ? "active" : ""}`} onClick={() => setActiveType("income")}>Pemasukan</button>
        </div>
        <form onSubmit={handleTransactionSubmit}>
          <div className="form-grid two">
            <Field label="Nama transaksi"><input className="input" name="title" defaultValue={editing?.title || ""} required placeholder="Contoh: Makan siang" /></Field>
            <Field label="Jumlah"><input className="input" name="amount" type="number" min="1" step="1" defaultValue={editing?.amount || ""} required placeholder="0" /></Field>
          </div>
          <div className="form-grid three" style={{ marginTop: 10 }}>
            <Field label="Tanggal"><input className="input" name="date" type="date" defaultValue={editing?.date || new Date().toISOString().slice(0, 10)} required /></Field>
            <Field label="Kategori">
              <select className="select" name="categoryId" defaultValue={editing?.categoryId || categories[0]?.id}>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Akun">
              <select className="select" name="accountId" defaultValue={editing?.accountId || state.accounts[0]?.id}>
                {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Catatan"><textarea className="textarea" name="note" defaultValue={editing?.note || ""} placeholder="Opsional" /></Field>
          </div>
          <div className="modal-actions">
            {editing && <button className="btn" type="button" onClick={() => setEditingId(null)}>Batal edit</button>}
            <button className="btn primary" type="submit">{editing ? "Simpan perubahan" : "Simpan transaksi"}</button>
          </div>
        </form>
      </section>
    );
  }

  function renderBudgets() {
    const expenseCategories = state.categories.filter((category) => category.type !== "income");
    const activeBudgets = state.budgets.filter((budget) => budget.month === activeMonth);

    return (
      <div className="grid dashboard-grid">
        <section className="card pad">
          <div className="section-head">
            <div>
              <p className="kicker">Kontrol budget</p>
              <h2>Limit per kategori</h2>
            </div>
            <button className="btn primary" onClick={() => setModal({
              badge: "BG",
              title: "Tambah anggaran",
              message: "Masukkan kategori dan limit bulanan.",
              body: (
                <form id="budget-form" onSubmit={handleBudgetSubmit}>
                  <div className="form-grid two">
                    <Field label="Kategori">
                      <select className="select" name="categoryId">
                        {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Limit"><input className="input" name="limit" type="number" min="1" step="1" required /></Field>
                  </div>
                </form>
              ),
              actions: <><button className="btn" onClick={() => setModal(null)}>Batal</button><button className="btn primary" type="submit" form="budget-form">Simpan</button></>
            })}>Tambah</button>
          </div>
          <div className="list">{activeBudgets.map(budgetRow)}</div>
        </section>
        <section className="card pad">
          <div className="section-head">
            <div>
              <p className="kicker">Target</p>
              <h2>Tabungan bulanan</h2>
              <p className="section-note">Target {money(state.settings.monthlyTarget)}</p>
            </div>
          </div>
          <Progress value={Math.round(Math.max(0, monthTotals.balance) / Math.max(1, state.settings.monthlyTarget) * 100)} />
        </section>
      </div>
    );
  }

  function renderReports() {
    const top = categoryBreakdown()[0];
    const avgExpense = Math.round(allTotals.expense / Math.max(1, new Set(state.transactions.map((item) => item.date.slice(0, 7))).size));
    const globalSavingRate = allTotals.income ? Math.round((allTotals.balance / allTotals.income) * 100) : 0;

    return (
      <>
        <div className="grid cards-3">
          <Metric label="Net worth akun" value={money(state.accounts.reduce((sum, account) => sum + account.balance, 0))} note="Total saldo manual" tone="warning" />
          <Metric label="Rata-rata keluar" value={money(avgExpense)} note="Berdasarkan bulan berdata" tone="negative" />
          <Metric label="Saving rate" value={`${globalSavingRate}%`} note="Semua transaksi" tone="positive" />
        </div>
        <section className="card pad" style={{ marginTop: 14 }}>
          <div className="section-head">
            <div>
              <p className="kicker">Insight</p>
              <h2>Ringkasan keputusan</h2>
            </div>
          </div>
          <div className="list">
            <Insight title="Arus kas bulan ini" text={monthTotals.balance >= 0 ? `Surplus ${money(monthTotals.balance)}. Ruang tabungan masih positif.` : `Defisit ${money(Math.abs(monthTotals.balance))}. Perlu tekan pengeluaran variabel.`} tone={monthTotals.balance >= 0 ? "positive" : "negative"} />
            <Insight title="Kategori dominan" text={top ? `${top.category.name} menjadi pengeluaran terbesar dengan ${money(top.amount)}.` : "Belum ada kategori pengeluaran bulan ini."} tone="warning" />
            <Insight title="Mobile ready" text="Navigasi bawah, layout ringkas, dan PWA manifest sudah disiapkan untuk layar mobile." tone="positive" />
          </div>
        </section>
      </>
    );
  }

  function renderSettings() {
    return (
      <div className="settings-grid">
        <section className="card pad">
          <div className="section-head">
            <div>
              <p className="kicker">Preferensi</p>
              <h2>Profil & target</h2>
              <p className="section-note">Atur nama tampilan dan target tabungan bulanan.</p>
            </div>
          </div>
          <form onSubmit={handleSettingsSubmit}>
            <div className="form-grid two">
              <Field label="Nama"><input className="input" name="displayName" defaultValue={state.settings.displayName} /></Field>
              <Field label="Target tabungan"><input className="input" name="monthlyTarget" type="number" min="0" step="1" defaultValue={state.settings.monthlyTarget} /></Field>
            </div>
            <div className="form-footer"><button className="btn primary">Simpan setelan</button></div>
          </form>
        </section>
        <section className="card pad">
          <div className="section-head">
            <div>
              <p className="kicker">Akun & data</p>
              <h2>Penyimpanan</h2>
              <p className="section-note">Akun login tersimpan di PostgreSQL. Data kerja bisa disinkronkan atau dikosongkan dari sini.</p>
            </div>
          </div>
          <div className="settings-summary">
            <div>
              <span className="label">User aktif</span>
              <strong>{state.settings.displayName}</strong>
            </div>
            <div>
              <span className="label">Status sinkron</span>
              <strong>{syncStatus === "syncing" ? "Menyinkronkan" : syncStatus === "synced" ? "Tersimpan" : syncStatus === "error" ? "Gagal" : "Belum disinkron"}</strong>
            </div>
          </div>
          <div className="action-list">
            <button className="btn" onClick={syncNow}>Sinkron sekarang</button>
            <button className="btn danger" onClick={requestResetData}>Reset data</button>
            <button className="btn danger" onClick={requestLogout}>Keluar aplikasi</button>
          </div>
        </section>
      </div>
    );
  }

  function row(item: Transaction) {
    const category = categoriesById[item.categoryId];
    const account = accountsById[item.accountId];
    const sign = item.type === "income" ? "+" : "-";
    return (
      <article className="tx-row" key={item.id}>
        <span className="avatar" style={{ background: `${category?.color || "#98a4b7"}22`, color: category?.color }}>{category?.short || "TX"}</span>
        <div className="row-main">
          <strong>{item.title}</strong>
          <span className="meta">{category?.name || "-"} / {account?.name || "-"} / {formatDate(item.date)}</span>
        </div>
        <span className={`amount ${item.type === "income" ? "positive" : "negative"}`}>{sign}{money(item.amount, true)}</span>
        <div className="row-actions">
          <button className="mini-btn" onClick={() => editTransaction(item.id)}>E</button>
          <button className="mini-btn" onClick={() => setModal({
            badge: "DL",
            title: "Hapus transaksi?",
            message: `${item.title} senilai ${money(item.amount)} akan dihapus.`,
            actions: <><button className="btn" onClick={() => setModal(null)}>Batal</button><button className="btn danger" onClick={() => deleteTransaction(item.id)}>Hapus</button></>
          })}>X</button>
        </div>
      </article>
    );
  }

  function accountRow(account: Account) {
    return (
      <article className="account-row" key={account.id}>
        <span className="avatar">{account.name.slice(0, 2).toUpperCase()}</span>
        <div className="row-main">
          <strong>{account.name}</strong>
          <span className="meta">{money(account.balance)}</span>
        </div>
      </article>
    );
  }

  function budgetRow(budget: Budget) {
    const category = categoriesById[budget.categoryId];
    const spent = monthTransactions.filter((transaction) => transaction.type === "expense" && transaction.categoryId === budget.categoryId).reduce((sum, transaction) => sum + transaction.amount, 0);
    const pct = Math.round(spent / Math.max(1, budget.limit) * 100);
    return (
      <article className="budget-row" key={budget.id}>
        <span className="avatar" style={{ background: `${category?.color || "#98a4b7"}22`, color: category?.color }}>{category?.short || "BG"}</span>
        <div className="row-main">
          <strong>{category?.name}</strong>
          <span className="meta">{money(spent)} dari {money(budget.limit)}</span>
          <Progress value={pct} />
        </div>
        <span className={`amount ${pct > 100 ? "negative" : pct > 75 ? "warning" : "positive"}`}>{pct}%</span>
      </article>
    );
  }

  function categoryBreakdown() {
    const expenses = monthTransactions.filter((transaction) => transaction.type === "expense");
    const map = expenses.reduce<Record<string, number>>((acc, transaction) => {
      acc[transaction.categoryId] = (acc[transaction.categoryId] || 0) + transaction.amount;
      return acc;
    }, {});
    return Object.entries(map)
      .map(([categoryId, amount]) => ({ category: categoriesById[categoryId], amount }))
      .filter((item): item is { category: Category; amount: number } => Boolean(item.category))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  function categoryRow(item: { category: Category; amount: number }) {
    const pct = Math.round(item.amount / Math.max(1, monthTotals.expense) * 100);
    return (
      <article className="budget-row" key={item.category.id}>
        <span className="avatar" style={{ background: `${item.category.color}22`, color: item.category.color }}>{item.category.short}</span>
        <div className="row-main">
          <strong>{item.category.name}</strong>
          <span className="meta">{money(item.amount)} dari pengeluaran</span>
          <Progress value={pct} />
        </div>
        <span className="amount negative">{pct}%</span>
      </article>
    );
  }
}

function LoginScreen({
  error,
  isLoading,
  onLogin,
  onRegister
}: {
  error: string;
  isLoading: boolean;
  onLogin: (formData: FormData) => void | Promise<void>;
  onRegister: (formData: FormData) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const isRegister = mode === "register";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (isRegister) {
      onRegister(formData);
      return;
    }
    onLogin(formData);
  }

  return (
    <main className="login-screen">
      <section className="login-panel card">
        <div className="login-showcase">
          <div className="brand login-brand">
            <span className="brand-mark">F</span>
            <span>
              <strong>FinanceOS</strong>
            </span>
          </div>
          <div>
            <p className="kicker">Personal finance</p>
            <h1>Kelola uang harian dengan lebih rapi.</h1>
            <p className="login-copy">Pantau pemasukan, pengeluaran, budget, dan saldo akun dalam satu workspace ringan.</p>
          </div>
        </div>
        <div className="login-content">
          <p className="kicker">{isRegister ? "Buat akun" : "Masuk aplikasi"}</p>
          <h2>{isRegister ? "Mulai akun baru" : "Selamat datang "}</h2>
          <p className="login-copy">{isRegister ? "Jangan Beritahu Account anda pada siapapun" : "Login dengan akun yang terdaftar."}</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <Field label="Username">
              <input className="input" name="username" placeholder="Masukkan username" autoComplete="username" autoFocus required />
            </Field>
            <Field label="Password">
              <input className="input" name="password" type="password" placeholder="Masukkan password" autoComplete={isRegister ? "new-password" : "current-password"} required />
            </Field>
            {isRegister ? (
              <Field label="Konfirmasi password">
                <input className="input" name="confirmPassword" type="password" placeholder="Ulangi password" autoComplete="new-password" required />
              </Field>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn primary" type="submit" disabled={isLoading}>
              {isLoading ? "Memproses..." : isRegister ? "Buat akun" : "Masuk"}
            </button>
            <button className="link-btn" type="button" disabled={isLoading} onClick={() => setMode(isRegister ? "login" : "register")}>
              {isRegister ? "Sudah punya akun? Masuk" : "Belum punya akun? Buat akun"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <section className="card pad metric">
      <span>{label}</span>
      <div>
        <strong className={tone}>{value}</strong>
        <small className="meta">{note}</small>
      </div>
    </section>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="summary-item">
      <small>{label}</small>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const tone = pct > 90 ? "high" : pct > 70 ? "mid" : "";
  return <div className="progress"><span className={tone} style={{ width: `${pct}%` }} /></div>;
}

function Insight({ title, text, tone }: { title: string; text: string; tone: string }) {
  return (
    <article className="insight-row">
      <span className={`avatar ${tone}`}>{tone === "negative" ? "!" : tone === "warning" ? "i" : "ok"}</span>
      <div className="row-main">
        <strong>{title}</strong>
        <span className="meta">{text}</span>
      </div>
    </article>
  );
}

function Bars({ activeMonth, transactions }: { activeMonth: string; transactions: Transaction[] }) {
  const [year, month] = activeMonth.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 6 + index, 1);
    const key = monthKey(date);
    const total = totals(transactions.filter((transaction) => transaction.date.startsWith(key)));
    return { key, label: monthLabel(key, { month: "short" }), ...total };
  });
  const max = Math.max(1, ...months.flatMap((item) => [item.income, item.expense]));

  return (
    <div className="bars">
      {months.map((item) => (
        <div className="bar-col" key={item.key}>
          <div className="bar-pair">
            <span className="bar income" style={{ height: Math.max(4, item.income / max * 170) }} />
            <span className="bar expense" style={{ height: Math.max(4, item.expense / max * 170) }} />
          </div>
          <span className="bar-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function totals(transactions: Transaction[]) {
  const income = transactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = transactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
  return { income, expense, balance: income - expense };
}

function mapById<T extends { id: string }>(items: T[]) {
  return Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, T>;
}

function financeStateStorageKey(username: string) {
  return `${stateStoragePrefix}${username}`;
}

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode or when quota is full; the app still works in memory.
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures so logout can still complete.
  }
}
