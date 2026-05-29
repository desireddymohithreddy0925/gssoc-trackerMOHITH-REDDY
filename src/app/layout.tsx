import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://gssoc-tracker.vercel.app"),
  title: {
    default: "GSSoC 2026 PR Tracker | Community Leaderboard",
    template: "%s | GSSoC PR Tracker",
  },
  description:
    "An independent community PR tracker for GirlScript Summer of Code 2026. Discover top open-source contributors, search profiles, view PR stats, and monitor live rankings. Built by Prodhosh.",
  keywords: [
    "GSSoC",
    "GSSoC 2026",
    "GSSoC PR Tracker",
    "GirlScript Summer of Code",
    "Open Source",
    "Unofficial Leaderboard",
    "Prodhosh",
    "GitHub PR Tracker",
  ],
  authors: [{ name: "Prodhosh", url: "https://github.com/prodhosh-iitm" }],
  creator: "Prodhosh",
  publisher: "Prodhosh",
  openGraph: {
    title: "GSSoC 2026 PR Tracker | Built by Prodhosh",
    description: "Track your open-source journey, monitor PR stats, and see where you stand among GSSoC 2026 contributors. Unofficial community tool.",
    type: "website",
    url: "https://gssoc-tracker.vercel.app",
    siteName: "GSSoC PR Tracker",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "GSSoC PR Tracker Open Graph Image",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "GSSoC 2026 PR Tracker",
    description: "An independent community PR tracker for GSSoC 2026 contributors. Built by Prodhosh.",
    images: ["/opengraph-image.png"],
    creator: "@prodhosh",
  },
  alternates: {
    canonical: "https://gssoc-tracker.vercel.app",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "UaoSRKAHIpDzT6sD0-yziuiyGSNpEyp9RaDEA009Vcs",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "GSSoC PR Tracker",
    "url": "https://gssoc-tracker.vercel.app",
    "description": "Independent community PR tracker for GirlScript Summer of Code 2026.",
    "applicationCategory": "DeveloperApplication",
    "author": {
      "@type": "Person",
      "name": "Prodhosh",
      "url": "https://github.com/prodhosh-iitm"
    }
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        {children}
        <Script
          id="schema-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CLKFW028BD"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CLKFW028BD');
        `}</Script>
      </body>
    </html>
  );
}
