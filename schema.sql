-- =====================================================================
-- Agenda partagé + budget perso — schéma complet
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILS
-- ---------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Moi',
  color       text not null default '#A94F2E',
  -- Outils activés : 'agenda', 'budget', ou les deux. Un tableau vide
  -- signifie « pas encore choisi » et déclenche l'écran de bienvenue.
  -- Le budget ne dépendant d'aucun groupe, un compte peut n'avoir que
  -- 'budget' et ne jamais créer d'espace.
  modules     text[] not null default '{}'
    check (modules <@ array['agenda', 'budget']::text[]),
  created_at  timestamptz not null default now()
);

-- Crée le profil automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Moi'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 2. GROUPES (= espaces partagés)
-- ---------------------------------------------------------------------

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Nous deux',
  invite_code text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index on public.group_members (user_id);


-- ---------------------------------------------------------------------
-- 3. AGENDA COMMUN
-- ---------------------------------------------------------------------

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  title      text not null,
  notes      text,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  all_day    boolean not null default false,
  -- Fuseau d'origine : indispensable pour réafficher correctement
  -- un événement créé dans un autre pays.
  tz         text not null default 'Europe/Paris',
  -- Récurrence stockée comme RÈGLE, jamais dépliée en lignes.
  rrule      text,
  exdates    timestamptz[],
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint events_order check (ends_at > starts_at)
);

create index on public.events (group_id, starts_at);


-- ---------------------------------------------------------------------
-- 4. CALENDRIERS PERSO IMPORTÉS (ICS) + BLOCS OCCUPÉS
-- ---------------------------------------------------------------------

create table public.calendar_feeds (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  group_id       uuid not null references public.groups(id) on delete cascade,
  label          text not null default 'Mon calendrier',
  url            text not null,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);

-- On ne stocke QUE des plages occupées, jamais le titre des événements.
create table public.busy_blocks (
  id        uuid primary key default gen_random_uuid(),
  feed_id   uuid not null references public.calendar_feeds(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  group_id  uuid not null references public.groups(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  constraint busy_order check (ends_at > starts_at)
);

create index on public.busy_blocks (group_id, starts_at);


-- ---------------------------------------------------------------------
-- 5. BUDGET PERSO (non partagé)
-- ---------------------------------------------------------------------

create table public.categories (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  name     text not null,
  color    text not null default '#7A7263',
  position int  not null default 0,
  unique (user_id, name)
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  -- ENTIER de centimes. Jamais de float : 12.499999 € en base, c'est non.
  amount_cents int  not null check (amount_cents > 0),
  label       text not null,
  spent_on    date not null default current_date,
  created_at  timestamptz not null default now()
);

create index on public.expenses (user_id, spent_on desc);

create table public.budgets (
  user_id     uuid not null references auth.users(id) on delete cascade,
  month       date not null,           -- toujours le 1er du mois
  limit_cents int  not null check (limit_cents > 0),
  primary key (user_id, month)
);

-- ---------------------------------------------------------------------
-- 5 bis. BUDGET PRÉVISIONNEL
-- ---------------------------------------------------------------------
-- Revenus et charges fixes sont des RÈGLES, pas une ligne par mois : on
-- stocke le montant et le jour, et on projette à l'affichage. Même
-- principe que les RRULE de l'agenda.

create table public.incomes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null default 'Salaire',
  amount_cents int  not null check (amount_cents > 0),
  day_of_month int  not null default 1 check (day_of_month between 1 and 31),
  starts_on    date not null default date_trunc('month', current_date)::date,
  ends_on      date,
  created_at   timestamptz not null default now(),
  constraint incomes_order check (ends_on is null or ends_on >= starts_on)
);

create index on public.incomes (user_id);

create table public.fixed_charges (
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

create index on public.fixed_charges (user_id);

-- Ponctuelles et datées. Une fois payée, on la pointe et `expense_id`
-- renvoie vers la dépense réelle créée.
create table public.planned_expenses (
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

create index on public.planned_expenses (user_id, due_on);

-- Catégories par défaut à la création du profil
create or replace function public.seed_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, color, position) values
    (new.id, 'Courses',     '#A94F2E', 1),
    (new.id, 'Resto',       '#C4703F', 2),
    (new.id, 'Transport',   '#3F6B70', 3),
    (new.id, 'Loisirs',     '#8A5A2B', 4),
    (new.id, 'Logement',    '#4F6549', 5),
    (new.id, 'Santé',       '#9B4B62', 6),
    (new.id, 'Abonnements', '#6B5A8A', 7),
    (new.id, 'Autre',       '#7A7263', 8);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.seed_categories();


-- =====================================================================
-- 6. HELPER ANTI-RÉCURSION  ← LE POINT IMPORTANT
-- =====================================================================
-- Si une policy sur group_members interroge group_members, Postgres
-- part en récursion infinie et TOUTES tes requêtes échouent.
-- Cette fonction SECURITY DEFINER contourne le RLS le temps du test.

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;


-- =====================================================================
-- 7. REJOINDRE PAR CODE
-- =====================================================================
-- Alphabet sans caractères ambigus : pas de 0/O ni 1/I/L.
-- (Change la chaîne si tu veux l'alphabet complet.)

create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Crée un groupe et t'y ajoute comme admin
create or replace function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'non authentifié';
  end if;

  insert into public.groups (name, invite_code, created_by)
  values (coalesce(nullif(trim(group_name), ''), 'Nous deux'),
          public.gen_invite_code(), auth.uid())
  returning id into gid;

  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'admin');

  return gid;
end;
$$;

-- Rejoint un groupe via son code.
-- SECURITY DEFINER car on doit lire `groups` sans encore en être membre.
create or replace function public.join_group(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  n_members int;
begin
  if auth.uid() is null then
    raise exception 'non authentifié';
  end if;

  select id into gid
  from public.groups
  where invite_code = upper(trim(code));

  if gid is null then
    raise exception 'code invalide';
  end if;

  select count(*) into n_members
  from public.group_members where group_id = gid;

  if n_members >= 2 then
    raise exception 'cet espace est complet';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict do nothing;

  return gid;
end;
$$;


-- =====================================================================
-- 8. RLS
-- =====================================================================

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.events         enable row level security;
alter table public.calendar_feeds enable row level security;
alter table public.busy_blocks    enable row level security;
alter table public.categories     enable row level security;
alter table public.expenses       enable row level security;
alter table public.budgets        enable row level security;
alter table public.incomes        enable row level security;
alter table public.fixed_charges  enable row level security;
alter table public.planned_expenses enable row level security;

-- --- profils : le sien + celui des co-membres -------------------------
create policy "profil visible" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.user_id = profiles.id and public.is_group_member(gm.group_id)
    )
  );

create policy "modifier son profil" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- --- groupes ---------------------------------------------------------
create policy "voir ses groupes" on public.groups for select
  using (public.is_group_member(id));

create policy "admin modifie" on public.groups for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- --- membres ---------------------------------------------------------
create policy "voir les membres" on public.group_members for select
  using (public.is_group_member(group_id));

create policy "se retirer" on public.group_members for delete
  using (user_id = auth.uid());

-- --- events : lecture ET écriture pour tout membre --------------------
create policy "events du groupe" on public.events for all
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- --- flux ICS : chacun gère les siens, visibles par le groupe ---------
create policy "voir les flux" on public.calendar_feeds for select
  using (public.is_group_member(group_id));

create policy "gérer ses flux" on public.calendar_feeds for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_group_member(group_id));

