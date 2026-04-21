import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

/** Same source as `next.config.ts` `basePath` — must match for manifest / icons on GitHub Pages. */
const assetPrefix = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

function withAssetPrefix(path: string): string {
  return `${assetPrefix}${path}`;
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#18181b",
};

export const metadata: Metadata = {
  title: "Anki2 Card Creator",
  description: "Anki2 tooling: paste JSON and create cards",
  manifest: withAssetPrefix("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    title: "Anki2 Card Creator",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: withAssetPrefix("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withAssetPrefix("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: withAssetPrefix("/icon-192.png"), sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
