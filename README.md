# responsive-text

A zero-dependency browser tool that typesets text and dynamically reflows it around a PNG image — wrapping words pixel-accurately to the image's alpha channel rather than its bounding box.

---

## Features

- **Pixel-perfect text wrap** — uses the PNG's actual alpha channel to determine where each word can go, not just the rectangular bounds
- **Live reflow** — drag the image anywhere on the page and the text instantly rearranges
- **Zero dependencies** — plain HTML + CSS + vanilla ES modules; no build step required
- **Fast** — the alpha mask is baked once on upload; layout passes typically finish in under 5 ms

---

## How It Works

```
PNG upload
    │
    ▼
buildHitmap()     — draws image to offscreen <canvas>, extracts alpha channel
                    into a flat Uint8Array binary mask (1 = solid, 0 = transparent)
    │
    ▼
runLayout()       — iterates words left-to-right, top-to-bottom
    │               for each word, calls isBlocked() before committing placement
    ▼
isBlocked()       — AABB pre-check first; if boxes overlap, samples the hitmap
                    at the scaled word bounding box; returns true on first solid pixel
    │
    ▼
word.el.style.transform = translate(x, y)   — GPU-composited move, no layout thrash
```

Whenever the image is dragged, `runLayout()` is called again with the updated position of the image element.

---

## Getting Started

No build step required. Serve the project root over HTTP:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then open `http://localhost:8080`.

> Opening `index.html` directly in Chrome won't work — Chrome blocks ES module imports from `file://`. Firefox allows it.

---

## Project Structure

```
responsive-text/
├── index.html       # Entry point and toolbar markup
├── src/
│   ├── main.js      # Bootstrap, DOM wiring, file-upload flow
│   ├── layout.js    # Text layout engine (word placement loop)
│   ├── hitmap.js    # Alpha-channel mask builder and collision query
│   ├── drag.js      # Mouse-drag behaviour for the image
│   └── style.css    # All styles
└── LICENSE
```

---

## Configuration

All tunable constants are at the top of their respective modules:

| Constant | File | Default | Description |
|---|---|---|---|
| `ALPHA_THRESHOLD` | `hitmap.js` | `40` | Min alpha (0–255) to treat a pixel as solid |
| `NUDGE_STEP` | `layout.js` | `5` | Pixels to advance right on each blocked attempt |
| `MAX_ATTEMPTS` | `layout.js` | `1500` | Hard limit on placement retries per word |
| `MARGIN` | `layout.js` | `10` | Extra clear-space (px) around each glyph box |
| `LINE_HEIGHT` | `layout.js` | `38` | Vertical baseline distance (px) |
| `CONTAINER_WIDTH` | `layout.js` | `850` | Text column width (px) |

To change the body text, edit `SOURCE_TEXT` in `src/main.js`.  
To change the font, update the `@import` in `index.html` and the `font-family` references in `style.css` and `main.js`.

---

## Browser Support

Any evergreen browser with ES module support (Chrome 61+, Firefox 60+, Safari 10.1+).

---

## License

MIT — see [`LICENSE`](LICENSE).