-- --- blocs occupés : visibles par le groupe, écrits par le propriétaire
create policy "voir les dispos" on public.busy_blocks for select
  using (public.is_group_member(group_id));

create policy "écrire ses dispos" on public.busy_blocks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- budget : strictement perso --------------------------------------
create policy "ses catégories" on public.categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ses dépenses" on public.expenses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ses budgets" on public.budgets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ses revenus" on public.incomes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ses charges fixes" on public.fixed_charges for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ses dépenses prévues" on public.planned_expenses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- =====================================================================
-- 9. CRÉNEAUX LIBRES COMMUNS
-- =====================================================================
-- Renvoie les plages où PERSONNE n'est occupé, sur une fenêtre donnée.
-- Fusionne busy_blocks (ICS) + events du groupe, puis prend le complément.

create or replace function public.free_slots(
  gid       uuid,
  win_start timestamptz,
  win_end   timestamptz,
  min_minutes int default 30
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security invoker
as $$
  with busy as (
    select b.starts_at, b.ends_at
    from public.busy_blocks b
    where b.group_id = gid
      and b.ends_at > win_start and b.starts_at < win_end
    union all
    select e.starts_at, e.ends_at
    from public.events e
    where e.group_id = gid
      and e.ends_at > win_start and e.starts_at < win_end
  ),
  -- fusion des plages qui se chevauchent
  ordered as (
    select starts_at, ends_at,
           max(ends_at) over (
             order by starts_at
             rows between unbounded preceding and 1 preceding
           ) as prev_max
    from busy
  ),
  grouped as (
    select starts_at, ends_at,
           sum(case when prev_max is null or starts_at > prev_max then 1 else 0 end)
             over (order by starts_at) as grp
    from ordered
  ),
  merged as (
    select min(starts_at) as s, max(ends_at) as e
    from grouped group by grp
  ),
  -- le complément : entre la fin d'une plage et le début de la suivante
  gaps as (
    select
      greatest(coalesce(lag(e) over (order by s), win_start), win_start) as gs,
      least(s, win_end) as ge
    from merged
    union all
    select greatest(coalesce(max(e), win_start), win_start), win_end from merged
  )
  select gs, ge
  from gaps
  where ge > gs
    and extract(epoch from (ge - gs)) / 60 >= min_minutes
  order by gs;
$$;

-- ---------------------------------------------------------------------
-- 5 ter. OBJECTIFS D'ÉPARGNE
-- ---------------------------------------------------------------------
-- Seule table du budget qui peut dépendre du groupe, et seulement quand
-- on le demande : `group_id` est nullable et vaut NULL par défaut.
-- Économiser à deux pour un voyage n'a de sens qu'à deux ; le reste du
-- budget demeure strictement personnel.

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
