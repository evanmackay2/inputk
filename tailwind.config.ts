import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171021", // deep plum-black, page background
        surface: "#221A2E", // cards
        raised: "#2C2239", // hover / raised cards
        line: "#3A2F49", // hairlines
        lamp: "#FFB454", // tungsten amber — the projector lamp accent
        "lamp-dim": "#8A6A3C",
        cream: "#F3EDE4", // primary text
        dust: "#A292B5", // secondary text
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
