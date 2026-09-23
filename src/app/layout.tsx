import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "WHITE HORIZON — ANTARCTIC RUN";
const description =
  "빙판 위 질주, 한계에 도전하라! 펭귄과 함께 남극의 장애물을 피하고 점프하며 최고 기록에 도전하는 레트로 아케이드 러닝 게임.";
const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const siteUrl =
  process.env.SITE_URL ||
  (deploymentHost
    ? `https://${deploymentHost}`
    : `http://localhost:${process.env.PORT || "3000"}`);
const shareImage = {
  url: "/og.png",
  width: 1731,
  height: 909,
  alt: "WHITE HORIZON — ANTARCTIC RUN: 펭귄이 남극의 빙판 위에서 장애물을 향해 달리는 픽셀 아트",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: title,
    title,
    description,
    images: [{ ...shareImage, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
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
