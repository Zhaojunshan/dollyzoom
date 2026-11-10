import type { NextConfig } from "next";

/**
 * Subpath for a GitHub Pages project URL, e.g. "/dollyzoom".
 * Production leaves this empty: https://dollyzoom.top is served at the site root.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/**
 * One export has to load under both hosts:
 * - https://dollyzoom.top/ (custom domain, root) — primary
 * - https://<user>.github.io/dollyzoom/ (project URL)
 * A relative asset prefix resolves `_next` next to the HTML directory, so the
 * same files work in both places. An absolute "/_next/..." prefix 404s on the
 * project URL. Dev, and any explicit basePath, keep an absolute prefix.
 */
const relativeAssets =
  process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1" && basePath === "";

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
    : relativeAssets
      ? { assetPrefix: "." }
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
