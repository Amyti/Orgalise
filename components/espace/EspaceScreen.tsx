import Link from 'next/link'

import { CheckIcon, ChevronLeftIcon, PlusIcon, RepeatIcon, TrashIcon } from '@/components/Icons'
import { ThemeToggle } from '@/components/ThemeToggle'
import { removeFeed, resyncFeed, signOut } from '@/lib/actions/espace'
import { shortDate } from '@/lib/dates'
import { initial } from '@/lib/space'
import type { CalendarFeed, Space } from '@/lib/types'
import { FeedForm, NameForm, SpaceNameForm } from './Forms'
import { InviteCode } from './InviteCode'
import styles from './espace.module.css'

type Props = {
  space: Space
  feeds: CalendarFeed[]
  /** `onboarding` = juste après la création, avant d'entrer dans l'app. */
  mode: 'onboarding' | 'app'
}

export function EspaceScreen({ space, feeds, mode }: Props) {
  const { group, me, partner } = space
  const onboarding = mode === 'onboarding'

  const myFeeds = feeds.filter((f) => f.user_id === me.id)
  const partnerFeeds = partner ? feeds.filter((f) => f.user_id === partner.id) : []

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
          <div className={styles.step}>Notre espace</div>
        )}
      </div>

      <div className={styles.intro}>
        <h1 className={`display ${styles.title}`}>{group.name}</h1>
        <p className={styles.subtitle}>
          {partner
            ? `Vous y êtes tous les deux, toi et ${partner.display_name}.`
            : "Espace créé. Il manque encore quelqu'un."}
        </p>
      </div>

      {!partner && (
        <InviteCode code={group.invite_code} spaceName={group.name} />
      )}

      {/* --- Membres ---------------------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">Membres</h2>
        </div>

        <div className="list">
          <div className={styles.row}>
            <div className={styles.memberDot} style={{ background: me.color }}>
              {initial(me)}
            </div>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>{me.display_name}</div>
              <div className={styles.rowMeta}>
                {group.created_by === me.id ? "Créateur de l'espace" : 'Membre'}
              </div>
            </div>
            <CheckIcon size={18} color="var(--user-b-line)" />
          </div>

          {partner ? (
            <div className={styles.row}>
              <div className={styles.memberDot} style={{ background: partner.color }}>
                {initial(partner)}
              </div>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{partner.display_name}</div>
                <div className={styles.rowMeta}>
                  A rejoint le {shortDate(new Date(partner.joined_at))}
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

        {!onboarding && <NameForm current={me.display_name} />}
      </section>

      {/* --- Calendriers perso ------------------------------------------ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">Vos calendriers perso</h2>
        </div>

        <div className="list">
          {myFeeds.length > 0 ? (
            myFeeds.map((feed) => (
              <div key={feed.id} className={styles.row}>
                <span className={styles.feedDot} style={{ background: me.color }} />
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle} style={{ fontSize: 14, fontWeight: 600 }}>
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
              <span className={styles.feedDot} style={{ background: me.color }} />
              <div className={styles.rowMain}>
                <div className={styles.rowTitle} style={{ fontSize: 14, fontWeight: 600 }}>
                  Ton calendrier
                </div>
                <div className={styles.rowMeta}>Pas encore branché</div>
              </div>
            </div>
          )}

          <div className={styles.row}>
            <span
              className={styles.feedDot}
              style={{ background: partner ? partner.color : 'var(--border-strong)' }}
            />
            <div className={styles.rowMain}>
              <div
                className={styles.rowTitle}
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}
              >
                {partner ? `Celui de ${partner.display_name}` : 'Le sien'}
              </div>
              <div className={styles.rowMeta}>
                {partnerFeeds.length > 0
                  ? `${partnerFeeds.length} calendrier(s) branché(s)`
                  : partner
                    ? "À brancher depuis son téléphone"
                    : 'À ajouter après son arrivée'}
              </div>
            </div>
          </div>
        </div>

        <FeedForm />

        <p className={styles.hint}>
          On ne lit que les horaires occupés, jamais le contenu des événements.
        </p>
      </section>

      {!onboarding && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="sectionTitle">Nom de l'espace</h2>
            </div>
            <SpaceNameForm current={group.name} />
          </section>

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
