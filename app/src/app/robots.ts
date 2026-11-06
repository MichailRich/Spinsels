import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL ?? "https://politierechter.nl";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/beheer", "/account"] }], sitemap: `${base}/sitemap.xml` };
}
