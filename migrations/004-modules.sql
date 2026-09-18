-- =====================================================================
-- Choix des outils : agenda partagé, suivi de dépenses, ou les deux
--
-- À coller dans Supabase → SQL Editor → Run.
--
-- Le budget n'a jamais dépendu du groupe : ses six tables sont en
-- `user_id = auth.uid()`, sans aucun `group_id`. Quelqu'un qui vient
-- uniquement pour ses dépenses n'a donc structurellement pas besoin de
-- créer un espace ni d'inviter qui que ce soit. Cette colonne permet à
-- l'app de le savoir et de ne pas l'y forcer.
-- =====================================================================

alter table public.profiles
  add column if not exists modules text[] not null default '{}';

-- Un tableau vide signifie « pas encore choisi » : c'est ce qui déclenche
-- l'écran de bienvenue. Pas besoin d'une colonne supplémentaire pour ça.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_modules_valides'
  ) then
    alter table public.profiles
      add constraint profiles_modules_valides
      check (modules <@ array['agenda', 'budget']::text[]);
  end if;
end $$;

-- Les comptes existants utilisent déjà les deux : on ne leur repose pas
-- la question.
update public.profiles set modules = array['agenda', 'budget']
  where modules = '{}';

-- --- Contrôle ---------------------------------------------------------

select id, display_name, modules from public.profiles;
