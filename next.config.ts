import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Native/binary packages must be required at runtime, never bundled.
  serverExternalPackages: [
    "better-sqlite3",
    "sharp",
    "ffmpeg-static",
    "@derhuerst/ffprobe-static",
    "pino",
  ],
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
