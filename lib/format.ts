export function money(value: number, compact = false) {
  if (compact) return compactMoney(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value).replace("IDR", "Rp");
}

export function compactMoney(value = 0) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000000000) return `${sign}Rp ${(abs / 1000000000).toFixed(1)}M`;
  if (abs >= 1000000) return `${sign}Rp ${(abs / 1000000).toFixed(1)}jt`;
  if (abs >= 1000) return `${sign}Rp ${Math.round(abs / 1000)}rb`;
  return `${sign}Rp ${abs}`;
}

export function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string, options: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" }) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", options);
}
