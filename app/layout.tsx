import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceOS",
  description: "Dashboard pencatat keuangan pribadi",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#080a0f",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
