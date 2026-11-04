import type { Config } from "tailwindcss";
import { HOSPITAL_THEME_COLORS } from "./config/theme.config";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: HOSPITAL_THEME_COLORS.brand,
        hospital: {
          navy: HOSPITAL_THEME_COLORS.hospital.navy,
          navyDark: HOSPITAL_THEME_COLORS.hospital.navyDark,
          cyan: HOSPITAL_THEME_COLORS.hospital.cyan,
          surface: HOSPITAL_THEME_COLORS.hospital.surfaceBg,
          card: HOSPITAL_THEME_COLORS.hospital.cardBg,
          border: HOSPITAL_THEME_COLORS.hospital.border,
          borderDark: HOSPITAL_THEME_COLORS.hospital.borderDark,
          textMain: HOSPITAL_THEME_COLORS.hospital.textMain,
          textMuted: HOSPITAL_THEME_COLORS.hospital.textMuted,
          textSubtle: HOSPITAL_THEME_COLORS.hospital.textSubtle,
        },
      },
    },
  },
  plugins: [],
};

export default config;
