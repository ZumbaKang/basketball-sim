import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, IBM_Plex_Mono } from "next/font/google";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/components/theme";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-loaded",
});

const body = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body-loaded",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: "TIPOFF — Basketball Sim",
  description: "Run your franchise, advance the season, and read every game like a real box score.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07090f" },
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Font variables belong on <html> so the :root aliases in globals.css can see them.
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
