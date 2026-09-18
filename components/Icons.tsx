/**
 * Icônes de l'app — SVG en trait, `stroke-width` 1.8–2.2 (CLAUDE.md).
 * Reprises telles quelles des maquettes : mêmes tracés, mêmes épaisseurs.
 */

type Props = {
  size?: number
  color?: string
  width?: number
}

function svgProps({ size = 21, color = 'currentColor', width = 1.8 }: Props) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function HomeIcon(p: Props) {
  return (
    <svg {...svgProps(p)}>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
    </svg>
  )
}

export function CalendarIcon(p: Props) {
  return (
    <svg {...svgProps(p)}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

export function WalletIcon(p: Props) {
  return (
    <svg {...svgProps(p)}>
      <path d="M3 7h18v12H3z" />
      <path d="M3 11h18M7 15h3" />
    </svg>
  )
}

export function PeopleIcon(p: Props) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    </svg>
  )
}

export function PlusIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2.2, ...p })}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ArrowRightIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2.2, ...p })}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  )
}

export function ChevronLeftIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2.2, ...p })}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function ChevronRightIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2.2, ...p })}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function CheckIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2.4, ...p })}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  )
}

export function CloseIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2.2, ...p })}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function SearchIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2, ...p })}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  )
}

export function DownloadIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2, ...p })}>
      <path d="M12 4v12M12 16l-5-5M12 16l5-5" />
      <path d="M4 18v2h16v-2" />
    </svg>
  )
}

export function ShareIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2, ...p })}>
      <path d="M12 16V4M12 4L7 9M12 4l5 5" />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  )
}

export function LockIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 1.9, ...p })}>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  )
}

export function TrashIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2, ...p })}>
      <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
    </svg>
  )
}

export function RepeatIcon(p: Props) {
  return (
    <svg {...svgProps({ width: 2, ...p })}>
      <path d="M4 10V8a3 3 0 013-3h10l-3-3M20 14v2a3 3 0 01-3 3H7l3 3" />
    </svg>
  )
}
