import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import SessionProvider from "@/components/providers/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poppin - Chicago Nightlife Busyness",
  description: "Real-time busyness tracking for Chicago bars, clubs, and latin dance venues. Know before you go.",
  keywords: ["Chicago", "nightlife", "bars", "clubs", "latin dance", "busyness", "crowdsourced"],
  authors: [{ name: "Poppin" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#7c3aed",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Poppin",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <SessionProvider>
          <ServiceWorkerRegistration />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
