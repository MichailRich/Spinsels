import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#14263D", 50: "#EEF2F7", 100: "#D7E0EB", 200: "#AFC0D6", 300: "#7F98B8", 400: "#4F6E95", 500: "#2D4A6E", 600: "#1F3754", 700: "#14263D", 800: "#0E1B2C", 900: "#08111C" },
        gold: { DEFAULT: "#C3A46B", 50: "#FAF6EE", 100: "#F2E9D6", 200: "#E5D3AE", 300: "#D6BC88", 400: "#C3A46B", 500: "#A9884E", 600: "#86693A" },
        mist: "#F4F6F8",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Source Serif Pro", "Iowan Old Style", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(20,38,61,.06), 0 4px 16px rgba(20,38,61,.06)" },
    },
  },
  plugins: [],
} satisfies Config;
