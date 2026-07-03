import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import Topbar from "@/components/layout/top-bar";
import { Skeleton } from "@/registry/avail-widgets/ui/skeleton";
const Web3Provider = dynamic(() => import("@/providers/Web3Provider"), {
  loading: () => <Skeleton className="w-full h-full" />,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://elements.nexus.availproject.org";

export const metadata: Metadata = {
  title: "Avail Widgets",
  description: "Prebuilt React components powered by Avail Nexus",
  authors: [{ name: "decocereus", url: "https://github.com/decocereus" }],
  metadataBase: new URL(APP_URL),
  icons: {
    icon: [
      { url: "/avail-fav.svg", media: "(prefers-color-scheme: light)" },
      { url: "/dark-avail-fav.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Avail Widgets",
    title: "Avail Widgets",
    description: "Prebuilt React components powered by Avail Nexus",
    images: [
      {
        url: "/1200x630.png",
        width: 1200,
        height: 630,
        alt: "Avail Widgets",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@decocereus",
    site: APP_URL,
    title: "Avail Widgets",
    description: "Prebuilt React components powered by Avail Nexus",
    images: [
      {
        url: "/1200x630.png",
        alt: "Avail Widgets",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Web3Provider>
            <Topbar />
            {children}
          </Web3Provider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
