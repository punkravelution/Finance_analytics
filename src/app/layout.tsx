import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { AiAssistant } from "@/components/AiAssistant";
import { tryTakeSnapshot } from "@/app/actions/snapshot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Финансовый аналитик",
  description: "Личный финансовый аналитик — учёт капитала, активов и операций",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await tryTakeSnapshot();

  return (
    <html lang="ru" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-[hsl(224,71%,4%)]">
            {children}
          </main>
        </div>
        <AiAssistant />
      </body>
    </html>
  );
}
