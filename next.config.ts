import type { NextConfig } from "next";

const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ||
  (process.env.GITHUB_PAGES ? `/${process.env.GITHUB_REPOSITORY?.split("/")?.[1] ?? ""}` : "");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
