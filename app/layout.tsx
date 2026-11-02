import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono, Special_Gothic_Expanded_One } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const brand = Special_Gothic_Expanded_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-brand",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Kyuwing — the UP BadAss queue board",
    template: "%s · Kyuwing",
  },
  description:
    "Fair, fast badminton queueing for UP BadAss game days. Auto-balanced pairings, arrival-based queues, court scheduling, player levels, and fee reports.",
  keywords: ["badminton", "queue", "UP BadAss", "UP Badminton Association", "court management", "Kyuwing"],
  authors: [{ name: "Danyel Regalario" }],
  creator: "Danyel Regalario",
  openGraph: {
    title: "Kyuwing — the UP BadAss queue board",
    description: "Queue less. Play more. Fair, fast game-day queueing for UP BadAss.",
    type: "website",
    locale: "en_PH",
    siteName: "Kyuwing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kyuwing — the UP BadAss queue board",
    description: "Queue less. Play more. Fair, fast game-day queueing for UP BadAss.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${brand.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-cream text-ink min-h-screen">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#0a0a0a",
              color: "#fbfaf5",
              border: "1px solid #3b3b36",
              borderRadius: "14px",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
