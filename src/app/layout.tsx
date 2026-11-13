import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Dolly Zoom Generator | Hitchcock Vertigo Effect from One Photo",
  description:
    "Turn one photo into a Hitchcock vertigo (dolly zoom) short video in seconds. Upload a portrait, get a cinematic AI dolly zoom clip. Try free with watermark; HD from $1.49.",
  keywords: [
    "dolly zoom",
    "hitchcock zoom",
    "vertigo effect",
    "AI video generator",
    "image to video",
    "cinematic zoom",
  ],
  openGraph: {
    title: "AI Dolly Zoom Generator",
    description:
      "Turn one photo into a Hitchcock vertigo shot in seconds. AI image-to-video dolly zoom.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Dolly Zoom Generator",
    description:
      "Turn one photo into a Hitchcock vertigo shot in seconds.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
