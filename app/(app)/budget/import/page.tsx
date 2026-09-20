import type { Metadata } from 'next'
import Link from 'next/link'

import { NavSpacer } from '@/components/Fab'
import { ChevronLeftIcon } from '@/components/Icons'
import { MAX_IMAGES, hasAiKey } from '@/lib/ai'
import { requireBudget } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import { ImportForm } from './ImportForm'
import styles from './import.module.css'

export const metadata: Metadata = { title: 'Importer des dépenses' }

/*
 * Lire six captures prend une dizaine de secondes. Le plafond par défaut
 * d'une fonction Vercel couperait l'appel en plein milieu.
 */
export const maxDuration = 60

export default async function ImportPage() {
  await requireBudget()

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('name, position')
    .order('position')

  // Les noms réels de la personne, pas la liste par défaut : l'invite
  // remise à l'IA doit décrire ses catégories à elle.
  const known = (categories ?? []).map((c) => c.name as string)

  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.bar}>
        <Link href="/nous" className="backLink" aria-label="Retour aux réglages">
          <ChevronLeftIcon size={19} color="var(--ink)" />
        </Link>
      </div>

      <div className={styles.titleZone}>
        <h1 className={`display ${styles.title}`}>Importer des dépenses</h1>
        <p className={styles.lede}>
          Choisis les captures de ton appli bancaire, l'app en tire tes
          dépenses. Rien n'est enregistré avant que tu aies vu la liste.
        </p>
      </div>

      <ImportForm known={known} aiReady={hasAiKey()} maxImages={MAX_IMAGES} />
      <NavSpacer />
    </div>
  )
}
