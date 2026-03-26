import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saatgut",
  description: "Self-hosted seed-bank and cultivation journal MVP scaffold.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
