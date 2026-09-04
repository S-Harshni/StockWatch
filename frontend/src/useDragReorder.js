import { useRef, useState } from "react";

// Pointer-Events-based reorder -- works with mouse AND touch, unlike HTML5
// drag-and-drop (the `draggable` attribute + dragstart/dragover/drop),
// which most mobile/touch browsers don't support at all. The dragged item
// and whatever it's currently over are found by walking up from
// document.elementFromPoint to the nearest element carrying `attr`.
export function useDragReorder(onReorder, attr = "data-drag-key") {
  const [draggedKey, setDraggedKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const findKeyAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const target = el && el.closest ? el.closest(`[${attr}]`) : null;
    return target ? target.getAttribute(attr) : null;
  };

  // Spread the return of startDrag(key) onto a drag-handle element's
  // onPointerDown. `key` identifies the row/column being picked up; every
  // draggable row/column container needs `attr` set to its own key so
  // findKeyAt can resolve what's under the pointer as it moves.
  const startDrag = (key) => (e) => {
    e.preventDefault();
    setDraggedKey(key);
    setDragOverKey(key);

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      setDragOverKey(findKeyAt(moveEvent.clientX, moveEvent.clientY));
    };

    const handleUp = (upEvent) => {
      const to = findKeyAt(upEvent.clientX, upEvent.clientY);
      if (to && to !== key) onReorderRef.current(key, to);
      setDraggedKey(null);
      setDragOverKey(null);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  return { draggedKey, dragOverKey, startDrag };
}
