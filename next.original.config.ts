import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF where the browser supports it (~20% smaller than WebP), WebP otherwise.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
