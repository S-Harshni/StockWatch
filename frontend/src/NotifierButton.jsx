import { motion } from "framer-motion";
import { BellIcon } from "./icons";

// Browser permission (once granted) can't be revoked from JS -- so once
// granted, this becomes an in-app on/off toggle instead of just a status
// label, letting the user pause alerts without touching browser settings.
export default function NotifierButton({ permission, isSupported, enabled, onEnable, onToggle }) {
  if (!isSupported) return null;

  if (permission === "granted") {
    return (
      <motion.button
        onClick={onToggle}
        title={enabled ? "Pause bullish/bearish alerts" : "Resume bullish/bearish alerts"}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
          enabled
            ? "bg-brand-light border-brand/25 text-brand-dark hover:brightness-95"
            : "border-line text-ink-faint hover:text-ink-soft hover:bg-card-alt"
        }`}
      >
        <BellIcon className="h-3.5 w-3.5" />
        {enabled ? "Alerts on" : "Alerts off"}
      </motion.button>
    );
  }

  if (permission === "denied") {
    return (
      <span
        title="Notifications are blocked in your browser settings"
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[12px] font-medium text-ink-faint whitespace-nowrap shrink-0"
      >
        <BellIcon className="h-3.5 w-3.5" />
        Alerts blocked
      </span>
    );
  }

  return (
    <motion.button
      onClick={onEnable}
      title="Get notified when a watchlist stock turns bullish or bearish"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card hover:bg-card-alt text-ink-soft hover:text-ink text-[12px] font-medium px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <BellIcon className="h-3.5 w-3.5" />
      Enable alerts
    </motion.button>
  );
}
