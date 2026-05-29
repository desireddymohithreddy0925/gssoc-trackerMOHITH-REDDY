import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GSSoC 2026 Leaderboard',
    short_name: 'GSSoC Tracker',
    description: 'Track your progress on the official GirlScript Summer of Code (GSSoC) 2026 leaderboard. Discover top open-source contributors, search profiles, view PR stats, and monitor live rankings.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#f97316',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/opengraph-image.png',
        sizes: '1200x630',
        type: 'image/png',
      },
    ],
  };
}
