import { BottomNav } from '@/components/BottomNav'
import { SyncOnOpen } from '@/components/SyncOnOpen'
import { requireSpace } from '@/lib/space'

/**
 * Coque des écrans internes : garde d'accès, barre basse, synchro iCal.
 * Sans espace, on repart au parcours d'entrée — `requireSpace` s'en charge.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSpace()

  return (
    <>
      {children}
      <BottomNav />
      <SyncOnOpen />
    </>
  )
}
