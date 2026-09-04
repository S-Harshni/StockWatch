/** @type {import('tailwindcss').Config} */

// Every semantic color resolves through a CSS variable (see index.css's
// :root / .dark blocks) instead of a fixed hex, so toggling the `dark`
// class on <html> re-themes the whole app without touching component
// classNames. `opacityValue` support means `bg-brand/40` etc. still work.
function themed(variable) {
  return ({ opacityValue }) =>
    opacityValue === undefined ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${opacityValue})`;
}

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Emerald in light mode, violet in dark mode -- same role (primary
        // accent), different hue per theme. `dark` is the shade used
        // wherever text sits directly on the accent (buttons, badges) --
        // picked per-theme for contrast, not just a literal darker tint.
        brand: {
          DEFAULT: themed("--color-brand"),
          dark: themed("--color-brand-dark"),
          light: themed("--color-brand-light"),
        },
        // Gold in light mode, lime in dark mode -- secondary accent for
        // premium moments (logo, header accent line). Never carries
        // price up/down meaning, so it can't compete with red/green.
        gold: {
          DEFAULT: themed("--color-gold"),
          dark: themed("--color-gold-dark"),
          light: themed("--color-gold-light"),
        },
        ink: {
          DEFAULT: themed("--color-ink"),
          soft: themed("--color-ink-soft"),
          faint: themed("--color-ink-faint"),
        },
        paper: themed("--color-bg"),
        card: themed("--color-card"),
        "card-alt": themed("--color-card-alt"),
        line: themed("--color-line"),
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
