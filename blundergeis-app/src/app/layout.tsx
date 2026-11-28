import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlunderGeist",
  description: "Turn your GitHub PRs into chess game reviews. Score commits with Brilliant, Best, and Blunder badges.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
