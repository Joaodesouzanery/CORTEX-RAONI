/** @type {import('next').NextConfig} */

// Article thumbnails are rendered with <Image unoptimized> (and logos with plain
// <img>), so they bypass Next's image optimizer and don't need an allowlist.
// We restrict remotePatterns to the Supabase Storage host only — this avoids
// turning the optimizer into an open image proxy (the old `**` wildcard did).
const remotePatterns = []
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    remotePatterns.push({ protocol: 'https', hostname: new URL(supabaseUrl).hostname })
  }
} catch {
  // Invalid/missing URL — leave remotePatterns empty.
}

const nextConfig = {
  images: {
    remotePatterns,
  },
}
module.exports = nextConfig
