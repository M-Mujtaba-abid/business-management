/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // The bill image reads the logo and fonts from disk: ship them with those routes on Vercel
    outputFileTracingIncludes: {
      '/api/sales/[id]/bill': ['./public/logo.png', './assets/fonts/**'],
      '/api/sales/[id]/bill/whatsapp': ['./public/logo.png', './assets/fonts/**'],
    },
  },
}

module.exports = nextConfig
