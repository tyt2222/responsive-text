/**
 * hitmap.js
 * ─────────────────────────────────────────────────────────────
 * Builds a compact binary mask from a PNG image's alpha channel,
 * then exposes a fast per-pixel lookup used for text-wrap collision.
 *
 * Why a flat Uint8Array instead of getImageData per query?
 * getImageData is expensive. We pre-bake the alpha mask once on
 * image load, then every layout pass just does array reads.
 */

const _canvas = document.createElement('canvas');
const _ctx = _canvas.getContext('2d', { willReadFrequently: true });

/** Minimum alpha (0–255) for a pixel to count as "solid". */
const ALPHA_THRESHOLD = 40;

/**
 * @typedef {Object} Hitmap
 * @property {number}     w    - Image width in pixels.
 * @property {number}     h    - Image height in pixels.
 * @property {Uint8Array} data - Flat binary mask: 1 = solid, 0 = transparent.
 */

/**
 * Builds a Hitmap from an HTMLImageElement.
 * The image must already be loaded (naturalWidth > 0).
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

    const raw  = _ctx.getImageData(0, 0, w, h).data; // RGBA flat array
    const mask = new Uint8Array(w * h);

    for (let i = 0; i < mask.length; i++) {
        mask[i] = raw[i * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
    }

    return { w, h, data: mask };
}

/**
 * Tests whether a text glyph bounding box overlaps any solid pixel
 * in the hitmap, accounting for the image's current screen position.
 *
 * @param {Hitmap}           hitmap      - Pre-built mask.
 * @param {HTMLElement}      imgEl       - The positioned <img> element.
 * @param {number}           wordX       - Left edge of the word (px, relative to container).
 * @param {number}           wordY       - Baseline Y of the word (px).
 * @param {number}           wordW       - Measured pixel width of the word.
 * @param {number}           margin      - Extra padding around the glyph box (px).
 * @returns {boolean}                    - true if blocked.
 */
export function isBlocked(hitmap, imgEl, wordX, wordY, wordW, margin) {
    if (!hitmap || !imgEl) return false;

    const ox   = imgEl.offsetLeft;
    const oy   = imgEl.offsetTop;
    const visW = imgEl.offsetWidth;
    const visH = imgEl.offsetHeight;

    // Glyph bounding box (approximate ascender/descender)
    const tL = wordX - margin;
    const tR = wordX + wordW + margin;
    const tT = wordY - 22 - margin; // ~ascender height for the chosen font size
    const tB = wordY + 6  + margin; // ~descender

    // Quick AABB rejection — skip per-pixel work if boxes don't overlap
    if (tB < oy || tT > oy + visH || tR < ox || tL > ox + visW) return false;

    // Map screen-space box to hitmap-space, clamped to valid range
    const scaleX  = hitmap.w / visW;
    const scaleY  = hitmap.h / visH;
    const hStartX = Math.max(0,           Math.floor((tL - ox) * scaleX));
    const hEndX   = Math.min(hitmap.w - 1, Math.floor((tR - ox) * scaleX));
    const hStartY = Math.max(0,           Math.floor((tT - oy) * scaleY));
    const hEndY   = Math.min(hitmap.h - 1, Math.floor((tB - oy) * scaleY));

    // Step size keeps the check O(1) relative to scale rather than O(pixels)
    const stepX = Math.max(1, Math.floor(scaleX));
    const stepY = Math.max(1, Math.floor(scaleY));

    for (let lx = hStartX; lx <= hEndX; lx += stepX) {
        for (let ly = hStartY; ly <= hEndY; ly += stepY) {
            if (hitmap.data[ly * hitmap.w + lx]) return true;
        }
    }

    return false;
}
