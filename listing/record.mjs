// Captures walkthrough.html frame-by-frame (deterministic timeline scrub) and
// encodes an H.264 MP4 with ffmpeg-static.
//   node record.mjs
import puppeteer from "puppeteer";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = join(__dirname, "walkthrough", "walkthrough.html");
const OUT = join(__dirname, "out");
const FRAMES = join(OUT, "_frames");
mkdirSync(FRAMES, { recursive: true });

const W = 1280, H = 720, FPS = 25;

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "networkidle0" });

  const total = await page.evaluate(() => window.TOTAL_MS);
  const frameCount = Math.round((total / 1000) * FPS);
  console.log(`Capturing ${frameCount} frames at ${FPS}fps (${total / 1000}s)…`);

  for (let f = 0; f < frameCount; f++) {
    const t = (f * 1000) / FPS;
    await page.evaluate((time) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = time;
      }
    }, t);
    await page.screenshot({
      path: join(FRAMES, `frame-${String(f).padStart(4, "0")}.png`),
      clip: { x: 0, y: 0, width: W, height: H },
    });
    if (f % 50 === 0) console.log(`  frame ${f}/${frameCount}`);
  }
  await browser.close();

  // Encode H.264 (yuv420p for broad player/YouTube compatibility).
  const mp4 = join(OUT, "screencast.mp4");
  console.log("Encoding", mp4);
  await new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      "-y",
      "-framerate", String(FPS),
      "-i", join(FRAMES, "frame-%04d.png"),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-crf", "20",
      "-preset", "medium",
      "-movflags", "+faststart",
      mp4,
    ], { stdio: ["ignore", "ignore", "inherit"] });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg exit " + code))));
  });

  rmSync(FRAMES, { recursive: true, force: true });
  console.log("Done:", mp4);
} catch (err) {
  console.error(err);
  try { await browser.close(); } catch {}
  process.exit(1);
}
