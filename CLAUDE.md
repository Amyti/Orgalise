# CLAUDE.md

Contexte du projet. À lire avant toute modification.

---

## Le projet

App d'organisation. Deux outils, **activables séparément** :

1. **Agenda partagé** — un calendrier commun, plus les disponibilités
   de chacun importées depuis leur calendrier perso. L'objectif n'est
   pas de lister des rendez-vous, c'est de répondre à **« quand est-ce
   qu'on est libres tous les deux ? »**
2. **Suivi de dépenses PERSONNEL** — chacun son budget, ses catégories,
   ses dépenses. Ce n'est **pas** un Tricount : aucune notion de
   « qui doit quoi à qui ». Le budget est privé même à l'intérieur
   d'un espace partagé.

À l'inscription, on choisit ce qu'on veut utiliser : l'un, l'autre, ou
les deux. Modifiable ensuite dans les réglages.

**Le budget ne dépend pas du groupe.** Ses six tables sont en
`user_id = auth.uid()`, sans aucun `group_id` — c'était déjà le cas avant
le choix des outils. Quelqu'un qui vient pour ses dépenses n'a donc pas
d'espace partagé, pas de code d'invitation, personne à attendre. Les
écrans budget appellent `requireBudget()` (un compte suffit), les écrans
agenda `requireSpace()`.

Un espace reste limité à **deux personnes**. Le nombre de comptes, lui,
n'est plus borné : quelques amis peuvent utiliser le budget chacun de son
côté. Ne pas sur-architecturer pour autant — l'échelle visée reste une
poignée d'utilisateurs.

---

## Stack

| Élément | Choix | Raison |
|---|---|---|
| Front | Next.js (App Router) | |
| Hébergement | Vercel, plan Hobby | gratuit, usage perso |
| Base / auth | Supabase, plan Free | Postgres + RLS + realtime |
| Distribution | **PWA**, pas d'app native | pas de compte Apple à 99 $/an |
| Domaine et mail | `orgalise.fr` + boîte IONOS | envoi authentifié depuis son propre domaine |
| Coût total | ~14 € TTC la 1re année | puis 2,50 € HT/mois — pensable à résilier |

### Contraintes à connaître

- Un projet Supabase gratuit **se met en pause après 7 jours sans
  requête**. Relance manuelle depuis le dashboard.
- Sur iPhone, l'installation PWA passe **obligatoirement par Safari**
  (Partager → Sur l'écran d'accueil). Chrome iOS ne sait pas installer
  de PWA.
- Les notifications push web sur iOS ne marchent **que** si la PWA est
  installée sur l'écran d'accueil (iOS 16.4+).
- Cron Vercel gratuit : 1 exécution par jour maximum. Donc la synchro
  ICS se fait **à l'ouverture de l'app**, pas en tâche planifiée.
- **Le DNS d'`orgalise.fr` reste chez IONOS.** Ne pas déléguer les
  serveurs de noms à Vercel : les enregistrements MX de la boîte mail
  partiraient avec, et l'app n'enverrait plus rien. On pose seulement
  l'enregistrement A et le CNAME que Vercel demande, le reste ne bouge
  pas.
- **« Se connecter avec Apple » n'existe pas dans l'app**, alors que la
  maquette `Connexion` en montre le bouton. Sur le web, ce mode de
  connexion exige un Services ID et une clé de signature, que seul un
  compte Apple Developer payant permet de créer — les mêmes 99 $/an que
  la distribution en PWA sert à éviter. Ne pas le remettre d'après la
  maquette.

---

## Design system

### Couleurs

```
--ground      #F5F1E8   fond général (crème chaud, effet papier)
--surface     #FFFDF8   cartes
--ink         #1F1C18   texte principal
--ink-strong  #221F1A   blocs pleins (événements à deux)
--ink-soft    #6B6358   texte secondaire (contraste 4.88:1 sur ground, OK)
--border      #E7E0D0   bordures
--honey       #F6E2B2   créneau libre à deux
--honey-ink   #6B5312   texte sur honey
--user-a      #A94F2E   personne 1 (terracotta)
--user-b      #4F6549   personne 2 (olive)
```

Catégories de dépenses (même chroma, même clarté) :

```
Courses     #A94F2E      Logement     #4F6549
Resto       #C4703F      Santé        #9B4B62
Transport   #3F6B70      Abonnements  #6B5A8A
Loisirs     #8A5A2B      Autre        #7A7263
```

`app/globals.css` porte en plus une vingtaine de nuances dérivées
(`--separator`, `--track`, `--sunken`, `--table-head`…) relevées sur les
maquettes. Aucune couleur n'est écrite en dur ailleurs. Deux exceptions
inévitables, dans `lib/palette.ts` : les couleurs stockées en base et le
manifeste PWA, qui est du JSON.

