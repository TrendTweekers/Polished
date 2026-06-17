# Polished — App Store listing assets (code-rendered)

Every asset is hand-coded HTML/CSS/SVG and rendered with headless Chrome (Puppeteer),
so they regenerate deterministically. No image generators.

## Setup
```
cd listing
npm install        # installs puppeteer (downloads Chromium) + ffmpeg-static
```

## Build everything
```
npm run render     # frames/*.html  -> out/feature-media.png + out/screenshot-*.png (1600x900)
npm run icons      # icons/*.svg    -> out/icon-a|b|c.png (1200x1200) + out/icon-comparison.png
npm run screencast # walkthrough.html -> out/screencast.mp4 (H.264, ~30s)
node count.mjs     # prints exact character counts for every listing copy field
```

All outputs land in `out/` (git-ignored; regenerate any time).

## What goes where in the Shopify listing
| File | Listing field |
| --- | --- |
| `out/feature-media.png` | App store listing content → Feature media |
| `out/screenshot-1..5-*.png` | App store listing content → Screenshots (in order) |
| `out/icon-a.png` | App icon (set in the dev dashboard / app setup) |
| `out/screencast.mp4` | Upload to YouTube/Vimeo, paste URL into App testing info → Screencast URL |
| `LISTING_COPY.md` | All text fields, with exact character counts |

## Files
- `frames/` — `styles.css` design system + `feature.html`, `frame1..5.html` (one per screenshot).
- `icons/` — `icon-a|b|c.svg` concepts + `compare.html`.
- `walkthrough/walkthrough.html` — scrubbable animated demo (CSS animations, paused; `record.mjs` seeks each frame).
- `render.mjs`, `render-icons.mjs`, `record.mjs` — Puppeteer renderers.
- `LISTING_COPY.md`, `count.mjs` — copy + count verification.
