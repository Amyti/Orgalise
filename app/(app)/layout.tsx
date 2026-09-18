import { BottomNav } from '@/components/BottomNav'
import { SyncOnOpen } from '@/components/SyncOnOpen'
import { requireProfile } from '@/lib/space'

/**
 * Coque des écrans internes : garde d'accès, barre basse, synchro iCal.
 * Sans espace, on repart au parcours d'entrée — `requireSpace` s'en charge.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Pas `requireSpace` : un compte qui n'utilise que le budget n'a pas
  // d'espace partagé, et ne doit pas être renvoyé vers la création d'un.
  const profile = await requireProfile()

  return (
    <>
      {children}
      <BottomNav modules={profile.modules} />
      {/* La synchro iCal ne sert qu'à l'agenda : inutile de la déclencher
          pour un compte qui n'utilise que le budget. */}
      {profile.modules.agenda && <SyncOnOpen />}
    </>
  )
}
