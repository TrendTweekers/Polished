// Renders each frames/*.html to a 1600x900 PNG with headless Chrome.
//   node render.mjs
import puppeteer from "puppeteer";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMES = join(__dirname, "frames");
const OUT = join(__dirname, "out");
mkdirSync(OUT, { recursive: true });

const W = 1600, H = 900;

// source html -> output png name (App Store asset names)
const JOBS = [
  ["feature.html", "feature-media.png"],
  ["frame1.html", "screenshot-1-review.png"],
  ["frame2.html", "screenshot-2-quality.png"],
  ["frame3.html", "screenshot-3-tone.png"],
  ["frame4.html", "screenshot-4-glossary.png"],
  ["frame5.html", "screenshot-5-publish.png"],
];

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  // deviceScaleFactor 1 so the PNG is exactly 1600x900 (Shopify's required size).
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  for (const [src, out] of JOBS) {
    await page.goto(pathToFileURL(join(FRAMES, src)).href, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.screenshot({
      path: join(OUT, out),
      clip: { x: 0, y: 0, width: W, height: H },
    });
    console.log("rendered", out);
  }
} finally {
  await browser.close();
}
console.log("Done. PNGs in", OUT);
