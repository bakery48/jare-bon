import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "じゃれ本",
  description: "みんなでつくる、不思議なリレー小説",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
