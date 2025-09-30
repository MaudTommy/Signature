/**
 * Next.js configuration for static export and GitHub Pages basePath.
 * basePath/assetPrefix are derived from env at build time.
 */

const nextBasePath = process.env.NEXT_BASE_PATH || ""; // e.g. "/repo" or ""

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  basePath: nextBasePath,
  assetPrefix: nextBasePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
