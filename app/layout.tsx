import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Escala MOPS",
  description: "Escala MOPS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
