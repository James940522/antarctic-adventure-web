export const siteName = "WHITE HORIZON — ANTARCTIC RUN";
export const siteTitle = `${siteName} | 남극 펭귄 러닝 게임`;
export const siteDescription =
  "빙판 위 질주, 한계에 도전하라! 설치 없이 브라우저에서 즐기는 남극 펭귄 러닝 게임. 장애물을 피하고 점프하며 최고 기록과 온라인 랭킹에 도전하세요. PC 키보드·게임패드와 모바일 터치를 지원합니다.";

const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const siteUrl = new URL(
  process.env.SITE_URL ||
    (deploymentHost
      ? `https://${deploymentHost}`
      : `http://localhost:${process.env.PORT || "3000"}`),
);

export const allowIndexing =
  process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

export const shareImage = {
  url: new URL("/og.png", siteUrl).href,
  width: 1731,
  height: 909,
  alt: "WHITE HORIZON — ANTARCTIC RUN: 펭귄이 남극의 빙판 위에서 장애물을 향해 달리는 픽셀 아트",
};
