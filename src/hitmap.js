/**
 * hitmap.js
 * ─────────────────────────────────────────────────────────────
 * Builds a compact binary mask from a PNG image's alpha channel,
 * then exposes a fast per-pixel lookup used for text-wrap collision.
 *
 * Improvements over v1:
 *  - Mask is morphologically dilated by DILATE_RADIUS pixels so text
 *    never touches the image silhouette — no more "glued to the edge" look.
 *  - isBlocked() samples every pixel in the query box (step = 1) so
 *    there are no false-negative gaps at the scale boundaries.
 *  - buildHitmapState() pre-computes scale factors once per layout pass
 *    so they are not recomputed for every word.
 */

const _canvas = document.createElement('canvas');
const _ctx    = _canvas.getContext('2d', { willReadFrequently: true });

/** Minimum alpha (0–255) for a pixel to count as "solid". */
const ALPHA_THRESHOLD = 30;

/**
 * Morphological dilation radius (px in hitmap-space).
 * Expanding the mask outward creates a comfortable gap between
 * the image silhouette and the nearest text glyph.
 */
const DILATE_RADIUS = 6;

/**
 * @typedef {Object} Hitmap
 * @property {number}     w    - Image width in pixels.
 * @property {number}     h    - Image height in pixels.
 * @property {Uint8Array} data - Flat binary mask: 1 = solid, 0 = transparent.
 */

/**
 * Builds a Hitmap from an HTMLImageElement.
 * The returned mask is dilated by DILATE_RADIUS for comfortable text clearance.
 *
 * @param {HTMLImageElement} img
 * @returns {Hitmap}
 */
export function buildHitmap(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    _canvas.width  = w;
    _canvas.height = h;
    _ctx.clearRect(0, 0, w, h);
    _ctx.drawImage(img, 0, 0);

    const raw      = _ctx.getImageData(0, 0, w, h).data;
    const raw_mask = new Uint8Array(w * h);

    for (let i = 0; i < raw_mask.length; i++) {
        raw_mask[i] = raw[i * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
    }

    // --- Morphological dilation (box kernel) ---
    // Expand every solid pixel outward by DILATE_RADIUS so text
    // never visually touches the image silhouette edge.
    const dilated = new Uint8Array(w * h);
    const r = DILATE_RADIUS;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (raw_mask[y * w + x]) {
                const x0 = Math.max(0,     x - r);
                const x1 = Math.min(w - 1, x + r);
                const y0 = Math.max(0,     y - r);
                const y1 = Math.min(h - 1, y + r);
                for (let dy = y0; dy <= y1; dy++) {
                    dilated.fill(1, dy * w + x0, dy * w + x1 + 1);
                }
            }
        }
    }

    return { w, h, data: dilated };
}

/**
 * Pre-computes the transform between screen-space and hitmap-space
 * for a given image element. Call once per layout pass (not per word).
 *
 * @param {Hitmap}      hitmap
 * @param {HTMLElement} imgEl
 * @returns {{ ox: number, oy: number, visW: number, visH: number, scaleX: number, scaleY: number } | null}
 */
export function buildHitmapState(hitmap, imgEl) {
    if (!hitmap || !imgEl) return null;
    const visW = imgEl.offsetWidth;
    const visH = imgEl.offsetHeight;
    return {
        ox:     imgEl.offsetLeft,
        oy:     imgEl.offsetTop,
        visW,
        visH,
        scaleX: hitmap.w / visW,
        scaleY: hitmap.h / visH,
    };
}

/**
 * Tests whether a text glyph bounding box overlaps any solid pixel in the hitmap.
 *
 * @param {Hitmap}  hitmap  - Pre-built (dilated) mask.
 * @param {object}  state   - Cached state from buildHitmapState().
 * @param {number}  wordX   - Left edge of the word (px, relative to container).
 * @param {number}  wordY   - Baseline Y of the word (px).
 * @param {number}  wordW   - Measured pixel width of the word.
 * @param {number}  ascent  - Pixels above baseline to check.
 * @param {number}  descent - Pixels below baseline to check.
 * @returns {boolean}       - true if blocked.
 */
export function isBlocked(hitmap, state, wordX, wordY, wordW, ascent, descent) {
    if (!hitmap || !state) return false;

    const { ox, oy, visW, visH, scaleX, scaleY } = state;

    const tL = wordX;
    const tR = wordX + wordW;
    const tT = wordY - ascent;
    const tB = wordY + descent;

    // AABB rejection
    if (tB < oy || tT > oy + visH || tR < ox || tL > ox + visW) return false;

    const hStartX = Math.max(0,            Math.round((tL - ox) * scaleX));
    const hEndX   = Math.min(hitmap.w - 1, Math.round((tR - ox) * scaleX));
    const hStartY = Math.max(0,            Math.round((tT - oy) * scaleY));
    const hEndY   = Math.min(hitmap.h - 1, Math.round((tB - oy) * scaleY));

    for (let ly = hStartY; ly <= hEndY; ly++) {
        const row = ly * hitmap.w;
        for (let lx = hStartX; lx <= hEndX; lx++) {
            if (hitmap.data[row + lx]) return true;
        }
    }

    return false;
}