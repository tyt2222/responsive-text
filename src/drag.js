/**
 * drag.js
 * ─────────────────────────────────────────────────────────────
 * Attaches mouse-based drag behaviour to any absolutely-positioned
 * element, then calls an optional callback after each move so the
 * layout engine can re-flow text in real time.
 *
 * Touch events are intentionally out of scope for v1 — see ROADMAP.md.
 */

/**
 * Makes `el` draggable within its offset parent.
 *
 * @param {HTMLElement} el       - Element to drag (must be position:absolute).
 * @param {function}    onMove   - Called after every position update.
 */
export function makeDraggable(el, onMove) {
    let active = false;
    let startClientX, startClientY;
    let originLeft, originTop;

    el.addEventListener('mousedown', (e) => {
        active      = true;
        startClientX = e.clientX;
        startClientY = e.clientY;
        originLeft   = el.offsetLeft;
        originTop    = el.offsetTop;
        e.preventDefault(); // block text selection while dragging
    });

    document.addEventListener('mousemove', (e) => {
        if (!active) return;
        el.style.left = (originLeft + e.clientX - startClientX) + 'px';
        el.style.top  = (originTop  + e.clientY - startClientY) + 'px';
        onMove();
    });

    document.addEventListener('mouseup', () => {
        active = false;
    });
}
