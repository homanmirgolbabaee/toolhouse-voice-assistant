// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import DocumentServiceErrorBoundary from "@/components/DocumentServiceErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NotesAI - Smart Note Taking",
  description: "A powerful note-taking app with voice input and AI capabilities",
  generator: "Next.js",
  applicationName: "NotesAI",
  keywords: ["Notes", "Productivity", "Voice", "AI", "Notion"],
  authors: [
    {
      name: "Your Name",
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
        <Providers appName="NotesAI" version="1.0.0">
          <DocumentServiceErrorBoundary>
            {children}
          </DocumentServiceErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}