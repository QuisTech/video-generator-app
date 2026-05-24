"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface StatusResponse {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  downloadUrl?: string;
  error?: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDownloadUrl(null);

    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    try {
      setIsGenerating(true);
      setStatus("Initializing video generation...");
      setProgress(5);

      const response = await fetch(`${apiUrl}/api/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start video generation");
      }

      const newJobId = data.jobId;
      setJobId(newJobId);
      setProgress(10);

      pollProgress(newJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsGenerating(false);
    }
  };

  const pollProgress = async (id: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/video-status/${id}`);
        const data: StatusResponse = await response.json();

        setProgress(data.progress);
        setStatus(data.status);

        if (data.status === "completed") {
          clearInterval(pollInterval);
          setDownloadUrl(data.downloadUrl);
          setIsGenerating(false);
          setStatus("✅ Video ready for download!");
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setError(data.error || "Video generation failed");
          setIsGenerating(false);
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 2000);
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;

    try {
      const response = await fetch(`${apiUrl}${downloadUrl}`);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "aurastyle-demo.mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError("Failed to download video");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.h1
              className="text-4xl font-bold text-white mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              🎬 Demo Video Generator
            </motion.h1>
            <motion.p
              className="text-gray-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Transform your website into a stunning demo video in minutes
            </motion.p>
          </div>

          {/* Form */}
          <form onSubmit={handleGenerateVideo} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Enter Your Website URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.vercel.app"
                disabled={isGenerating}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Generate Button */}
            {!isGenerating && !downloadUrl && (
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition shadow-lg"
              >
                🚀 Generate Video
              </motion.button>
            )}

            {/* Progress */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>{status}</span>
                    <span>{Math.min(progress, 100)}%</span>
                  </div>
                  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden border border-white/20">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 text-center text-sm text-gray-300">
                  ⏳ Don't close this window. Video generation in progress...
                </div>
              </motion.div>
            )}

            {/* Download Section */}
            {downloadUrl && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-center text-green-200">
                  ✅ Your video is ready!
                </div>
                <motion.button
                  type="button"
                  onClick={handleDownload}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition shadow-lg flex items-center justify-center gap-2"
                >
                  📥 Download Video (MP4)
                </motion.button>
              </motion.div>
            )}

            {/* Reset Button */}
            {downloadUrl && (
              <motion.button
                type="button"
                onClick={() => {
                  setUrl("");
                  setJobId(null);
                  setProgress(0);
                  setStatus("");
                  setDownloadUrl(null);
                  setError(null);
                }}
                className="w-full py-2 text-gray-300 hover:text-white transition"
              >
                ← Generate Another Video
              </motion.button>
            )}
          </form>

          {/* Features */}
          <div className="mt-12 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl mb-2">⚡</div>
              <div className="text-gray-300">Fast</div>
              <div className="text-xs text-gray-400">5-10 min</div>
            </div>
            <div>
              <div className="text-2xl mb-2">🎬</div>
              <div className="text-gray-300">HD Quality</div>
              <div className="text-xs text-gray-400">1280x720</div>
            </div>
            <div>
              <div className="text-2xl mb-2">🎨</div>
              <div className="text-gray-300">Automated</div>
              <div className="text-xs text-gray-400">30 FPS</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
