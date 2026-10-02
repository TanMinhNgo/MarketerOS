import type { Metadata } from "next";
import { Be_Vietnam_Pro, Sora } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const body = Be_Vietnam_Pro({ variable: "--font-body", subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "500", "600", "700"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "MarketOS",
  description: "AI assistant for solo marketers: every tool is an app on your desktop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${sora.variable} h-full`}>
      <body className="h-full">
        <ClerkProvider>
          <Providers>
            <TooltipProvider>{children}</TooltipProvider>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
