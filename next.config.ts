import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The Cline SDK (@cline/sdk -> @cline/core/agents/shared/llms) pulls in Node-only
  // modules that Turbopack must not bundle into route handlers. Keep them external so
  // they load from node_modules at runtime (Node runtime only).
  serverExternalPackages: [
    "@cline/sdk",
    "@cline/core",
    "@cline/agents",
    "@cline/shared",
    "@cline/llms",
  ],
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
