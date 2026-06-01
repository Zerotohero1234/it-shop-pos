import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        noir: {
          950: "#040608",
          900: "#07090F",
          800: "#0D1220",
          700: "#131A2E",
          600: "#1A2340",
          500: "#243050",
        },
        amber: {
          DEFAULT: "#F59E0B",
          light: "#FCD34D",
          dark: "#D97706",
          glow: "rgba(245,158,11,0.15)",
        },
        cyan: {
          DEFAULT: "#22D3EE",
          light: "#67E8F9",
          dark: "#0891B2",
          glow: "rgba(34,211,238,0.15)",
        },
        surface: {
          primary: "#0D1220",
          secondary: "#131A2E",
          tertiary: "#1A2340",
          card: "#16202E",
          hover: "#1E2D45",
        },
        text: {
          primary: "#E2E8F0",
          secondary: "#94A3B8",
          muted: "#475569",
          amber: "#F59E0B",
          cyan: "#22D3EE",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.07)",
          hover: "rgba(255,255,255,0.12)",
          amber: "rgba(245,158,11,0.3)",
          cyan: "rgba(34,211,238,0.3)",
        },
        status: {
          success: "#10B981",
          error: "#EF4444",
          warning: "#F59E0B",
          info: "#22D3EE",
          "success-bg": "rgba(16,185,129,0.1)",
          "error-bg": "rgba(239,68,68,0.1)",
          "warning-bg": "rgba(245,158,11,0.1)",
          "info-bg": "rgba(34,211,238,0.1)",
        },
      },
      fontFamily: {
        syne: ["Syne", "sans-serif"],
        lao: ["Noto Sans Lao", "Plus Jakarta Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        amber: "0 0 20px rgba(245,158,11,0.2), 0 0 60px rgba(245,158,11,0.05)",
        "amber-sm": "0 0 10px rgba(245,158,11,0.15)",
        cyan: "0 0 20px rgba(34,211,238,0.2), 0 0 60px rgba(34,211,238,0.05)",
        "cyan-sm": "0 0 10px rgba(34,211,238,0.15)",
        card: "0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05) inset",
        "card-hover":
          "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.07) inset",
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        "noise-overlay": "url('/noise.svg')",
        "amber-gradient":
          "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, transparent 60%)",
        "cyan-gradient":
          "linear-gradient(135deg, rgba(34,211,238,0.1) 0%, transparent 60%)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "slide-in-left": "slideInLeft 0.3s ease forwards",
        "pulse-amber": "pulseAmber 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        pulseAmber: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245,158,11,0)" },
          "50%": { boxShadow: "0 0 0 8px rgba(245,158,11,0.1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
