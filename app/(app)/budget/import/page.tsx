import type { Metadata } from 'next'
import Link from 'next/link'

import { NavSpacer } from '@/components/Fab'
import { ChevronLeftIcon } from '@/components/Icons'
import { requireBudget } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import { ImportForm } from './ImportForm'
import styles from './import.module.css'

export const metadata: Metadata = { title: 'Importer des dépenses' }

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
          Fais relire tes captures d'écran bancaires par une IA, puis colle
          sa réponse ici. Rien n'est enregistré avant que tu aies vu ce qui
          sera ajouté.
        </p>
      </div>

      <ImportForm known={known} />
      <NavSpacer />
    </div>
  )
}
