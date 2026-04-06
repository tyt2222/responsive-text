/**
 * layout.js
 * ─────────────────────────────────────────────────────────────
 * Text layout engine: places word nodes left-to-right, top-to-bottom,
 * nudging right (or wrapping) whenever the current position overlaps
 * a solid pixel in the image hitmap.
 *
 * Design notes
 * ────────────
 * • Words are represented as plain objects { el, w } — the DOM <span>
 *   is moved via CSS transform (translate) rather than left/top so the
 *   browser can composite it on the GPU layer without triggering layout.
 *
 * • The nudge loop advances `curX` by NUDGE_STEP px on each collision,
 *   up to MAX_ATTEMPTS times, before giving up and force-placing the word
 *   (prevents infinite loops on pathological hitmap shapes).
 *
 * • Line height and container width are exported constants so callers
 *   can override them for different page sizes.
 */

import { isBlocked } from './hitmap.js';

/** Horizontal pixel increment when a placement is blocked. */
const NUDGE_STEP = 5;

/** Hard ceiling on placement attempts per word. */
const MAX_ATTEMPTS = 1500;

/** Extra clear-space (px) added around each glyph box during collision tests. */
export const MARGIN = 10;

/** Vertical distance between text baselines (px). */
export const LINE_HEIGHT = 38;

/** Total usable width of the text column (px). */
export const CONTAINER_WIDTH = 850;

/**
 * @typedef {Object} WordNode
 * @property {HTMLSpanElement} el  - The positioned <span> element.
 * @property {number}          w   - Measured pixel width of the word + trailing space.
 */

/**
 * Runs a full layout pass over all words, placing each one at the first
 * unblocked position in reading order.
 *
 * Call this once on startup and again whenever the image moves.
 *
 * @param {WordNode[]}      words   - Ordered list of word nodes to place.
 * @param {HTMLElement|null} imgEl  - The draggable illumination <img>, or null.
 * @param {object|null}     hitmap  - Pre-built alpha mask from hitmap.js, or null.
 * @param {function}        onDone  - Called with elapsed ms when the pass finishes.
 */
export function runLayout(words, imgEl, hitmap, onDone) {
    if (!words.length) return;

    const t0 = performance.now();

    let curX = 0;
    let curY = 28; // first baseline, small top inset

    for (const word of words) {
        let placed   = false;
        let attempts = 0;

        while (!placed && attempts < MAX_ATTEMPTS) {
            // Wrap to next line if word overflows the column
            if (curX + word.w > CONTAINER_WIDTH) {
                curX  = 0;
                curY += LINE_HEIGHT;
                continue;
            }

            if (!isBlocked(hitmap, imgEl, curX, curY, word.w, MARGIN)) {
                word.el.style.transform = `translate(${curX}px, ${curY}px)`;
                curX += word.w;
                placed = true;
            } else {
                // Nudge right and retry
                curX += NUDGE_STEP;
            }

            attempts++;
        }

        // Safety fallback: force-place if all attempts exhausted
        if (!placed) {
            word.el.style.transform = `translate(${curX}px, ${curY}px)`;
            curX += word.w;
        }
    }

    onDone(performance.now() - t0);
}
