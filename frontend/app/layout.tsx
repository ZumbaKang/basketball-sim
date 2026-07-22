import type { Metadata } from "next";
import { Archivo_Black, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-loaded",
});

const body = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-body-loaded",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: "TIPOFF — Basketball Sim",
  description: "Log in, run your league, and read every game like a real box score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <style>{`
          :root {
            --font-display: var(--font-display-loaded), "Arial Black", sans-serif;
            --font-body: var(--font-body-loaded), Georgia, serif;
            --font-mono: var(--font-mono-loaded), ui-monospace, monospace;
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
