# Orgalise

Agenda partagé + budget perso, pour deux personnes.
Contexte produit, design system et décisions techniques : [CLAUDE.md](CLAUDE.md).
Maquettes de référence : [design/](design/).

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les deux clés Supabase
npm run dev                  # http://localhost:3000
```

Sans les clés, l'écran de connexion s'affiche quand même et indique ce qu'il manque.

### Côté Supabase

1. Créer un projet (plan Free).
2. **SQL Editor → New query** : coller [schema.sql](schema.sql), exécuter.
3. **SQL Editor** : exécuter aussi les fichiers de [migrations/](migrations/),
   dans l'ordre, si le projet a été créé avant.
4. **Project Settings → API** : copier `Project URL` et la clé `anon` dans `.env.local`.
5. **Authentication → URL Configuration → Redirect URLs** : ajouter
   `http://localhost:3000/auth/callback` (et l'URL Vercel en prod).

Rappel : un projet gratuit se met en pause après 7 jours sans requête.

### Lecture des captures bancaires (facultatif)

`/budget/import` fait lire un relevé PDF ou des captures d'écran par un
modèle de vision.
Sans clé, l'écran retombe sur le collage d'un JSON préparé ailleurs — il
reste utilisable, il est juste moins direct.

```
ANTHROPIC_API_KEY=sk-ant-…
```

En local dans `.env.local`, en production dans Vercel → Settings →
Environment Variables. La clé ne quitte jamais le serveur : les images
montent vers une action serveur qui appelle l'API et ne renvoie que du
texte. Ce texte repasse par `parseExpenseJson` avant toute écriture — le
modèle ne décide jamais de ce qui entre en base.

## Écrans

| Route | Maquette | Rôle |
|---|---|---|
| `/connexion` | `Connexion` | mot de passe, lien magique, création de compte |
| `/groupe` | `Groupe` | créer un espace **ou** rejoindre avec un code |
| `/espace` | `Espace` | étape 2 : code d'invitation, membres, flux iCal |
| `/accueil` | `Accueil` | timeline du jour, prochain événement, budget restant |
| `/agenda` | `Main` | vue semaine, 7 mini-timelines 7 h → 23 h |
| `/agenda/jour` | `Jour` | colonnes parallèles, creux communs surlignés |
| `/agenda/mois` | `Mois` | densité d'occupation, journées ouvertes en honey |
| `/agenda/evenement` | — | saisie / modification d'un événement commun |
| `/budget` | `Budget` | tableau de bord : reste à vivre, tendance 6 mois, catégories |
| `/budget/plan` | — | revenus, charges fixes, dépenses prévues |
| `/budget/ajout` | `Ajout` | montant + pavé numérique custom + 8 catégories |
| `/budget/tableau` | `Tableau` | recherche, filtres, sous-totaux par jour, export CSV |
| `/budget/import` | — | relevé PDF ou captures, lus par un modèle de vision |
| `/budget/objectifs` | — | objectifs d'épargne, personnels ou communs |
| `/nous` | `Espace` | membres, prénoms, calendriers branchés, déconnexion |

Navigation basse unifiée à quatre entrées : **Accueil · Agenda · Budget · Nous**.

## Architecture

```
app/
  (app)/          écrans internes — garde d'accès, nav basse, synchro iCal
  api/ics/sync    synchro des calendriers, appelée à l'ouverture de l'app
  api/expenses/csv export CSV du mois
  auth/callback   retour des liens e-mail et de l'OAuth
lib/
  agenda.ts       rubans, créneaux libres, densité — le cœur du produit
  dates.ts        fuseaux, semaines, formatage français
  intervals.ts    fusion et complément de plages
  recurrence.ts   dépliage RRULE + EXDATE, à la volée
  ics.ts          import iCal en lecture seule
  budget.ts       totaux du mois, par catégorie, tableau de bord
  forecast.ts     projection revenus / charges fixes / dépenses prévues
  sync.ts         téléchargement et remplacement des busy_blocks
  supabase/       clients navigateur / serveur / session
proxy.ts          rafraîchit la session, garde les routes privées
tests/logique.ts  contrôles de la logique métier
```

## Scripts

```bash
npm run dev        # serveur de dev
npm run build      # build de production
npm run start      # sert le build
npm run typecheck  # tsc --noEmit
npm test           # logique métier : fuseaux, récurrence, ICS, montants
```

## Reste à faire

- Notifications push (étape 8 de l'ordre de construction) — non commencé.
- Nom de l'app, toujours en placeholder dans [lib/config.ts](lib/config.ts).
