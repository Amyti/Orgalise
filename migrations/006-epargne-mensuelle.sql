-- =====================================================================
-- Épargne mensuelle : ce qu'on met VRAIMENT de côté
--
-- À coller dans Supabase → SQL Editor → Run. Exige migrations/005.
--
-- Les objectifs calculent ce qu'il FAUDRAIT mettre de côté chaque mois.
-- Cette table dit ce qu'on y met réellement. L'écart entre les deux est
-- le vrai message : « tu mets 300 €, il en faudrait 1 111 ».
--
-- Troisième table de règles, symétrique de `incomes` et `fixed_charges`
-- (CLAUDE.md, décision 7) : un montant, un jour du mois, des bornes de
-- validité. Jamais une ligne par mois — la projection se fait à
-- l'affichage.
--
-- Strictement personnelle, elle : un objectif peut être commun, mais ce
-- que chacun y verse le regarde. Pas de `group_id` ici.
-- =====================================================================

create table if not exists public.savings_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- NULL = épargne libre, sans objectif assigné. `set null` à la
  -- suppression : effacer un objectif ne doit pas faire disparaître le
  -- virement mensuel qui, lui, continue d'exister à la banque.
  goal_id      uuid references public.savings_goals(id) on delete set null,

  label        text not null,
  -- ENTIERS de centimes. Jamais de float.
  amount_cents int  not null check (amount_cents > 0),
  day_of_month int  not null check (day_of_month between 1 and 31),

  -- Bornes de validité : augmenter son épargne, c'est fermer l'ancienne
  -- règle et en ouvrir une nouvelle. L'historique des mois passés reste
  -- juste.
  starts_on    date not null default current_date,
  ends_on      date,

  created_at   timestamptz not null default now()
);

create index if not exists savings_plans_user_idx on public.savings_plans (user_id, day_of_month);
create index if not exists savings_plans_goal_idx on public.savings_plans (goal_id) where goal_id is not null;

alter table public.savings_plans enable row level security;

drop policy if exists "voir son épargne" on public.savings_plans;
create policy "voir son épargne" on public.savings_plans for select
  using (user_id = auth.uid());

drop policy if exists "ajouter son épargne" on public.savings_plans;
create policy "ajouter son épargne" on public.savings_plans for insert
  with check (user_id = auth.uid());

drop policy if exists "modifier son épargne" on public.savings_plans;
create policy "modifier son épargne" on public.savings_plans for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "supprimer son épargne" on public.savings_plans;
create policy "supprimer son épargne" on public.savings_plans for delete
  using (user_id = auth.uid());
