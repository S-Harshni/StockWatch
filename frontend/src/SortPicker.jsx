import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SortIcon, CheckIcon } from "./icons";
import { SORT_OPTIONS } from "./sort";

// Dropdown for choosing how a stock table is ordered: Attention Score (the
// product's own "worth a look" ranking, and the default) plus the
// alphabetical / most-profit / price / volume sorts a normal watchlist
// offers. `value` is the active sort key; `onChange` reports a pick.
// Mirrors ColumnPicker's dropdown shell, single-select instead of
// checkbox+drag.
export default function SortPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const activeOption = SORT_OPTIONS.find((option) => option.key === value) ?? SORT_OPTIONS[0];

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card hover:bg-card-alt text-ink-soft hover:text-ink text-[13px] font-medium px-3 py-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <SortIcon className="h-3.5 w-3.5" />
        Sort: <span className="text-ink">{activeOption.label}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-card shadow-lg p-1.5 z-50"
          >
            <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Sort by
            </p>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={option.key === value}
                onClick={() => {
                  onChange(option.key);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-soft hover:bg-card-alt hover:text-ink cursor-pointer transition-colors"
              >
                {option.label}
                {option.key === value && <CheckIcon className="h-3.5 w-3.5 text-brand shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
