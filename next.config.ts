import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Syllabus PDFs go through a Server Action. Vercel caps request bodies at 4.5 MB,
      // so this matches what will work once deployed.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
