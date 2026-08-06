import type { Metadata } from "next";
import { Fraunces, Albert_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });
const body = Albert_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "inputtv — comprehensible input, on air",
  description: "Level-matched YouTube immersion for language learners. Watch, and the hours add up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
