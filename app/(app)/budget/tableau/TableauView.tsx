'use client'

import { useMemo, useState } from 'react'

import { SearchIcon, TrashIcon } from '@/components/Icons'
import { deleteExpense } from '@/lib/actions/expenses'
import { groupByDay } from '@/lib/expenses-shape'
import { dayLabel, numericDate, parseIsoDay } from '@/lib/dates'
import { euros } from '@/lib/money'
import type { Category, Expense } from '@/lib/types'
import styles from './tableau.module.css'

/**
 * Recherche et filtres côté client : sur un mois de dépenses à deux
 * chiffres, un aller-retour serveur par frappe serait absurde.
 */
export function TableauView({
  expenses,
  categories,
  monthLabel,
}: {
  expenses: Expense[]
  categories: Category[]
  monthLabel: string
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('')

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return expenses.filter((expense) => {
      if (filter && expense.category_id !== filter) return false
      if (!needle) return true
      const category = expense.category_id ? byId.get(expense.category_id) : undefined
      return (
        expense.label.toLowerCase().includes(needle) ||
        (category?.name.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [expenses, query, filter, byId])

  const groups = useMemo(() => groupByDay(filtered), [filtered])
  const total = filtered.reduce((sum, e) => sum + e.amount_cents, 0)
  const now = new Date()

  // Seules les catégories réellement utilisées méritent un filtre.
  const used = categories.filter((c) => expenses.some((e) => e.category_id === c.id))

  return (
    <>
      <div className={styles.searchZone}>
        <div className={styles.search}>
          <SearchIcon size={16} color="var(--placeholder)" />
          <label className="srOnly" htmlFor="q">
            Rechercher une dépense
          </label>
          <input
            id="q"
            type="search"
            className={styles.searchInput}
            placeholder="Rechercher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filter} ${filter === '' ? styles.filterOn : ''}`}
          onClick={() => setFilter('')}
        >
          Tout
        </button>
        {used.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`${styles.filter} ${filter === category.id ? styles.filterOn : ''}`}
            onClick={() => setFilter(filter === category.id ? '' : category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className={styles.table}>
        <div className={styles.tableHead} aria-hidden="true">
          <div className={styles.colDate}>DATE</div>
          <div className={styles.colLabel}>INTITULÉ</div>
          <div className={styles.colAmount}>MONTANT</div>
        </div>

        {groups.length === 0 ? (
          <div className="empty">
            {expenses.length === 0
              ? `Aucune dépense en ${monthLabel}.`
              : 'Rien ne correspond à cette recherche.'}
          </div>
        ) : (
          groups.map((group) => {
            const day = parseIsoDay(group.day) ?? now
            return (
              <div key={group.day}>
                <div className={styles.groupHead}>
                  <span className={styles.groupDay}>{dayLabel(day, now)}</span>
                  <span className={styles.groupSum}>{euros(group.cents)}</span>
                </div>
                {group.rows.map((expense) => {
                  const category = expense.category_id
                    ? byId.get(expense.category_id)
                    : undefined
                  return (
                    <div key={expense.id} className={styles.row}>
                      <div className={styles.rowDate}>{numericDate(day)}</div>
                      <div className={styles.rowMain}>
                        <div className={styles.rowLabel}>{expense.label}</div>
                        <div className={styles.rowCat}>
                          <span
                            className={styles.rowCatDot}
                            style={{ background: category?.color ?? 'var(--cat-autre)' }}
                          />
                          <span className={styles.rowCatName}>
                            {category?.name ?? 'Sans catégorie'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.rowAmount}>{euros(expense.amount_cents)}</div>
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={expense.id} />
                        <button
                          type="submit"
                          className={styles.rowDelete}
                          aria-label={`Supprimer ${expense.label}`}
                        >
                          <TrashIcon size={15} color="var(--ink-soft)" />
                        </button>
                      </form>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      <div className={styles.totalCard}>
        <div>
          <div className={styles.totalLabel}>Total affiché</div>
          <div className={styles.totalMeta}>
            {filtered.length} dépense{filtered.length > 1 ? 's' : ''} en {monthLabel}
          </div>
        </div>
        <div className={styles.totalValue}>{euros(total)}</div>
      </div>
    </>
  )
}
