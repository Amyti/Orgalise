import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next dev` ajoute sinon son propre bloc à la fin de CLAUDE.md,
  // qui est écrit à la main ici.
  agentRules: false,
}

export default nextConfig
