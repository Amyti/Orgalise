/**
 * Lecture des variables d'environnement Supabase.
 *
 * Next remplace `process.env.NEXT_PUBLIC_*` à la compilation : il faut
 * écrire l'accès en toutes lettres, pas via une variable intermédiaire.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase non configuré : renseigne NEXT_PUBLIC_SUPABASE_URL et ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local ' +
        '(Supabase → Project Settings → API).',
    )
  }

  return { url, anonKey }
}

/** Vrai si l'app peut parler à Supabase — sert à afficher un message clair. */
export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
