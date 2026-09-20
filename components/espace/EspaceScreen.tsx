import Link from 'next/link'

import { CheckIcon, ChevronLeftIcon, PlusIcon, RepeatIcon, TrashIcon } from '@/components/Icons'
import { ThemeToggle } from '@/components/ThemeToggle'
import { removeFeed, resyncFeed, signOut } from '@/lib/actions/espace'
import { shortDate } from '@/lib/dates'
import type { Modules } from '@/lib/modules'
import { initial } from '@/lib/space'
import type { CalendarFeed, Space } from '@/lib/types'
import { FeedForm, NameForm, SpaceNameForm } from './Forms'
import { ModulesForm } from './ModulesForm'
import { InviteCode } from './InviteCode'
import styles from './espace.module.css'

type Props = {
  /** `null` quand le compte n'utilise que le budget : il n'a pas d'espace. */
  space: Space | null
  feeds: CalendarFeed[]
  /** `onboarding` = juste après la création, avant d'entrer dans l'app. */
  mode: 'onboarding' | 'app'
  /** Prénom affiché. Utile même sans espace, d'où le passage à part. */
  displayName: string
  modules: Modules
}

/**
 * « Nous » quand il y a un espace partagé, « Réglages » sinon.
 *
 * Un même écran pour les deux cas : ce qui dépend de l'espace — membres,
 * code d'invitation, calendriers — est simplement absent quand il n'y en
 * a pas. Le reste (prénom, outils, apparence, déconnexion) vaut pour tout
 * le monde.
 */
