/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // La page /guide lit guide.md au runtime : l'inclure dans le bundle serverless (Vercel).
  experimental: {
    outputFileTracingIncludes: {
      "/guide": ["./guide.md"],
    },
  },
};

export default nextConfig;
