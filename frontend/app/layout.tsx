import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DermaTrack | Melanoma Progression & ABCDE Analyzer",
  description: "Evidence-based longitudinal skin lesion tracker for CodeTheCure Hackathon 2026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-teal-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}