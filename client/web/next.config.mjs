/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compile the raw-TS workspace packages we import.
  transpilePackages: ["@invoixe/core", "@invoixe/types"],
};

export default nextConfig;
