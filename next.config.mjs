/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Serve a Chrome-friendly default locale hint; menu/images come from public/.
  async headers() {
    return [
      {
        // Basic origin-agnostic guard on the order API.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;