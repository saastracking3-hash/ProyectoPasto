import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Green Side",
    short_name: "TGS",
    description:
      "Plataforma profesional de mantenimiento de espacios verdes en Buenos Aires",
    start_url: "/",
    display: "standalone",
    theme_color: "#2D6A4F",
    background_color: "#ffffff",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
