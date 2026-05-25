import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { VideoGenerator } from "./videoGenerator";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("generated-videos"));

// Store for tracking jobs
interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  url: string;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
}

const jobs: Map<string, JobStatus> = new Map();
const videoGenerator = new VideoGenerator();

// Cleanup old jobs every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 3600000);
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}, 3600000);

/**
 * POST /api/generate-video
 */
app.post("/api/generate-video", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Create job
    const jobId = uuidv4();
    const job: JobStatus = {
      id: jobId,
      status: "pending",
      progress: 0,
      url,
      createdAt: new Date(),
    };

    jobs.set(jobId, job);

    // Start video generation in background
    generateVideoAsync(jobId, url);

    res.json({ jobId });
  } catch (error) {
    console.error("Error starting video generation:", error);
    res.status(500).json({ error: "Failed to start video generation" });
  }
});

/**
 * GET /api/video-status/:jobId
 */
app.get("/api/video-status/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json({
    status: job.status,
    progress: job.progress,
    downloadUrl: job.downloadUrl,
    error: job.error,
  });
});

/**
 * GET /api/download/:jobId
 */
app.get("/api/download/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job || job.status !== "completed" || !job.downloadUrl) {
    return res.status(404).json({ error: "Video not found" });
  }

  const filePath = path.join(process.cwd(), job.downloadUrl);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.download(filePath, "aurastyle-demo.mp4", (err) => {
    if (err) console.error("Download error:", err);
  });
});

/**
 * Health check
 */
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

/**
 * Background video generation
 */
async function generateVideoAsync(
  jobId: string,
  url: string
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = "processing";
    job.progress = 15;

    // Generate video
    const outputPath = await videoGenerator.generate(
      url,
      (progress) => {
        job.progress = 15 + progress * 0.8; // 15-95%
      }
    );

    job.downloadUrl = outputPath;
    job.progress = 100;
    job.status = "completed";
  } catch (error) {
    console.error("Video generation failed:", error);
    job.status = "failed";
    job.error =
      error instanceof Error ? error.message : "Unknown error occurred";
  }
}

app.listen(PORT, () => {
  console.log(`\n🚀 Video Generator API running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}\n`);
});
