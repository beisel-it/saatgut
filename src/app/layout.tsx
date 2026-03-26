import type { Metadata } from "next";

import { I18nProvider } from "@/components/i18n-provider";
import { DEFAULT_LOCALE, messages } from "@/lib/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: messages[DEFAULT_LOCALE].meta.title,
  description: messages[DEFAULT_LOCALE].meta.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
