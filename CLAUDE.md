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
| *(sans maquette)* | `/budget/import` — captures d'écran bancaires lues par un modèle |
| *(sans maquette)* | `/budget/objectifs` — objectifs d'épargne, personnels ou communs |

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

9. **Un objectif d'épargne peut être commun — et c'est la seule table
   du budget qui touche au groupe.** `savings_goals.group_id` est
   NULLABLE et vaut NULL par défaut : un objectif naît personnel.
   Économiser à deux pour un voyage n'a de sens qu'à deux, mais l'entorse
   s'arrête là — aucune autre table budget ne gagne de `group_id`, et
   quelqu'un sans espace crée ses objectifs normalement.

   Le montant d'un objectif commun se partage en **deux parts égales**
   pour la ponction sur le reste à vivre de chacun. C'est une convention,
   pas une vérité — mais elle est prévisible, et deux est la taille
   maximale d'un espace.

10. **Ce qu'on a déjà de côté se saisit à la main.** `saved_cents` est un
    nombre qu'on recopie depuis son livret, pas le résultat d'un registre
    de versements. Un registre serait plus juste sur le papier et
    abandonné au bout de trois semaines ; le solde du livret, lui, fait
    foi et se lit en deux secondes.

### Le chiffre qui porte le budget

Tout l'écran Budget tourne autour du **reste à vivre** :

```
  revenus du mois
− charges fixes
− dépenses prévues pas encore payées
− épargne mise de côté
────────────────────────────────────
= enveloppe
− déjà dépensé
────────────────────────────────────
= reste à vivre, et reste à vivre par jour
```

Sans revenu saisi, l'écran retombe sur l'ancien plafond manuel
(table `budgets`) et propose de configurer le prévisionnel.

### Les objectifs d'épargne

« 10 000 € avant juin 2027 » ne dit rien. « 1 111 € par mois » dit tout,
et éventuellement que l'objectif est hors de portée. C'est ce chiffre-là
que `lib/goals.ts` calcule, et c'est lui qu'affichent les écrans — la
barre de progression n'est qu'un décor.

Comme les revenus et les charges fixes, rien n'est déplié en base : on
stocke la cible et l'échéance, et on projette à l'affichage. Le montant
mensuel se recalcule donc seul quand un mois passe ou qu'on met à jour
son épargne.

Coché, un objectif **sort de l'enveloppe** au même titre qu'une charge
fixe — on ne peut pas dépenser ce qu'on a déjà mis de côté. C'est ce qui
fait qu'un objectif est atteint plutôt que contemplé. Un objectif atteint
ou dont l'échéance est passée cesse de peser, sinon il écraserait le
budget indéfiniment.

`forecastMonth()` reçoit une **somme**, pas la liste des objectifs :
`lib/forecast.ts` ignore jusqu'à leur existence et ne connaît qu'un
montant qui sort de l'enveloppe.

**Ce qu'il faudrait, et ce qu'on met.** `savings_plans` est une troisième
table de règles, après les revenus et les charges fixes : un montant, un
jour du mois, des bornes de validité, et un `goal_id` qui peut rester
nul — l'épargne libre sort de l'enveloppe sans être fléchée. Elle se
saisit dans le prévisionnel, avec un menu déroulant qui demande vers quel
objectif.

La règle qui les articule : **dès qu'un virement est déclaré pour un
objectif, c'est lui qui sort de l'enveloppe**, pas le montant théorique.
On retient ce qui part vraiment du compte. Le montant nécessaire ne
disparaît pas pour autant, il devient un avertissement — « tu mets 300 €,
il en faudrait 1 111, à ce rythme il manquera 7 300 € en juin ». C'est
cette phrase-là qui fait agir, pas une barre à 40 %.

Un objectif sans virement déclaré retombe sur la retenue d'office, si sa
case est cochée.

**Une prime, un cadeau, un remboursement** se saisissent comme des
versements ponctuels (`savings_entries`), depuis la fiche de l'objectif.
Deux origines, deux comportements :

- **venue d'ailleurs** (le cas par défaut) : l'argent n'était pas dans le
  budget du mois, il n'en sort donc pas. Neutre sur le reste à vivre —
  le compter ferait plonger un mois où l'on a, au contraire, reçu de
  l'argent.
