-- =====================================================================
-- Budget prévisionnel : revenus, charges fixes, dépenses prévues
--
-- À coller dans Supabase → SQL Editor → Run.
-- Ces trois tables sont ajoutées aussi à schema.sql pour les nouveaux
-- projets ; ce fichier sert à mettre à jour une base déjà créée.
--
-- Comme le reste du budget : strictement personnel. Les policies sont en
-- `user_id = auth.uid()`, jamais liées au groupe — le budget reste privé
-- même à l'intérieur d'un espace partagé.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. REVENUS
-- ---------------------------------------------------------------------
-- Un salaire est une règle, pas une ligne par mois : on stocke le montant
-- et le jour de versement, et on le projette à l'affichage. Même principe
-- que les RRULE de l'agenda — on ne déplie jamais en base.

create table if not exists public.incomes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null default 'Salaire',
  amount_cents int  not null check (amount_cents > 0),
  -- Jour de versement. 31 sur un mois court est ramené au dernier jour
  -- à l'affichage, côté application.
  day_of_month int  not null default 1 check (day_of_month between 1 and 31),
  -- Bornes de validité : une augmentation se saisit en fermant l'ancienne
  -- ligne et en en ouvrant une nouvelle, l'historique reste juste.
  starts_on    date not null default date_trunc('month', current_date)::date,
  ends_on      date,
  created_at   timestamptz not null default now(),
  constraint incomes_order check (ends_on is null or ends_on >= starts_on)
);

create index if not exists incomes_user_idx on public.incomes (user_id);

-- ---------------------------------------------------------------------
-- 2. CHARGES FIXES
-- ---------------------------------------------------------------------
-- Loyer, assurance, abonnements : le même montant tous les mois.

create table if not exists public.fixed_charges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null,
  amount_cents int  not null check (amount_cents > 0),
  category_id  uuid references public.categories(id) on delete set null,
  day_of_month int  not null default 1 check (day_of_month between 1 and 31),
  starts_on    date not null default date_trunc('month', current_date)::date,
  ends_on      date,
  created_at   timestamptz not null default now(),
  constraint fixed_charges_order check (ends_on is null or ends_on >= starts_on)
);

create index if not exists fixed_charges_user_idx on public.fixed_charges (user_id);

-- ---------------------------------------------------------------------
-- 3. DÉPENSES PRÉVUES
-- ---------------------------------------------------------------------
-- Ponctuelles et datées : impôts, vacances, cadeau d'anniversaire.
-- Une fois payée, on la pointe : `settled_at` est horodaté et
-- `expense_id` renvoie vers la dépense réelle qui a été créée.

create table if not exists public.planned_expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null,
  amount_cents int  not null check (amount_cents > 0),
  category_id  uuid references public.categories(id) on delete set null,
  due_on       date not null,
  settled_at   timestamptz,
  expense_id   uuid references public.expenses(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists planned_expenses_user_idx
  on public.planned_expenses (user_id, due_on);

-- ---------------------------------------------------------------------
-- 4. RLS — strictement personnel
-- ---------------------------------------------------------------------

alter table public.incomes          enable row level security;
alter table public.fixed_charges    enable row level security;
alter table public.planned_expenses enable row level security;

drop policy if exists "ses revenus" on public.incomes;
create policy "ses revenus" on public.incomes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ses charges fixes" on public.fixed_charges;
create policy "ses charges fixes" on public.fixed_charges for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ses dépenses prévues" on public.planned_expenses;
create policy "ses dépenses prévues" on public.planned_expenses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. Contrôle : doit renvoyer trois lignes, toutes à `true`
-- ---------------------------------------------------------------------

select c.relname as table, c.relrowsecurity as rls_active
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('incomes', 'fixed_charges', 'planned_expenses')
order by c.relname;
