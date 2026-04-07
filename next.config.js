/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qwncdybiluseypcovitd.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/studio',
        destination: '/design',
        permanent: true,
      },
      {
        source: '/clients/:id/brand-builder',
        destination: '/design?client=:id&template=yard-sign',
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig
// deploy trigger