- **prise sur le mois** : un virement en plus depuis l'argent courant,
  qui ponctionne l'enveloppe comme une charge.

Le total épargné reste porté par `saved_cents`, qu'on recopie de son
livret ; un versement l'incrémente. Ces lignes sont l'historique, pas la
source de vérité — sinon saisir un versement *et* recopier son solde
compterait deux fois. L'incrément passe par la fonction SQL
`add_savings_entry` : deux membres saisissant au même instant sur un
objectif commun s'écraseraient autrement.

**Les migrations rejouent sans erreur.** `create policy` n'accepte pas
`if not exists` : chaque policy est donc précédée de son `drop policy if
exists`. Supabase affiche un avertissement à cause du mot `drop` — il ne
porte que sur des règles d'accès, aussitôt recréées, jamais sur des
données.

### L'import de dépenses

On choisit son relevé mensuel en PDF — ou, à défaut, des captures
d'écran — et l'app en tire les dépenses, qu'elle montre avant d'écrire
quoi que ce soit. L'entrée est dans les réglages.

**Le PDF est la bonne voie**, et pas seulement parce qu'il est complet :
une page coûte environ 1 000 jetons, donc un relevé de deux pages
couvre tout un mois pour ~0,7 centime, là où quatre imports de captures
coûtent ~1,9 centime pour une couverture pleine de trous. Les captures
restent proposées parce que toutes les applis bancaires ne savent pas
exporter un relevé.

Le chemin complet : les images sont réduites **dans le navigateur**
(1400 px de côté, JPEG), montent vers une action serveur, qui appelle
l'API Anthropic (`ANTHROPIC_API_KEY`, jamais exposée au client) et
récupère du JSON. Ce JSON repart dans le même aperçu que celui qu'on
collait à la main : l'IA remplit l'étape, elle ne raccourcit pas le
contrôle. Sans clé, l'écran retombe sur le collage manuel.

**Le modèle n'est pas bâillonné.** On a d'abord prérempli sa réponse
avec un `[` pour lui interdire toute phrase d'introduction. Ça
fonctionnait, et il omettait des lignes : forcé d'émettre des données dès
le premier jeton, il n'avait plus aucune marge pour parcourir l'image. Le
même modèle appelé sans cette contrainte relevait une soixantaine
d'opérations là où il en rendait cinquante-six.

`parseExpenseJson` isole donc le premier tableau JSON au milieu d'un
texte, en comptant les crochets et en tenant compte des chaînes — un
libellé contenant `]` couperait sinon le tableau au mauvais endroit. La
phrase d'introduction coûte quelques jetons ; les lignes manquantes
coûtaient bien plus.

`temperature: 0` : relever un relevé n'est pas un exercice de style, on
veut la même réponse deux fois de suite.

**Une requête par pièce, jamais un lot.** Envoyer six captures d'un coup
paraissait économique — une invite, un aller-retour. Mais on demandait
alors d'énumérer sans faute une centaine de lignes réparties sur
plusieurs images, et le modèle en sautait. Découpée en tâches courtes,
chacune tient dans son attention. Les requêtes partent en parallèle, donc
sans latence supplémentaire, et le surcoût — l'invite répétée — vaut
0,1 centime par import. Les lignes manquantes coûtaient plus cher.

Les lectures sont fusionnées et dédoublonnées : deux captures qui se
chevauchent, cas courant quand on fait défiler son relevé, donneraient
sinon la même dépense deux fois.

**Les captures partent en PNG, sans perte.** Un screenshot est un aplat
de couleurs avec du texte fin ; le JPEG y produit du halo autour des
caractères, et à dix pixels de haut un montant devient illisible. On a
compressé en JPEG 0,8 pendant plusieurs versions, ce qui abîmait
précisément ce qu'on demande au modèle de lire. Le coût ne bouge pas :
une image est facturée à ses dimensions, jamais à son poids.

**L'invite dit aussi ce qu'il ne faut PAS relever** — soldes, totaux,
en-têtes, plafonds de carte. Ce sont des chiffres d'affichage ; en
prendre un pour une dépense gonfle le total du mois entier. Le symptôme
est reconnaissable : moins de lignes que la réalité, mais un total plus
élevé.