### Mode sombre

La même charte en valeurs inversées : fond `#191712`, texte `#F2EDE2`,
terracotta et olive éclaircis pour tenir sur fond sombre.

Un choix explicite pose `data-theme` sur la racine ; le réglage
« système » ne pose rien et laisse `prefers-color-scheme` décider. Le
choix est stocké en `localStorage` et appliqué par un script inline dans
`app/layout.tsx`, avant le premier rendu. Réglage dans l'écran *Nous*.

Une couleur de profil ou de catégorie étant un hex stocké en base, elle
est résolue au rendu : `lib/space.ts` donne sa couleur à une personne
d'après sa **place** dans l'espace, `lib/categories.ts` résout celle
d'une catégorie par son **nom**. Un changement de charte s'applique donc
partout sans migration SQL.

### Typographie

- Display : **Fraunces** (600) — titres, chiffres, montants
- Texte : **Karla** (400/600/700)
- Google Fonts. Ne pas utiliser Inter, Roboto ni Arial.

### Règles visuelles

- Rayons : 9–12 px petits éléments, 14–18 px cartes, 50 % pastilles
- Cibles tactiles ≥ 44 px
- Pas de dégradés, pas d'emoji, pas d'ombres portées sauf le bouton
  flottant `+`
- Icônes : SVG trait, `stroke-width` 1.8–2.2
- Base mobile : 390 × 844, plafond de largeur 440 px (iPhone 16 Pro Max)
- **Tout `input`, `select` ou `textarea` fait au moins 16 px.** En dessous,
  iOS zoome à la mise au point : le plein écran de la PWA saute, les
  barres de défilement apparaissent, la mise en page se décale. C'est une
  contrainte de plateforme, pas un choix de design.

### Le langage visuel du calendrier (le cœur du produit)

Sur **toutes** les vues, la même grammaire :

- deux rubans fins par jour, un par personne, dans sa couleur
  → périodes occupées, importées de l'ICS
- fond **honey** → personne n'est occupé = créneau libre à deux
- bloc **ink-strong** pleine hauteur → événement commun

Conséquence voulue : une semaine chargée apparaît en creux, le week-end
libre ressort en jaune. C'est ce contraste qui porte le produit.

### La bande horaire s'adapte

7 h → 23 h n'est qu'un **minimum**. `computeBand()` (`lib/agenda.ts`)
l'étend à ce que la fenêtre affichée contient vraiment : une garde qui
commence à 5 h fait descendre la bande à 5 h. Sans ça elle ne serait pas
mal placée, elle serait **invisible** — découpée hors de la bande.

Deux règles :

- **La bande ne rétrécit jamais.** Une journée vide ressemble encore à
  une journée, et « libre en soirée » veut dire la même chose d'une
  semaine à l'autre.
- **Une seule bande par vue, jamais une par jour.** Sept lignes à des
  échelles différentes ne seraient plus comparables entre elles, et c'est
  cette comparaison qui fait la vue semaine.

Une journée entière ne borne pas la bande : elle irait de 0 h à 24 h et
écraserait l'échelle de tous les autres jours.

« Soirée libre », sur l'accueil, reste fixé à 18 h → 23 h : c'est une
notion humaine, elle ne s'étend pas parce que quelqu'un travaille à 5 h.

---

## Écrans

Maquettes de référence dans `design/*.dc.html` (HTML lisible : tout le
markup, les couleurs et les dimensions exactes y sont).

**Parcours d'entrée**
| Fichier | Rôle |
|---|---|
| `Connexion` | email + mot de passe, lien magique |
| `Groupe` | créer un espace **ou** rejoindre avec un code |
| `Espace` | code d'invitation, membres, branchement des flux ICS |
| *(sans maquette)* | `/demarrer` — choix des outils, juste après l'inscription |

**Écran principal**
| Fichier | Rôle |
|---|---|
| `Accueil` | timeline du jour, prochain événement commun, budget restant, prochains RDV |

**Calendrier**
| Fichier | Rôle |
|---|---|
| `Main` | vue semaine — 7 lignes horizontales, une mini-timeline 7h→23h par jour |
| `Jour` | colonnes parallèles toi/elle, trous communs surlignés |
| `Mois` | densité d'occupation, pas de texte ; jours ouverts en honey |

**Budget**
| Fichier | Rôle |
|---|---|
| `Budget` | tableau de bord : reste à vivre, tendance, catégories, échéances |
| `Ajout` | saisie : montant en gros + pavé numérique custom + 8 catégories |
| `Tableau` | recherche, filtres, lignes groupées par jour avec sous-totaux, export CSV |
| *(sans maquette)* | `/budget/plan` — revenus, charges fixes, dépenses prévues |

