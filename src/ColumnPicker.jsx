import { useEffect, useRef, useState } from "react";
import { useDragReorder } from "./useDragReorder";
import { ColumnsIcon, GripIcon } from "./icons";

// Dropdown for choosing which optional columns a stock table renders, and
// dragging them into whatever order the user wants. `columns` is the full
// list of column defs ({ key, label, locked? }) already in their current
// working order; `locked` columns can't be hidden (checkbox stays checked
// and disabled) but can still be repositioned. `visible` is the current
// set of visible keys. `onVisibilityChange`/`onReorder` report the two
// kinds of edits separately.
export default function ColumnPicker({ columns, visible, onVisibilityChange, onReorder }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const { draggedKey, dragOverKey, startDrag } = useDragReorder(onReorder);

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

  const toggle = (key) => {
    const next = new Set(visible);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onVisibilityChange(next);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white hover:bg-paper text-ink-soft hover:text-ink text-[13px] font-medium px-3 py-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <ColumnsIcon className="h-3.5 w-3.5" />
        Columns
      </button>

      {isOpen && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-black/10 bg-white shadow-lg p-1.5 z-50">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Show &amp; reorder columns
          </p>
          {columns.map((col) => {
            const isDragging = draggedKey === col.key;
            const isDragTarget = dragOverKey === col.key && draggedKey !== col.key;

            return (
              <div
                key={col.key}
                data-drag-key={col.key}
                className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors ${
                  isDragTarget ? "border-t-2 border-t-brand" : "border-t-2 border-t-transparent"
                } ${isDragging ? "opacity-40" : ""}`}
              >
                <span
                  onPointerDown={startDrag(col.key)}
                  title="Drag to reorder"
                  className="text-ink-faint/60 hover:text-ink-faint cursor-grab active:cursor-grabbing shrink-0"
                  style={{ touchAction: "none" }}
                >
                  <GripIcon className="h-3.5 w-3.5" />
                </span>
                <label className="flex flex-1 items-center gap-2.5 py-0.5 text-[13px] text-ink-soft hover:text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.locked || visible.has(col.key)}
                    disabled={col.locked}
                    onChange={() => toggle(col.key)}
                    className="h-3.5 w-3.5 rounded border-black/20 text-brand focus:ring-brand/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {col.label}
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
