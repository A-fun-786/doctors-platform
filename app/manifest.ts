import { MetadataRoute } from "next";
import { BRAND_CONFIG } from "@/config/brand.config";
import { HOSPITAL_THEME_COLORS } from "@/config/theme.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_CONFIG.name,
    short_name: BRAND_CONFIG.name,
    description: BRAND_CONFIG.description,
    start_url: "/",
    display: "standalone",
    background_color: HOSPITAL_THEME_COLORS.hospital.cardBg,
    theme_color: HOSPITAL_THEME_COLORS.brand[600],
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
