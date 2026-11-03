/** Backend origin the same-origin `/api/*` path is proxied to (server-side only, never bundled). */
const apiOrigin = (process.env.RMS_API_ORIGIN ?? 'https://rms-api.shahzaiibimran.workers.dev').replace(/\/$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }]
  },
}

export default nextConfig
