import type { MetadataRoute } from "next";
import { allowIndexing, siteUrl } from "./site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return allowIndexing ? [{ url: new URL("/", siteUrl).href }] : [];
}
