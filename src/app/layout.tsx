import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WHITE HORIZON — ANTARCTIC RUN",
  description: "남극을 달리는 펭귄의 웹 아케이드 게임.",
};

export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