Navigation basse, **adaptée aux outils activés** :
les deux → **Accueil · Agenda · Budget · Nous** ;
budget seul → **Budget · Réglages**. Même route `/nous` dans les deux cas,
seul le libellé change — l'écran affiche les blocs liés à l'espace
uniquement quand il y en a un.
(les trois écrans calendrier sont encore sur une ancienne nav à 3 items,
à uniformiser).

---

## Base de données

Schéma complet et commenté dans `schema.sql`, à exécuter tel quel dans
Supabase → SQL Editor.

### Décisions à ne pas défaire

1. **`is_group_member(gid)` en SECURITY DEFINER.**
   Une policy RLS sur `group_members` qui interroge `group_members`
   déclenche une récursion infinie et fait tomber toutes les requêtes.
   Toute nouvelle policy liée à un groupe doit passer par cette fonction.

2. **Montants en `int` de centimes.** Jamais `float`, jamais `numeric`.

3. **Récurrence stockée comme RRULE + `exdates`.** Ne jamais déplier
   les occurrences en lignes : impossible ensuite de modifier
   « tous les mardis à partir de maintenant ».

4. **Fuseaux : tout en `timestamptz` + colonne `tz`** portant le fuseau
   d'origine. Jamais d'heure locale nue.

5. **ICS en lecture seule.** On importe une URL iCal secrète et on ne
   stocke **que** des plages occupées (`busy_blocks`), jamais le titre
   des événements. Pas d'OAuth Google : 10× plus de travail pour deux
   utilisateurs.

6. **Code d'invitation** : 6 caractères, alphabet sans 0/O ni 1/I/L.
   `join_group(code)` est SECURITY DEFINER car il faut lire `groups`
   avant d'en être membre. Limite codée en dur : 2 membres par espace.

7. **Revenus et charges fixes sont des RÈGLES.** `incomes` et
   `fixed_charges` stockent un montant, un jour du mois et des bornes de
   validité (`starts_on` / `ends_on`) — jamais une ligne par mois. La
   projection se fait à l'affichage (`lib/forecast.ts`), comme les RRULE
   de l'agenda. Une augmentation se saisit en fermant l'ancienne règle et
   en ouvrant la nouvelle : l'historique des mois passés reste juste.

8. **Une dépense prévue pointée crée une vraie dépense.**
   `planned_expenses.settled_at` est horodaté et `expense_id` pointe vers
   la ligne créée dans `expenses`. Tant qu'elle n'est pas pointée, son
   montant est provisionné ; une fois pointée, il sort du provisionnel et
   entre dans le réalisé. C'est ce qui évite de le compter deux fois.

### Le chiffre qui porte le budget

Tout l'écran Budget tourne autour du **reste à vivre** :

```
  revenus du mois
− charges fixes
− dépenses prévues pas encore payées
────────────────────────────────────
= enveloppe
− déjà dépensé
────────────────────────────────────
= reste à vivre, et reste à vivre par jour
```

Sans revenu saisi, l'écran retombe sur l'ancien plafond manuel
(table `budgets`) et propose de configurer le prévisionnel.

### Fonction utile déjà écrite

`free_slots(gid, win_start, win_end, min_minutes)` renvoie les plages
où personne n'est occupé. Elle fusionne `busy_blocks` + `events` et
prend le complément.

```js
const { data } = await supabase.rpc('free_slots', {
  gid: groupId,
  win_start: '2026-09-17T07:00:00+02:00',
  win_end:   '2026-09-24T23:00:00+02:00',
  min_minutes: 60
})
```

---

## Ordre de construction

Chaque étape donne quelque chose d'utilisable. Ne pas sauter l'ordre.

1. Auth + `create_group` / `join_group` + écrans Connexion/Groupe/Espace
2. CRUD events + **vue semaine seule**  ← utilisable au quotidien ici
3. Budget : saisie, catégories, total du mois, prévisionnel
4. Tableau des dépenses + export CSV
5. Import ICS + `busy_blocks` + affichage des rubans
6. Vues Jour et Mois
7. Manifest PWA + icônes + installation
8. Notifications push (en dernier, c'est le plus capricieux)

### Ce qui prend plus de temps qu'il n'y paraît

- Le parsing ICS est rapide, **la récurrence non** : `EXDATE` et
  `RECURRENCE-ID` demandent un vrai travail à part.
- Les états que les maquettes ne montrent pas : chargement, listes
  vides, erreurs réseau, formulaires invalides. Compter 30–40 % du
  temps total.
- Les vues Jour et Mois : positionnement absolu, chevauchements,
  événements qui débordent minuit.

---

## Nom

**Orgalise.** Défini une seule fois dans `lib/config.ts` : il alimente
l'écran de connexion, le titre des pages, le manifeste PWA et le nom sous
l'icône sur l'écran d'accueil.
