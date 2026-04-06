/**
 * main.js
 * ─────────────────────────────────────────────────────────────
 * Entry point. Responsibilities:
 *   1. Parse the source text into word nodes and measure their widths.
 *   2. Wire the file input → build hitmap → position image → re-layout.
 *   3. Trigger the initial layout once fonts are ready.
 *
 * All heavy logic lives in the imported modules; this file is intentionally
 * thin — just glue code and DOM event wiring.
 */

import { buildHitmap }   from './hitmap.js';
import { runLayout }     from './layout.js';
import { makeDraggable } from './drag.js';

// ─── Configuration ───────────────────────────────────────────

/**
 * The body text to typeset.
 * Replace or fetch this from an external source to support dynamic content.
 */
const SOURCE_TEXT = `The Czechs have ceased to preserve their good name and sinfully devote \
themselves to hedonistic delights. The old of their ilk stuff themselves like pigs and merely \
idle about in their homes, whilst the young have taken to dog hunting. The noblemen have begun \
to do that which once behoved only servants. Where once each lord kept his house clean and orderly, \
now dogs lie there, where ere hunters hunted and lords would come to visit them as need be, today \
they have devoted themselves to this lowly art, as if they had forgotten about their own blood. \
Ere they would sit at a table and attend to the affairs of the land and see to the multiplication \
of its peace and wealth; today they are wont to share a roof with a dog of the hunt and consider \
conversation of dogs and hunting to be of the most honourable variety. And thus the wealth of their \
estates is deteriorating and the stench of their dogs shall soon kill them. In days of yore when they \
set off to war, their own country they did not look and took only from the enemy. Yet what of today?`;

/** Default position (px) where the image is placed when first uploaded. */
const IMAGE_DEFAULT_LEFT = 320;
const IMAGE_DEFAULT_TOP  = 150;

// ─── State ───────────────────────────────────────────────────

/** @type {Array<{el: HTMLSpanElement, w: number}>} */
let words = [];

/** @type {import('./hitmap.js').Hitmap|null} */
let hitmap = null;

/** @type {HTMLImageElement|null} */
let imgEl = null;

// ─── DOM references ──────────────────────────────────────────

const container  = document.getElementById('container');
const renderArea = document.getElementById('render-area');
const fileInput  = document.getElementById('fileInput');
const debugInfo  = document.getElementById('debug-info');

// ─── Measurement canvas ──────────────────────────────────────
// A hidden canvas used solely for measureText(); never rendered.
const measureCtx = document.createElement('canvas').getContext('2d');

// ─── Core functions ──────────────────────────────────────────

/**
 * Parses SOURCE_TEXT, creates one <span> per word, appends them to the
 * render area, and measures each word's pixel width using the measurement canvas.
 *
 * Must be called after the custom font has loaded so measurements are accurate.
 */
function buildWordNodes() {
    measureCtx.font = '1.15rem UnifrakturMaguntia';
    renderArea.innerHTML = '';
    words = [];

    for (const token of SOURCE_TEXT.split(' ')) {
        const span = document.createElement('span');
        span.innerText  = token + ' ';
        span.className  = 'word-node';
        renderArea.appendChild(span);

        words.push({
            el: span,
            w:  measureCtx.measureText(token + ' ').width,
        });
    }
}

/**
 * Convenience wrapper: runs a layout pass and updates the status bar.
 */
function layout() {
    runLayout(words, imgEl, hitmap, (ms) => {
        debugInfo.textContent = `Rendered in ${ms.toFixed(1)} ms.`;
    });
}

/**
 * Full initialisation: (re)builds word nodes and runs the first layout pass.
 * Called on page load and whenever fonts become ready.
 */
function init() {
    buildWordNodes();
    layout();
}

// ─── Image upload flow ───────────────────────────────────────

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.addEventListener('load', (ev) => {
        // Create the draggable <img> if it doesn't exist yet
        if (!imgEl) {
            imgEl = document.createElement('img');
            imgEl.id = 'upload-obj';
            container.appendChild(imgEl);
            makeDraggable(imgEl, layout);
        }

        // Load into a temporary Image to extract pixel data before display
        const tempImg = new Image();

        tempImg.addEventListener('load', () => {
            hitmap        = buildHitmap(tempImg);
            imgEl.src     = ev.target.result;
            imgEl.style.left = IMAGE_DEFAULT_LEFT + 'px';
            imgEl.style.top  = IMAGE_DEFAULT_TOP  + 'px';

            // Brief delay lets the browser paint the image at its final size
            // before offsetWidth/offsetHeight are read during layout
            setTimeout(layout, 50);
        });

        tempImg.src = ev.target.result;
    });

    reader.readAsDataURL(file);
});

// ─── Bootstrap ───────────────────────────────────────────────

// Initialise immediately (uses fallback metrics if font not yet loaded)
init();

// Re-initialise once the custom font is confirmed loaded for accurate widths
document.fonts.ready.then(init);
