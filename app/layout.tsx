import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

import "../styles/globals.css";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

const uiFont = Manrope({
  subsets: ["latin"],
  variable: "--font-ui"
});

export const metadata: Metadata = {
  title: "StudyBuddyGPT",
  description: "AI learning assistant for explanations, quizzes, and flashcards."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${uiFont.variable}`}>
        <div className="theme-toggle-shell">
          <ThemeToggle />
        </div>
        <div className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}
