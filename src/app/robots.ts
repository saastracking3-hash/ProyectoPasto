import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://thegreenside.com.ar";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/crew",
        "/dashboard",
        "/servicios",
        "/presupuestos",
        "/perfil",
        "/solicitar",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
