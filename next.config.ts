import type { NextConfig } from "next";

/** Project-site path on GitHub Pages, e.g. "/dollyzoom". Empty for user/org site or local. */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages serves directories cleanly with trailing slash + index.html
  trailingSlash: true,
  // next/image optimizer needs a server; disable for static hosting
  images: {
    unoptimized: true,
  },
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),
  // cacheComponents / partialPrefetching enable PPR, which is incompatible with output: 'export'
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
