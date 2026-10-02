import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nén gzip của Next có thể giữ đệm luồng SSE (Content Studio) khiến chữ không hiện dần.
  // Tắt ở đây: Vercel/CDN vẫn tự nén phản hồi ở tầng nền tảng.
  compress: false,
  // Web gọi /api/* cùng origin, Next chuyển tiếp sang NestJS (không cần CORS).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_URL ?? "http://localhost:3001"}/api/:path*` }];
  },
};

export default nextConfig;
