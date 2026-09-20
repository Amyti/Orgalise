import { daysInMonth } from './forecast'
import { parseIsoDay, startOfMonth, wall } from './dates'

/**
 * Objectifs d'épargne.
 *
 * Le chiffre qui porte un objectif n'est pas la barre de progression,
 * c'est **ce qu'il faut mettre de côté ce mois-ci**. « 10 000 € avant
 * juin 2027 » ne dit rien ; « 1 111 € par mois » dit tout, et
 * éventuellement que l'objectif est hors de portée.
 *
 * Comme les revenus et les charges fixes (CLAUDE.md, décision 7), rien
 * n'est déplié en base : on stocke la cible et l'échéance, et on projette
 * à l'affichage. Le montant mensuel se recalcule donc tout seul quand on
 * met à jour ce qu'on a déjà de côté, ou quand un mois passe.
 */

export type Goal = {
  id: string
  user_id: string
  /** `null` = personnel. Renseigné = partagé dans l'espace. */
  group_id: string | null
  label: string
  target_cents: number
  saved_cents: number
  /** Jour ISO. */
  target_on: string
  hold_in_budget: boolean
}

export type GoalStatus = {
  goal: Goal
  shared: boolean
  /** Ce qu'il reste à réunir. Jamais négatif. */
  remainingCents: number
  /** Mois pleins restants avant l'échéance. */
  monthsLeft: number
  /** À mettre de côté ce mois-ci pour tenir le rythme. */
  monthlyCents: number
  /** Part qui pèse sur une personne : la moitié si l'objectif est commun. */
  shareCents: number
  /** Entre 0 et 1. */
  ratio: number
  done: boolean
  /** Échéance dépassée sans que la cible soit atteinte. */
  late: boolean
}

/**
 * Mois pleins entre deux dates, par différence de calendrier.
 *
 * On compte des mois, pas des jours : une échéance au 1er juin et une au
 * 30 juin demandent le même effort mensuel, puisqu'on met de côté une
 * fois par mois. Compter les jours ferait varier le montant d'un
 * quinzième selon le jour choisi, pour rien.
 */
export function monthsBetween(from: Date, to: Date): number {
  const a = wall(from)
  const b = wall(to)
  return (b.year - a.year) * 12 + (b.month - a.month)
}

export function statusOf(goal: Goal, now: Date): GoalStatus {
  const target = parseIsoDay(goal.target_on)
  const remainingCents = Math.max(0, goal.target_cents - goal.saved_cents)
  const done = remainingCents === 0

  const monthsLeft = target ? Math.max(0, monthsBetween(now, target)) : 0
  const late = !done && target !== null && target.getTime() < startOfMonth(now).getTime()

  /*
   * Il reste toujours le mois en cours pour agir : une échéance ce
   * mois-ci, ou déjà passée, demande le solde d'un coup plutôt qu'une
   * division par zéro.
   */
  const effective = Math.max(1, monthsLeft)
  const monthlyCents = done ? 0 : Math.ceil(remainingCents / effective)

  return {
    goal,
    shared: goal.group_id !== null,
    remainingCents,
    monthsLeft,
    monthlyCents,
    // Un objectif commun se partage en deux parts égales. C'est une
    // convention, mais elle est prévisible — et deux, ici, c'est la
    // taille maximale d'un espace.
    shareCents: goal.group_id ? Math.ceil(monthlyCents / 2) : monthlyCents,
    ratio: goal.target_cents === 0 ? 0 : Math.min(1, goal.saved_cents / goal.target_cents),
    done,
    late,
  }
}

/**
 * Ce que les objectifs ponctionnent sur l'enveloppe d'un mois.
 *
 * Seuls comptent ceux dont la case est cochée, et seulement tant que
 * l'échéance n'est pas passée : un objectif en retard cesse de peser sur
 * le budget, sinon il l'écraserait indéfiniment.
 */
export function heldCents(statuses: GoalStatus[]): number {
  return statuses
    .filter((s) => s.goal.hold_in_budget && !s.done && !s.late)
    .reduce((total, s) => total + s.shareCents, 0)
}

/**
 * Rythme tenu ou non, d'après le temps écoulé depuis la création.
 *
 * Sert au message : « tu es en avance » vaut mieux qu'un pourcentage nu.
 */
export function onTrack(status: GoalStatus, startedOn: Date, now: Date): boolean | null {
  const target = parseIsoDay(status.goal.target_on)
  if (!target || status.done) return null

  const total = monthsBetween(startedOn, target)
  if (total <= 0) return null

  const elapsed = Math.max(0, monthsBetween(startedOn, now))
  const attendu = Math.min(1, elapsed / total)
  return status.ratio >= attendu
}

/** Jours restants dans le mois — pour « il reste X à mettre de côté ». */
export function daysLeftInMonth(now: Date): number {
  const w = wall(now)
  return Math.max(1, daysInMonth(now) - w.day + 1)
}
