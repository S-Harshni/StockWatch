import { motion, useReducedMotion } from "framer-motion";

// Purely decorative -- two soft, slow-drifting glows (gold + emerald,
// same tokens as the rest of the theme) fixed behind all page content.
// Never touches any button/item color; this only exists to make the
// background itself feel alive instead of flat. Respects
// prefers-reduced-motion by freezing in place rather than hiding, since
// the glow itself is still part of the intended look.
export default function AmbientBackground() {
  const shouldReduceMotion = useReducedMotion();

  const driftA = shouldReduceMotion
    ? {}
    : {
        x: ["0%", "3%", "-2%", "0%"],
        y: ["0%", "4%", "1%", "0%"],
        scale: [1, 1.08, 1.03, 1],
      };

  const driftB = shouldReduceMotion
    ? {}
    : {
        x: ["0%", "-3%", "2%", "0%"],
        y: ["0%", "-3%", "-1%", "0%"],
        scale: [1, 1.05, 1.1, 1],
      };

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute -top-1/4 -left-1/4 h-[70vh] w-[70vh] rounded-full"
        style={{
          background: "radial-gradient(circle, rgb(var(--color-gold) / 0.16) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
        animate={driftA}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -top-1/3 -right-1/4 h-[75vh] w-[75vh] rounded-full"
        style={{
          background: "radial-gradient(circle, rgb(var(--color-brand) / 0.20) 0%, transparent 60%)",
          filter: "blur(70px)",
        }}
        animate={driftB}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
