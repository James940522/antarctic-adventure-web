import type { MetadataRoute } from "next";
import { allowIndexing, siteUrl } from "./site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    // Allow crawling so development/preview pages can expose their noindex tag.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: allowIndexing ? new URL("/sitemap.xml", siteUrl).href : undefined,
  };
}
