/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@varyn/shared'],
  output: 'standalone',
};

export default nextConfig;
