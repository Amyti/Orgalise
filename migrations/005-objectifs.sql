-- =====================================================================
-- Objectifs d'épargne
--
-- À coller dans Supabase → SQL Editor → Run.
-- Ajouté aussi à schema.sql pour les nouveaux projets ; ce fichier met à
-- jour une base déjà créée.
--
-- PREMIÈRE ENTORSE ASSUMÉE à « le budget ne dépend pas du groupe ».
-- Les six autres tables du budget sont en `user_id = auth.uid()` sans
-- aucun `group_id`, et ça ne bouge pas. Un objectif, lui, peut être
-- commun : économiser pour un voyage à deux n'a de sens qu'à deux.
--
-- L'entorse est contenue : `group_id` est NULLABLE et vaut NULL par
-- défaut. Un objectif personnel ne touche jamais au groupe, et quelqu'un
-- qui n'utilise que le budget — donc sans espace — s'en sert normalement.
-- Aucune autre table budget ne gagne de `group_id`.
-- =====================================================================

create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  -- Le créateur. Seul lui peut supprimer l'objectif.
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- NULL = personnel. Renseigné = visible et modifiable par les deux.
  group_id       uuid references public.groups(id) on delete set null,

  label          text not null,
  -- ENTIERS de centimes, comme partout ailleurs. Jamais de float.
  target_cents   int  not null check (target_cents > 0),
  -- Ce qu'on a déjà de côté. Saisi à la main : le solde du livret fait
  -- foi, et le recopier vaut mieux qu'un registre de versements à tenir.
  saved_cents    int  not null default 0 check (saved_cents >= 0),
  target_on      date not null,

  -- Retirer l'épargne mensuelle du reste à vivre, comme une charge fixe.
  -- C'est ce qui fait qu'un objectif est atteint plutôt que contemplé.
  -- Sur un objectif commun, le réglage vaut pour les deux : il n'y a
  -- qu'une ligne, donc qu'une case.
  hold_in_budget boolean not null default true,

  created_at     timestamptz not null default now()
);

create index if not exists savings_goals_user_idx  on public.savings_goals (user_id, target_on);
create index if not exists savings_goals_group_idx on public.savings_goals (group_id) where group_id is not null;

alter table public.savings_goals enable row level security;

-- Le sien, plus ceux partagés dans son espace.
create policy "voir ses objectifs" on public.savings_goals for select
  using (
    user_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id))
  );

-- On crée pour soi. Partager exige d'être membre de l'espace visé.
create policy "créer un objectif" on public.savings_goals for insert
  with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

-- Les deux membres mettent à jour un objectif commun : c'est le but.
create policy "modifier un objectif" on public.savings_goals for update
  using (
    user_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id))
  )
  with check (
    user_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id))
  );

-- Supprimer reste au créateur : on n'efface pas l'objectif de l'autre.
create policy "supprimer son objectif" on public.savings_goals for delete
  using (user_id = auth.uid());
