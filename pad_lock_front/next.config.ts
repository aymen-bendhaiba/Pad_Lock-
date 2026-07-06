import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://78.46.43.206:3000/api";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;