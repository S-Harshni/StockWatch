import { motion } from "framer-motion";
import { SunIcon, MoonIcon } from "./icons";

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.12 }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:text-ink hover:bg-card-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 transition-colors cursor-pointer shrink-0"
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </motion.button>
  );
}
