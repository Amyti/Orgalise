-- =====================================================================
-- Versements ponctuels sur un objectif
--
-- À coller dans Supabase → SQL Editor → Run. Exige migrations/005.
--
-- `savings_plans` dit ce qu'on met de côté TOUS LES MOIS. Cette table
-- dit ce qu'on y met UNE FOIS : une prime, un cadeau, un remboursement
-- d'impôts, la revente d'un vélo.
--
-- Deux origines possibles, et elles ne se comportent pas pareil :
--   - argent venu d'ailleurs (`from_envelope` faux) : il n'était pas
--     dans le budget du mois, donc il n'en sort pas. Neutre sur le
--     reste à vivre.
--   - pris sur le mois (`from_envelope` vrai) : un virement en plus,
--     depuis l'argent courant. Il sort de l'enveloppe comme une charge.
--
-- Le total épargné reste porté par `savings_goals.saved_cents`, qu'on
-- recopie de son livret. Un versement l'incrémente ; ces lignes sont
-- l'historique, pas la source de vérité. Sans ça, saisir un versement
-- ET recopier son solde compterait deux fois.
-- =====================================================================

create table if not exists public.savings_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Supprimer l'objectif efface son historique : ces lignes n'ont pas
  -- de sens seules.
  goal_id       uuid not null references public.savings_goals(id) on delete cascade,

  label         text not null,
  -- ENTIERS de centimes. Jamais de float.
  amount_cents  int  not null check (amount_cents > 0),
  on_date       date not null default current_date,
  from_envelope boolean not null default false,

  created_at    timestamptz not null default now()
);

create index if not exists savings_entries_user_idx on public.savings_entries (user_id, on_date desc);
create index if not exists savings_entries_goal_idx on public.savings_entries (goal_id);

alter table public.savings_entries enable row level security;

-- Personnelles, même sur un objectif commun : le pot est partagé, qui y
-- a mis quoi ne l'est pas.
drop policy if exists "voir ses versements" on public.savings_entries;
create policy "voir ses versements" on public.savings_entries for select
  using (user_id = auth.uid());

drop policy if exists "ajouter ses versements" on public.savings_entries;
create policy "ajouter ses versements" on public.savings_entries for insert
  with check (user_id = auth.uid());

drop policy if exists "supprimer ses versements" on public.savings_entries;
create policy "supprimer ses versements" on public.savings_entries for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Enregistrer un versement, en une seule écriture
-- ---------------------------------------------------------------------
-- Insérer la ligne puis relire `saved_cents` pour le réécrire perdrait
-- un versement si les deux membres d'un espace en saisissaient un au
-- même instant sur un objectif commun. Un `set saved_cents = saved_cents
-- + n` dans la même transaction ne peut pas se perdre.
--
-- SECURITY INVOKER (le défaut) : les policies RLS s'appliquent
-- normalement, la fonction ne donne aucun droit supplémentaire.

create or replace function public.add_savings_entry(
  gid       uuid,
  amount    int,
  lbl       text,
  on_day    date,
  from_env  boolean
) returns void
language plpgsql
as $$
begin
  if amount is null or amount <= 0 then
    raise exception 'montant invalide';
  end if;

  insert into public.savings_entries (user_id, goal_id, label, amount_cents, on_date, from_envelope)
  values (auth.uid(), gid, lbl, amount, coalesce(on_day, current_date), coalesce(from_env, false));

  -- Échoue silencieusement si la policy d'update refuse : c'est le
  -- comportement voulu, l'insert aura échoué avant de toute façon.
  update public.savings_goals
     set saved_cents = saved_cents + amount
   where id = gid;
end;
$$;

-- Retirer un versement défait les deux effets ensemble.
create or replace function public.remove_savings_entry(eid uuid)
returns void
language plpgsql
as $$
declare
  ligne public.savings_entries%rowtype;
begin
  select * into ligne from public.savings_entries where id = eid;
  if not found then
    return;
  end if;

  delete from public.savings_entries where id = eid;

  update public.savings_goals
     set saved_cents = greatest(0, saved_cents - ligne.amount_cents)
   where id = ligne.goal_id;
end;
$$;
