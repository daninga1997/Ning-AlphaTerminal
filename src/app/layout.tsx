import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AStock Terminal",
  description: "A 股深圳主板交易观察网页 UI 框架",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full dark antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
