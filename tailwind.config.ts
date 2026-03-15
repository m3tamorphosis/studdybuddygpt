import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16243b",
        mist: "#f7fbff",
        ocean: "#2bd2ff",
        sunrise: "#fa8bff",
        cloud: "#dbffeb"
      },
      boxShadow: {
        panel: "0 20px 45px rgba(21, 36, 58, 0.12)"
      },
      fontFamily: {
        sans: ["Trebuchet MS", "Segoe UI", "Tahoma", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;

