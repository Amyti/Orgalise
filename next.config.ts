import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next dev` ajoute sinon son propre bloc à la fin de CLAUDE.md,
  // qui est écrit à la main ici.
  agentRules: false,
  experimental: {
    /*
     * Cache client du routeur.
     *
     * Depuis Next 15, `dynamic` vaut 0 : revenir sur un onglet refait
     * tout le trajet serveur, même deux secondes après l'avoir quitté.
     * Or l'usage de l'app est précisément de passer d'Accueil à Agenda à
     * Budget. À 30 s, ces allers-retours deviennent instantanés, sans
     * réseau.
     *
     * Le risque est nul ici : une donnée vieille de 30 s ne change rien à
     * un agenda de couple, et toute saisie appelle `revalidatePath`, qui
     * vide ce cache immédiatement.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
}

export default nextConfig
