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
  /**
   * card.calo.company is the card, and nothing else.
   *
   * The address somebody reads off a screen or hears in a bar has to be short
   * and free of machinery, so /c/ disappears on that host: card.calo.company
   * is Mike's, and card.calo.company/someone-else works the day there is one.
   *
   * Scoped by host rather than applied everywhere, or every path in the whole
   * app would start resolving to a business card.
   */
  async rewrites() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'card.calo.company' }],
        destination: '/c/mike',
      },
      {
        source: '/:slug((?!c/|api/|_next/|favicon).*)',
        has: [{ type: 'host', value: 'card.calo.company' }],
        destination: '/c/:slug',
      },
    ];
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
