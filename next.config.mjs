/** @type {import('next').NextConfig} */
const config = {
  // 'output: export' is only needed for Capacitor builds (npx cap sync).
  // On Vercel, omit it so API routes (NextAuth) work server-side.
  // To build for Capacitor locally: set OUTPUT=export before running next build.
  ...(process.env.OUTPUT === 'export' && {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default config;