**Elle donne la date du jour**, parce qu'un relevé affiche « 14 sept. »
sans année et qu'un modèle non situé dans le temps en invente une. Le
symptôme est spectaculaire et silencieux : tout l'import atterrit en
septembre 2024, dans un mois que personne ne consultera jamais. L'invite
explique donc la déduction — une opération ne peut pas être dans le
futur, un mois postérieur au mois en cours appartient à l'année
précédente — et `parseExpenseJson` écarte de son côté toute date future,
garde-fou indépendant du modèle.

**Elle explique comment reconnaître un crédit** et pas seulement qu'il
faut l'ignorer : signe « + », couleur verte, libellés virement reçu,
salaire, remboursement, remise, avoir. Dire « ignore les virements
reçus » ne suffit pas si l'on ne dit pas à quoi ça ressemble.

**L'invite ne s'optimise pas.** Elle vaut ~440 jetons, soit 0,04 centime
par requête, sur une entrée cinq fois moins chère que la sortie. Chaque
tentative pour la raccourcir a coûté des dépenses manquantes ou fausses.
La précision de l'invite est le levier le moins cher du système.

**Ce qui coûte cher, et ce qui n'en a pas l'air.** Les jetons de sortie
valent cinq fois ceux d'entrée. D'où deux choix qui pourraient sembler
arbitraires :

- L'invite réclame la **forme compacte**
  `["2026-09-14", "Carrefour", 42.90, "Courses"]` et non des objets
  nommés. Quatre valeurs au lieu de quatre paires, c'est moitié moins de
  sortie. `parseExpenseJson` accepte toujours les deux, et range le
  tableau **par nature de valeur, pas par position** : un modèle qui
  intervertit intitulé et catégorie ne casse rien.
- Une image est facturée `surface / 750` jetons. On plafonne donc la
  **surface** (`MAX_PIXELS`), pas le côté le plus long : le coût devient
  indépendant de la forme de la capture.

Environ 0,7 centime par import de trois captures.

**Ne pas redescendre `MAX_PIXELS`.** Il a valu 640 000 px pendant une
version, pour économiser 0,2 centime par import. À cette taille le texte
d'une appli bancaire fait huit pixels de haut et la moitié des lignes
passait à la trappe. Le calcul de coût était juste, le résultat mauvais :
une dépense manquante coûte plus cher que la fraction de centime
économisée.

**L'OCR local a été envisagé et écarté.** Extraire le texte des captures
dans le navigateur, puis n'envoyer que du texte, économiserait environ
2 $ par an pour dix personnes — au prix de 3 à 4 Mo de WASM à charger sur
un téléphone et des erreurs de lecture sur les montants, qui ne se voient
pas. L'idée juste derrière — envoyer du texte plutôt que des pixels —
est déjà servie par le **relevé PDF**, dont la couche de texte est réelle
et non devinée.

`lib/import.ts` fait la lecture, à part de React et de la base, donc
testable — une trentaine d'assertions dans `tests/logique.ts`. Le texte
vient d'un modèle de langage : les clés changent de nom, les montants
arrivent en nombre ou en chaîne, les dates en ISO ou en français, et le
tout est souvent emballé dans un bloc Markdown. On accepte largement, et
on nomme chaque ligne refusée plutôt que de rejeter le lot.

Trois règles :

1. **Aucune catégorie n'est créée par un import.** Un modèle qui hésite
   entre « Resto » et « Restaurant » en fabriquerait deux, et le tableau
   de bord afficherait deux tranches pour la même chose. Une catégorie
   inconnue retombe sur « Autre ».
2. **Doublon = même jour, même montant, même intitulé.** Un import se
   refait volontiers deux fois ; les lignes déjà présentes sont comptées
   et ignorées, à l'intérieur du fichier comme en base.
3. **Le JSON est relu côté serveur** avec la même fonction que l'aperçu.
   L'aperçu sert à décider, pas à autoriser.

L'invite remise à l'IA est produite par `promptFor()`, dans le même
fichier que le lecteur : si l'un cesse d'accepter une forme, l'autre doit
changer avec lui. Elle liste les catégories réelles de la personne.

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
