import { useEffect, useRef } from "react";

// A stock crossing this Attention Score bar means it's behaving unusually
// relative to *its own* recent norm -- calculate_attention_score (engine.py)
// blends RVOL (volume vs. this stock's typical volume) and z-score (price
// vs. this stock's own recent moving average/std dev), not a raw price move.
// z_score's sign gives the direction: meaningfully above its own average is
// bullish, meaningfully below is bearish.
const ATTENTION_THRESHOLD = 70;

function directionFor(stock) {
  if ((stock.attention_score || 0) < ATTENTION_THRESHOLD) return null;
  return (stock.z_score ?? 0) >= 0 ? "bullish" : "bearish";
}

// Fires a browser notification the moment a watchlist stock *enters* this
// unusual-for-it state -- not on every poll it stays there, and only once
// permission is granted and alerts are switched on.
export function useStockAlerts(stocks, enabled) {
  const lastDirection = useRef({});

  useEffect(() => {
    if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;

    for (const stock of stocks) {
      const direction = directionFor(stock);
      const previous = lastDirection.current[stock.symbol];

      if (direction && direction !== previous) {
        const emoji = direction === "bullish" ? "📈" : "📉";
        try {
          new Notification(`${emoji} ${stock.symbol} looking ${direction}`, {
            body: `${stock.symbol} is trading unusually ${direction === "bullish" ? "high" : "low"} for it -- $${Number(
              stock.current_price ?? 0
            ).toFixed(2)}, Attention score ${Math.round(stock.attention_score)}.`,
            tag: `stockwatch-${stock.symbol}`,
          });
        } catch {
          // Notification constructor can throw in some contexts -- a
          // missed alert isn't fatal.
        }
      }

      lastDirection.current[stock.symbol] = direction;
    }
  }, [stocks, enabled]);
}