export function EspaceScreen({ space, feeds, mode, displayName, modules }: Props) {
  const onboarding = mode === 'onboarding'

  return (
    <>
      <div className={styles.header}>
        {onboarding ? (
          <>
            <Link href="/groupe" className="backLink" aria-label="Retour">
              <ChevronLeftIcon size={19} color="var(--ink)" />
            </Link>
            <div className={styles.step}>Étape 2 sur 2</div>
          </>
        ) : (
          <div className={styles.step}>{space ? 'Notre espace' : 'Réglages'}</div>
        )}
      </div>

      <div className={styles.intro}>
        <h1 className={`display ${styles.title}`}>
          {space ? space.group.name : 'Réglages'}
        </h1>
        <p className={styles.subtitle}>
          {!space
            ? "Tes outils, ton prénom, l'apparence de l'app."
            : space.partner
              ? `Vous y êtes tous les deux, toi et ${space.partner.display_name}.`
              : "Espace créé. Il manque encore quelqu'un."}
        </p>
      </div>

      {space && !space.partner && (
        <InviteCode code={space.group.invite_code} spaceName={space.group.name} />
      )}

      {/* --- Tout ce qui dépend de l'espace partagé --------------------- */}
      {space && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="sectionTitle">Membres</h2>
            </div>

            <div className="list">
              <div className={styles.row}>
                <div className={styles.memberDot} style={{ background: space.me.color }}>
                  {initial(space.me)}
                </div>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{space.me.display_name}</div>
                  <div className={styles.rowMeta}>
                    {space.group.created_by === space.me.id
                      ? "Créateur de l'espace"
                      : 'Membre'}
                  </div>
                </div>
                <CheckIcon size={18} color="var(--user-b-line)" />
              </div>

              {space.partner ? (
                <div className={styles.row}>
                  <div
                    className={styles.memberDot}
                    style={{ background: space.partner.color }}
                  >
                    {initial(space.partner)}
                  </div>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>{space.partner.display_name}</div>
                    <div className={styles.rowMeta}>
                      A rejoint le {shortDate(new Date(space.partner.joined_at))}
                    </div>
                  </div>
                  <CheckIcon size={18} color="var(--user-b-line)" />
                </div>
              ) : (
                <div className={styles.row}>
                  <div className={styles.pendingDot}>
                    <PlusIcon size={15} color="var(--placeholder)" width={2.2} />
                  </div>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle} style={{ color: 'var(--ink-soft)' }}>
                      En attente
                    </div>
                    <div className={styles.rowMeta}>Elle rejoindra avec le code</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="sectionTitle">Vos calendriers perso</h2>
            </div>

            <div className="list">
              {feeds.filter((f) => f.user_id === space.me.id).length > 0 ? (
                feeds
                  .filter((f) => f.user_id === space.me.id)
                  .map((feed) => (
                    <div key={feed.id} className={styles.row}>
                      <span
                        className={styles.feedDot}
                        style={{ background: space.me.color }}
                      />
                      <div className={styles.rowMain}>
                        <div
                          className={styles.rowTitle}
                          style={{ fontSize: 14, fontWeight: 600 }}
                        >
                          {feed.label}
                        </div>
                        <div className={styles.rowMeta}>
                          {feed.last_synced_at
                            ? `Lien iCal · synchronisé le ${shortDate(new Date(feed.last_synced_at))}`
                            : 'Lien iCal · pas encore synchronisé'}
                        </div>
                      </div>
                      <div className={styles.rowActions}>
                        <form action={resyncFeed}>
                          <input type="hidden" name="feed_id" value={feed.id} />
                          <button
                            type="submit"
                            className={styles.iconButton}
                            aria-label={`Resynchroniser ${feed.label}`}
                          >
                            <RepeatIcon size={16} color="var(--ink-soft)" />
                          </button>
                        </form>
                        <form action={removeFeed}>
                          <input type="hidden" name="feed_id" value={feed.id} />
                          <button
                            type="submit"
                            className={styles.iconButton}
                            aria-label={`Débrancher ${feed.label}`}
                          >
                            <TrashIcon size={16} color="var(--ink-soft)" />
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
              ) : (
                <div className={styles.row}>
                  <span
                    className={styles.feedDot}
                    style={{ background: space.me.color }}
                  />
                  <div className={styles.rowMain}>
                    <div
                      className={styles.rowTitle}
                      style={{ fontSize: 14, fontWeight: 600 }}
                    >
                      Ton calendrier
                    </div>
                    <div className={styles.rowMeta}>Pas encore branché</div>
                  </div>
                </div>
              )}

              <div className={styles.row}>
                <span
                  className={styles.feedDot}
                  style={{
                    background: space.partner
                      ? space.partner.color
                      : 'var(--border-strong)',
                  }}
                />
                <div className={styles.rowMain}>
                  <div
                    className={styles.rowTitle}
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}
                  >
                    {space.partner
                      ? `Celui de ${space.partner.display_name}`
                      : 'Le sien'}
                  </div>
                  <div className={styles.rowMeta}>
                    {space.partner
                      ? 'À brancher depuis son téléphone'
                      : 'À ajouter après son arrivée'}
                  </div>
                </div>
              </div>
            </div>

            <FeedForm />

            <p className={styles.hint}>
              On ne lit que les horaires occupés, jamais le contenu des
              événements.
            </p>
          </section>
        </>
      )}

      {/* --- Réglages, valables avec ou sans espace --------------------- */}
      {!onboarding && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="sectionTitle">Ton prénom</h2>
            </div>
            <NameForm current={displayName} />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="sectionTitle">Tes outils</h2>
            </div>
            <ModulesForm current={modules} />
          </section>

          {modules.budget && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className="sectionTitle">Importer des dépenses</h2>
              </div>
              <Link href="/budget/import" className={styles.toggleLink}>
                Depuis des captures d'écran
              </Link>
              <p className={styles.hint}>
                Choisis les captures de ton appli bancaire, l'app en tire tes
                dépenses et te les montre avant de les enregistrer.
              </p>
            </section>
          )}

          {space && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className="sectionTitle">Nom de l'espace</h2>
              </div>
              <SpaceNameForm current={space.group.name} />
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="sectionTitle">Apparence</h2>
            </div>
            <ThemeToggle />
          </section>
        </>
      )}

      <div className={styles.spacer} />

      <div className={styles.foot}>
        {onboarding ? (
          <Link href="/accueil" className="btnPrimary">
            Entrer dans l'espace
          </Link>
        ) : (
          <form action={signOut}>
            <button type="submit" className={styles.signOut}>
              Se déconnecter
            </button>
          </form>
        )}
      </div>
    </>
  )
}
