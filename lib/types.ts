/** Lignes de la base, telles que `schema.sql` les définit. */

export type Profile = {
  id: string
  display_name: string
  color: string
}

export type Member = Profile & {
  role: string
  joined_at: string
}

export type Group = {
  id: string
  name: string
  invite_code: string
  created_by: string
}

export type EventRow = {
  id: string
  group_id: string
  title: string
  notes: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  tz: string
  rrule: string | null
  exdates: string[] | null
  created_by: string
}

export type BusyBlock = {
  id: string
  user_id: string
  starts_at: string
  ends_at: string
}

export type CalendarFeed = {
  id: string
  user_id: string
  label: string
  url: string
  last_synced_at: string | null
}

export type Category = {
  id: string
  name: string
  color: string
  position: number
}

export type Expense = {
  id: string
  category_id: string | null
  amount_cents: number
  label: string
  spent_on: string
  created_at: string
}

export type Budget = {
  month: string
  limit_cents: number
}

/** Contexte partagé par tous les écrans de l'app : qui, avec qui, où. */
export type Space = {
  group: Group
  me: Member
  /** `null` tant que la deuxième personne n'a pas rejoint. */
  partner: Member | null
}
