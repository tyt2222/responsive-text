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
 * • After the image is cleared on a line, a "right-side check" tests whether
 *   the remaining space after the image is wide enough to resume from curX,
 *   avoiding orphaned words pushed too far right.
 *
 * • Line height and container width are exported constants so callers
 *   can override them for different page sizes.
 */

import { buildHitmapState, isBlocked } from './hitmap.js';

/** Horizontal pixel increment when a placement is blocked. */
const NUDGE_STEP = 2;

/** Hard ceiling on placement attempts per word. */
const MAX_ATTEMPTS = 1500;

/** Extra clear-space (px) added vertically around each glyph box. */
export const MARGIN = 10;

/**
 * Symmetric horizontal padding (px) added on both sides of a word box
 * during collision tests, so left/right clearance from the silhouette
 * is identical.
 */
const MARGIN_X = 12;

/** Vertical distance between text baselines (px). */
export const LINE_HEIGHT = 38;

/** Total usable width of the text column (px). */
export const CONTAINER_WIDTH = 850;

/**
 * @typedef {Object} WordNode
 * @property {HTMLSpanElement} el  - The positioned <span> element.
 * @property {number}          w   - Measured pixel width of the word + trailing space.
 */

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Tests whether placing a word at (x, y) collides with the hitmap,
 * using symmetric horizontal margins on both sides.
 */
function wordBlocked(hitmap, state, x, y, wordW) {
    return isBlocked(hitmap, state, x - MARGIN_X, y, wordW + MARGIN_X * 2, MARGIN, MARGIN);
}

/**
 * Scans rightward from `startX` on baseline `y` and returns the first X
 * position where a word of width `wordW` fits without collision.
 * Returns null if no such position exists before CONTAINER_WIDTH.
 *
 * Using NUDGE_STEP=2 keeps this accurate without being expensive.
 */
function findFreeX(hitmap, state, startX, y, wordW) {
    let x = startX;
    let attempts = 0;
    while (x + wordW <= CONTAINER_WIDTH && attempts < MAX_ATTEMPTS) {
        if (!wordBlocked(hitmap, state, x, y, wordW)) return x;
        x += NUDGE_STEP;
        attempts++;
    }
    return null;
}

// ─── Main export ─────────────────────────────────────────────

/**
 * Runs a full layout pass over all words, placing each one at the first
 * unblocked position in reading order.
 *
 * Key improvement over the previous version:
 *   When a word doesn't fit before the image on a line, instead of
 *   immediately wrapping, we first check if it fits AFTER the image
 *   on the same line. This fills the right-side gap that caused large
 *   blank areas in the middle of lines.
 *
 * @param {WordNode[]}       words  - Ordered list of word nodes to place.
 * @param {HTMLElement|null} imgEl  - The draggable <img>, or null.
 * @param {object|null}      hitmap - Pre-built alpha mask from hitmap.js, or null.
 * @param {function}         onDone - Called with elapsed ms when the pass finishes.
 */
export function runLayout(words, imgEl, hitmap, onDone) {
    if (!words.length) return;

    const t0    = performance.now();
    const state = buildHitmapState(hitmap, imgEl);

    let curX = 0;
    let curY = 28; // first baseline, small top inset

    for (const word of words) {
        const { el, w } = word;
        let placed = false;

        // ── Attempt 1: find a free slot from curX on the current line ──
        const freeX = findFreeX(hitmap, state, curX, curY, w);

        if (freeX !== null && freeX + w <= CONTAINER_WIDTH) {
            el.style.transform = `translate(${freeX}px, ${curY}px)`;
            curX   = freeX + w;
            placed = true;
        }

        // ── Attempt 2: wrap to next line and try from x=0 ──────────────
        if (!placed) {
            curX = 0;
            curY += LINE_HEIGHT;

            const freeX2 = findFreeX(hitmap, state, curX, curY, w);

            if (freeX2 !== null && freeX2 + w <= CONTAINER_WIDTH) {
                el.style.transform = `translate(${freeX2}px, ${curY}px)`;
                curX   = freeX2 + w;
                placed = true;
            }
        }

        // ── Fallback: force-place at curX to avoid infinite hang ────────
        if (!placed) {
            el.style.transform = `translate(${curX}px, ${curY}px)`;
            curX += w;
        }
    }

    onDone(performance.now() - t0);
}