import { useState } from "react";
import { POLL_INTERVAL_MS } from "./useWatchlistStore";

// trend_points has no per-point timestamps in the API contract -- only the
// most recent point's time is known (last_updated). Points are laid down one
// per poll cycle, so earlier points are approximately POLL_INTERVAL_MS apart,
// counting back from that anchor. Approximate, and labeled as such.
function approximateTimestamp(index, totalPoints, anchorIso) {
  if (!anchorIso) return null;
  const anchorMs = new Date(anchorIso).getTime();
  const stepsFromEnd = totalPoints - 1 - index;
  return new Date(anchorMs - stepsFromEnd * POLL_INTERVAL_MS);
}

export default function Sparkline({ points, delta, lastUpdated, width = 100, height = 30 }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!points || points.length < 2) {
    return <span className="text-[11px] text-ink-faint">collecting…</span>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;

  const xy = points.map((value, i) => ({
    x: (i / (points.length - 1)) * width,
    // range === 0 means every point is identical -- draw a flat line
    // through the middle, not pinned to the bottom edge.
    y: range === 0 ? height / 2 : height - ((value - min) / range) * height,
    value,
  }));

  const isUp = delta == null ? points[points.length - 1] >= points[0] : delta >= 0;
  const color = isUp ? "#00B386" : "#E11D48";

  const hovered = hoverIndex != null ? xy[hoverIndex] : null;
  const hoveredTime = hoverIndex != null ? approximateTimestamp(hoverIndex, points.length, lastUpdated) : null;

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <polyline
          points={xy.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {xy.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 3 : 5}
            fill={hoverIndex === i ? color : "transparent"}
            stroke={hoverIndex === i ? "white" : "none"}
            strokeWidth={hoverIndex === i ? 1.2 : 0}
            className="cursor-default"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((current) => (current === i ? null : current))}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute z-10 pointer-events-none rounded-md bg-slate-900 text-white text-[10.5px] font-medium px-2 py-1 shadow-lg whitespace-nowrap"
          style={{ left: hovered.x, top: 0, transform: "translate(-50%, calc(-100% - 6px))" }}
        >
          ${hovered.value.toFixed(2)}
          {hoveredTime && (
            <span className="opacity-70">
              {" "}
              · {hoveredTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
