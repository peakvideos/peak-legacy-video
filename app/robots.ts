import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const noindex = process.env.NEXT_PUBLIC_NOINDEX === "true";

export default function robots(): MetadataRoute.Robots {
  if (noindex) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Always block the admin and API surface from crawlers.
      disallow: ["/admin", "/admin/", "/api/", "/sign-in"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
