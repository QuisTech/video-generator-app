import puppeteer from "puppeteer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export class VideoGenerator {
  private readonly OUTPUT_DIR = path.join(process.cwd(), "generated-videos");
  private readonly FRAMES_DIR = path.join(process.cwd(), "temp-frames");

  constructor() {
    [this.OUTPUT_DIR, this.FRAMES_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  /**
   * Generate video from URL
   */
  async generate(
    url: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const videoId = uuidv4();
    const sessionFramesDir = path.join(this.FRAMES_DIR, videoId);

    if (!fs.existsSync(sessionFramesDir)) {
      fs.mkdirSync(sessionFramesDir, { recursive: true });
    }

    try {
      // Record video
      await this.recordVideo(
        url,
        videoId,
        sessionFramesDir,
        onProgress
      );

      // Convert to MP4
      const outputPath = await this.convertToVideo(
        videoId,
        sessionFramesDir,
        onProgress
      );

      return outputPath;
    } finally {
      // Cleanup frames
      this.cleanupFrames(sessionFramesDir);
    }
  }

  /**
   * Record website as frames
   */
  private async recordVideo(
    url: string,
    videoId: string,
    framesDir: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate to URL
      console.log(`Recording: ${url}`);
      await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
      await page.waitForTimeout(1500);

      // Record for 10 seconds at 15 FPS
      const fps = 15;
      const duration = 10000; // 10 seconds
      const frameCount = Math.ceil((duration / 1000) * fps);

      for (let i = 0; i < frameCount; i++) {
        const frameNum = String(i).padStart(6, "0");
        const framePath = path.join(framesDir, `frame-${frameNum}.png`);

        await page.screenshot({ path: framePath, type: "png" });

        // Update progress
        if (onProgress) {
          onProgress((i / frameCount) * 100);
        }

        // Simulate interactions
        if (i === Math.floor(frameCount * 0.2)) {
          await page.evaluate(() => {
            window.scrollBy({ top: 300, behavior: "smooth" });
          });
        }

        if (i === Math.floor(frameCount * 0.5)) {
          await page.evaluate(() => {
            window.scrollBy({ top: 300, behavior: "smooth" });
          });
        }

        await page.waitForTimeout(1000 / fps);
      }

      await page.close();
    } finally {
      await browser.close();
    }
  }

  /**
   * Convert frames to MP4
   */
  private convertToVideo(
    videoId: string,
    framesDir: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const inputPattern = path.join(framesDir, "frame-%06d.png");
      const outputPath = path.join(
        this.OUTPUT_DIR,
        `${videoId}-aurastyle-demo.mp4`
      );

      const command = ffmpeg()
        .input(inputPattern)
        .inputFPS(15)
        .output(outputPath)
        .videoCodec("libx264")
        .outputOptions([
          "-crf 28",
          "-pix_fmt yuv420p",
          "-preset ultrafast",
          "-movflags +faststart",
        ]);

      if (onProgress) {
        command.on("progress", (progress) => {
          onProgress(75 + (progress.percent || 0) * 0.25); // 75-100%
        });
      }

      command
        .on("end", () => {
          console.log(`Video created: ${outputPath}`);
          resolve(`generated-videos/${videoId}-aurastyle-demo.mp4`);
        })
        .on("error", reject)
        .run();
    });
  }

  /**
   * Cleanup temporary frames
   */
  private cleanupFrames(framesDir: string): void {
    try {
      const files = fs.readdirSync(framesDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(framesDir, file));
      });
      fs.rmdirSync(framesDir);
      console.log(`Cleaned up: ${framesDir}`);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }
}
