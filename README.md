# Pretext Pro

**Medieval Illuminated Text Layout Engine**

A zero-dependency browser tool that typesets text in a blackletter font and dynamically reflows it around a PNG illumination — wrapping words pixel-accurately to the image's alpha channel, just like a medieval manuscript scribe would plan around a hand-painted initial.

![screenshot placeholder](docs/screenshot.png)

---

## Features

- **Pixel-perfect text wrap** — uses the PNG's actual alpha channel (not its bounding box) to determine where each word can go
- **Live reflow** — drag the illumination anywhere on the page and the text instantly rearranges
- **Blackletter typography** — UnifrakturMaguntia via Google Fonts
- **Zero dependencies** — plain HTML + CSS + vanilla ES modules; no build step
- **Fast** — hitmap is baked once on upload; layout passes typically finish in < 5 ms

---

## How It Works

```
PNG upload
    │
    ▼
buildHitmap()          — draws image to offscreen <canvas>, extracts alpha channel
                         into a flat Uint8Array binary mask (1 = solid, 0 = transparent)
    │
    ▼
runLayout()            — iterates words left-to-right, top-to-bottom
    │                    for each word, calls isBlocked() before committing placement
    ▼
isBlocked()            — AABB pre-check first; if boxes overlap, samples the hitmap
                         at the scaled word bounding box; returns true on first hit
    │
    ▼
word.el.style.transform = translate(x, y)   — GPU-composited move, no layout thrash
```

Whenever the image is dragged, `runLayout()` is called again with the updated `offsetLeft`/`offsetTop` of the image element.

---

## Getting Started

No build step required. Just serve the project root over HTTP:

```bash
# Python (any modern version)
python -m http.server 8080

# Node (if you have npx)
npx serve .

# Or just open index.html directly in Firefox
# (Chrome blocks ES module imports from file://)
```

Then open `http://localhost:8080` in your browser.

---

## Project Structure

```
pretext-pro/
├── index.html          # Entry point & toolbar markup
├── src/
│   ├── main.js         # Bootstrap, DOM wiring, file-upload flow
│   ├── layout.js       # Text layout engine (word placement loop)
│   ├── hitmap.js       # Alpha-channel mask builder + collision query
│   ├── drag.js         # Mouse-drag behaviour for the image
│   └── style.css       # All styles
└── docs/
    └── ROADMAP.md      # Planned features
```

---

## Configuration

All tunable constants are exported from their respective modules:

| Constant | Location | Default | Description |
|---|---|---|---|
| `ALPHA_THRESHOLD` | `hitmap.js` | `40` | Min alpha (0–255) to treat a pixel as solid |
| `NUDGE_STEP` | `layout.js` | `5` | Px to advance right on each blocked attempt |
| `MAX_ATTEMPTS` | `layout.js` | `1500` | Hard limit on placement retries per word |
| `MARGIN` | `layout.js` | `10` | Extra clear-space (px) around each glyph box |
| `LINE_HEIGHT` | `layout.js` | `38` | Vertical baseline distance (px) |
| `CONTAINER_WIDTH` | `layout.js` | `850` | Text column width (px) |

To change the body text, edit `SOURCE_TEXT` in `src/main.js`.

---

## Browser Support

Any evergreen browser with ES module support (Chrome 61+, Firefox 60+, Safari 10.1+).

---

## Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## License

MIT — see [`LICENSE`](LICENSE).
