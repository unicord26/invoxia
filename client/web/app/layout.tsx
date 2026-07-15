import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Invoixe — GST Billing & Accounting",
  description: "Billing, accounting & inventory for Indian SMEs.",
  icons: {
    icon: "/logos.png",
    shortcut: "/logos.png",
    apple: "/logos.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
