/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/ads.txt",
        destination: "/api/adstxt",
      },
    ];
  },
};

module.exports = nextConfig;