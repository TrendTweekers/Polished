// Renders each icon SVG to a 1200x1200 PNG, plus a comparison sheet.
//   node render-icons.mjs
import puppeteer from "puppeteer";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS = join(__dirname, "icons");
const OUT = join(__dirname, "out");
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();

  // 1200x1200 PNG per concept
  await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 1 });
  for (const id of ["a", "b", "c"]) {
    await page.goto(pathToFileURL(join(ICONS, `icon-${id}.svg`)).href, { waitUntil: "networkidle0" });
    await page.screenshot({ path: join(OUT, `icon-${id}.png`), clip: { x: 0, y: 0, width: 1200, height: 1200 } });
    console.log("rendered", `icon-${id}.png`);
  }

  // comparison sheet (scale 1 so it stays viewable / under size limits)
  await page.setViewport({ width: 1500, height: 760, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(ICONS, "compare.html")).href, { waitUntil: "networkidle0" });
  await page.screenshot({ path: join(OUT, "icon-comparison.png"), clip: { x: 0, y: 0, width: 1500, height: 760 } });
  console.log("rendered icon-comparison.png");
} finally {
  await browser.close();
}
console.log("Done. PNGs in", OUT);
