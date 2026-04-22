/** @type {import('next').NextConfig} */
const config = {
  output: 'export',   // Required for Capacitor — generates a static build
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
