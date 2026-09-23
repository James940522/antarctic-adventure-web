import type { Metadata, Viewport } from "next";
import {
  allowIndexing,
  shareImage,
  siteDescription,
  siteName,
  siteTitle,
  siteUrl,
} from "./site-metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: siteTitle,
  description: siteDescription,
  applicationName: siteName,
  category: "games",
  alternates: { canonical: "/" },
  robots: {
    index: allowIndexing,
    follow: true,
    googleBot: {
      index: allowIndexing,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.NAVER_SITE_VERIFICATION
      ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION }
      : undefined,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName,
    title: siteTitle,
    description: siteDescription,
    images: [{ ...shareImage, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [shareImage],
  },
};

export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
