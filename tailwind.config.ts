import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noir: "#0B0B0D",
        ink: "#141417",
        surface: "#1A1A1E",
        elevated: "#202026",
        ivory: "#F4EFE6",
        muted: "#9A958C",
        champagne: {
          DEFAULT: "#C2A56A",
          light: "#D8C18E",
          dark: "#9E834C",
        },
        line: "rgba(194,165,106,0.18)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        luxe: "0.22em",
      },
      boxShadow: {
        luxe: "0 24px 60px -24px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        "gold-line": "linear-gradient(90deg, transparent, rgba(194,165,106,0.6), transparent)",
      },
    },
  },
  plugins: [],
};
export default config;
