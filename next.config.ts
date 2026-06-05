import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  // Optimize barrel file imports (bundle-barrel-imports)
  experimental: {
    // optimizePackageImports: ["lucide-react"],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins = config.plugins || [];

      // Use NormalModuleReplacementPlugin to rewrite node: protocol imports
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          },
        ),
      );

      // Provide browser polyfills for Node.js built-in modules
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: "crypto-browserify",
        stream: "stream-browserify",
        buffer: "buffer",
      };
    }
    return config;
  },
  env: {
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID:
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  // Ensure local registry assets are traced into the build for the docs route
  outputFileTracingIncludes: {
    "/app/docs/[[...slug]]": ["registry/**", "public/r/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
