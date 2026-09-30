import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kate+ – PoC",
  description: "Proof of concept van een verbeterde digitale assistent (synthetische data).",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers forces dynamic rendering so Next can apply the per-request CSP nonce.
  await headers();
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
