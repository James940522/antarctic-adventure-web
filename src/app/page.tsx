import { GameShell } from "@/components/game/GameShell";
import { shareImage, siteDescription, siteName, siteUrl } from "./site-metadata";

const gameStructuredData = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: siteName,
  description: siteDescription,
  url: new URL("/", siteUrl).href,
  image: shareImage.url,
  inLanguage: "ko",
  genre: ["Arcade", "Action"],
  gamePlatform: "Web browser",
  playMode: "https://schema.org/SinglePlayer",
  isAccessibleForFree: true,
};

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(gameStructuredData).replace(/</g, "\\u003c"),
        }}
      />
      <GameShell />
    </main>
  );
}
