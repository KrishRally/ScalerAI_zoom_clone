import type { Config } from "tailwindcss";

// Colors picked to match the Zoom Workplace web app.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zoom: {
          blue: "#0B5CFF",
          "blue-hover": "#0A4FDB",
          "blue-light": "#EBF1FF",
          orange: "#FF742E",
          "orange-hover": "#F0631C",
          ink: "#131619",
          text: "#232333",
          muted: "#6E7680",
          border: "#E4E6EB",
          surface: "#F7F8FA",
          red: "#E02828",
          "red-hover": "#C51F1F",
          green: "#00C853",
          speaking: "#23D959",
        },
        room: {
          bg: "#0F0F0F",
          tile: "#262626",
          toolbar: "#1A1A1A",
          panel: "#FFFFFF",
          hover: "#2E2E2E",
        },
      },
      fontFamily: {
        sans: ["var(--font-lato)", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(19, 22, 25, 0.06), 0 1px 2px rgba(19, 22, 25, 0.04)",
        pop: "0 8px 24px rgba(19, 22, 25, 0.16)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float-up": {
          "0%": { opacity: "0", transform: "translateY(0) scale(0.6)" },
          "15%": { opacity: "1", transform: "translateY(-10px) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-80px) scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.18s ease-out",
        "float-up": "float-up 2.5s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
