import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { IndicatorRegistryHydrator } from "@/components/providers/IndicatorRegistryHydrator";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Agentic Quant Studio",
  description:
    "Build autonomous AI agents for quantitative research and trading. Research, indicators, strategies, and backtesting in one intelligent studio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans bg-zinc-950 text-zinc-200 antialiased`}
      >
        <QueryProvider>
          <IndicatorRegistryHydrator />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
