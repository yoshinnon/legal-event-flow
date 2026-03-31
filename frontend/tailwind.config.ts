import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        },
      },
      keyframes: {
        "slide-up": {
          "0%":   { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    typography,
  ],
} satisfies Config;
