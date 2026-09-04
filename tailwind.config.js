/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#00D09C",
          dark: "#00B386",
          light: "#E4FBF3",
        },
        ink: {
          DEFAULT: "#1D2129",
          soft: "#5B6572",
          // 4.83:1 on white -- the previous #8A93A3 was ~3.1:1, under the
          // 4.5:1 AA minimum for the OHLC/timestamp text it's used on.
          faint: "#6B7280",
        },
        paper: "#F7F9FC",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.04)",
      },
    },
  },
  plugins: [],
};
