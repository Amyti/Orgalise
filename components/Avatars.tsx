import { line } from '@/components/agenda/Strip'
import { initial } from '@/lib/space'
import type { Space } from '@/lib/types'

/**
 * Les deux pastilles qui se chevauchent, signature de l'app.
 * Quand la deuxième personne n'a pas encore rejoint, sa place reste
 * visible en pointillés — l'espace est fait pour deux.
 */
export function Avatars({ space }: { space: Space }) {
  const { me, partner } = space

  return (
    <div style={{ display: 'flex', alignItems: 'center' }} aria-hidden="true">
      <div
        className="avatar"
        style={{ background: me.color, boxShadow: `inset 0 0 0 1.5px ${line(me.color)}` }}
      >
        {initial(me)}
      </div>
      {partner ? (
        <div
          className="avatar"
          style={{
            background: partner.color,
            boxShadow: `inset 0 0 0 1.5px ${line(partner.color)}`,
            marginLeft: -11,
          }}
        >
          {initial(partner)}
        </div>
      ) : (
        <div
          className="avatar"
          style={{
            marginLeft: -11,
            background: 'var(--ground)',
            border: '1.5px dashed var(--dashed)',
            color: 'var(--ink-soft)',
            fontSize: 15,
          }}
        >
          ·
        </div>
      )}
    </div>
  )
}
