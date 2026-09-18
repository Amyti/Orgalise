-- =====================================================================
-- Retour à la charte d'origine
--
-- Crème chaud, terracotta, olive, honey : celle décrite dans CLAUDE.md
-- dès le premier jour. À coller dans Supabase → SQL Editor → Run.
--
-- Couvre toutes les chartes essayées entre-temps, donc fonctionne quel
-- que soit l'état actuel. Sans effet sur une base restée d'origine.
-- =====================================================================

update public.categories set color = case color
  when '#C38776' then '#A94F2E'      -- Courses
  when '#C6885C' then '#C4703F'      -- Resto
  when '#769CA8' then '#3F6B70'      -- Transport
  when '#B98E56' then '#8A5A2B'      -- Loisirs
  when '#7C9E82' then '#4F6549'      -- Logement
  when '#BD879B' then '#9B4B62'      -- Santé
  when '#9890BF' then '#6B5A8A'      -- Abonnements
  when '#9D958C' then '#7A7263'      -- Autre
  when '#E6AAA1' then '#A94F2E'      -- Courses
  when '#E3AE81' then '#C4703F'      -- Resto
  when '#9DBECB' then '#3F6B70'      -- Transport
  when '#D5B478' then '#8A5A2B'      -- Loisirs
  when '#9EC1AB' then '#4F6549'      -- Logement
  when '#DDACBF' then '#9B4B62'      -- Santé
  when '#BBB3DF' then '#6B5A8A'      -- Abonnements
  when '#BFB8B3' then '#7A7263'      -- Autre
  when '#EDB1BE' then '#A94F2E'      -- Courses
  when '#EBB4AC' then '#C4703F'      -- Resto
  when '#92C8E4' then '#3F6B70'      -- Transport
  when '#DDBD6D' then '#8A5A2B'      -- Loisirs
  when '#7CD1BF' then '#4F6549'      -- Logement
  when '#ECB0CE' then '#9B4B62'      -- Santé
  when '#CBB8E9' then '#6B5A8A'      -- Abonnements
  when '#DBBAA3' then '#7A7263'      -- Autre
  when '#EEB5C3' then '#A94F2E'      -- Courses
  when '#EAB8B1' then '#C4703F'      -- Resto
  when '#9ACCDD' then '#3F6B70'      -- Transport
  when '#DEC082' then '#8A5A2B'      -- Loisirs
  when '#91D0BE' then '#4F6549'      -- Logement
  when '#E9B4D6' then '#9B4B62'      -- Santé
  when '#CFBCE4' then '#6B5A8A'      -- Abonnements
  when '#D8BFAD' then '#7A7263'      -- Autre
  else color
end
where color in ('#C38776','#C6885C','#769CA8','#B98E56','#7C9E82','#BD879B','#9890BF','#9D958C',
                '#E6AAA1','#E3AE81','#9DBECB','#D5B478','#9EC1AB','#DDACBF','#BBB3DF','#BFB8B3',
                '#EDB1BE','#EBB4AC','#92C8E4','#DDBD6D','#7CD1BF','#ECB0CE','#CBB8E9','#DBBAA3',
                '#EEB5C3','#EAB8B1','#9ACCDD','#DEC082','#91D0BE','#E9B4D6','#CFBCE4','#D8BFAD');

update public.profiles set color = '#A94F2E'
  where color in ('#C48176','#E5A69C','#FF9DB2','#FFCCC5');
update public.profiles set color = '#4F6549'
  where color in ('#5D7966','#9DC0AA');

-- --- Contrôle : ne doit rien renvoyer ---------------------------------

select 'profil non migré' as souci, id, color from public.profiles
  where color not in ('#A94F2E', '#4F6549')
union all
select 'catégorie non migrée', id, color from public.categories
  where color in ('#C38776','#C6885C','#769CA8','#B98E56','#7C9E82','#BD879B','#9890BF','#9D958C',
                '#E6AAA1','#E3AE81','#9DBECB','#D5B478','#9EC1AB','#DDACBF','#BBB3DF','#BFB8B3',
                '#EDB1BE','#EBB4AC','#92C8E4','#DDBD6D','#7CD1BF','#ECB0CE','#CBB8E9','#DBBAA3',
                '#EEB5C3','#EAB8B1','#9ACCDD','#DEC082','#91D0BE','#E9B4D6','#CFBCE4','#D8BFAD');
