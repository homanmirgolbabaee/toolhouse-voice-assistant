import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toolhouse Assistant",
  description: "Voice and chat interface for Toolhouse AI assistant",
  generator: "Next.js",
  applicationName: "Toolhouse Assistant",
  keywords: ["AI", "Voice", "Chat", "Assistant", "Toolhouse"],
  authors: [
    {
      name: "Toolhouse Team",
    },
  ],
  viewport: "width=device-width, initial-scale=1",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
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
        <Providers appName="Toolhouse Assistant" version="1.1.0">
          {children}
        </Providers>
      </body>
    </html>
  );
}