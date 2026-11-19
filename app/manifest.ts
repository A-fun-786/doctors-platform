import { MetadataRoute } from "next";
import { BRAND_CONFIG } from "@/config/brand.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_CONFIG.name,
    short_name: BRAND_CONFIG.name,
    description: BRAND_CONFIG.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0284c7",
    icons: [
      {
        src: BRAND_CONFIG.assets.icon192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: BRAND_CONFIG.assets.icon512,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
