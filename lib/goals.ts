import { daysInMonth, type SavingsRule } from './forecast'
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

/**
 * Une règle d'épargne mensuelle : ce qu'on met vraiment de côté.
 *
 * `goal_id` à `null` = épargne libre, qui sort de l'enveloppe sans être
 * fléchée. La forme est définie dans `lib/forecast.ts`, avec les autres
 * règles projetables.
 */
export type SavingsPlan = SavingsRule

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
  /** Ce qu'on a déclaré mettre de côté chaque mois pour cet objectif. */
  declaredCents: number
  /**
   * Ce qu'on aura à l'échéance au rythme déclaré. Vaut l'épargne
   * actuelle quand rien n'est déclaré.
   */
  projectedCents: number
  /** Ce qui manquera à l'échéance à ce rythme. Zéro si l'objectif tient. */
  shortfallCents: number
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

export function statusOf(goal: Goal, now: Date, declaredCents = 0): GoalStatus {
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

  // Au rythme déclaré, où en sera-t-on à l'échéance ? C'est la question
  // que « 40 % atteints » ne répond jamais.
  const projected = goal.saved_cents + declaredCents * monthsLeft

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
    declaredCents,
    projectedCents: projected,
    shortfallCents: Math.max(0, goal.target_cents - projected),
  }
}

/**
 * Ce que les objectifs retiennent d'OFFICE sur l'enveloppe.
 *
 * Trois conditions : la case est cochée, l'objectif n'est ni atteint ni
 * en retard — un objectif dépassé cesse de peser, sinon il écraserait le
 * budget indéfiniment — et surtout **rien n'a été déclaré pour lui**.
 *
 * Ce dernier point est la règle qui compte : dès qu'on dit « je mets
 * 300 € par mois », ce sont ces 300 € qui sortent de l'enveloppe, pas
 * les 1 111 € théoriques. On retient ce qui part vraiment du compte ; le
 * montant nécessaire, lui, reste affiché comme un avertissement.
 *
 * L'épargne déclarée est comptée ailleurs, par `forecastMonth`, qui la
 * projette comme une règle — elle sort de l'enveloppe qu'elle soit
 * fléchée vers un objectif ou libre.
 */
export function heldCents(statuses: GoalStatus[]): number {
  return statuses
    .filter((s) => s.goal.hold_in_budget && !s.done && !s.late && s.declaredCents === 0)
    .reduce((total, s) => total + s.shareCents, 0)
}

/** Total déclaré pour chaque objectif, par mois. Clé `null` : épargne libre. */
export function declaredByGoal(plans: SavingsPlan[]): Map<string | null, number> {
  const totals = new Map<string | null, number>()
  for (const plan of plans) {
    totals.set(plan.goal_id, (totals.get(plan.goal_id) ?? 0) + plan.amount_cents)
  }
  return totals
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
