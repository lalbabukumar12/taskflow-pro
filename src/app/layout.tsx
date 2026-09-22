import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TaskFlow Pro - Modern Agile Task & Project Hub",
  description:
    "TaskFlow Pro is a full-stack, AI-ready project workflow management system built with Next.js App Router, TypeScript, Tailwind CSS, MongoDB, and @dnd-kit.",
};

import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
