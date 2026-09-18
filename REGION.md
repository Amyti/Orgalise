# Région d'exécution

`vercel.json` fixe la région des fonctions à `cdg1` (Paris).

Sans ce fichier, Vercel exécute en `iad1` (Washington) par défaut. Chaque
requête vers Supabase traverse alors l'Atlantique deux fois : environ
90 ms de plus par aller-retour, sur les quatre que demande un écran.

**Cette valeur doit correspondre à la région du projet Supabase.**
Elle se lit dans Supabase → Settings → General → Region.

| Région Supabase | Valeur à mettre dans `vercel.json` |
|---|---|
| West EU (Paris) `eu-west-3` | `cdg1` |
| Central EU (Frankfurt) `eu-central-1` | `fra1` |
| West EU (Ireland) `eu-west-1` | `dub1` |
| East US (N. Virginia) `us-east-1` | `iad1` |
| West US (Oregon) `us-west-1` | `pdx1` |

Mettre une région éloignée de Supabase est **pire** que ne rien mettre :
on fige alors le mauvais choix au lieu de laisser Vercel router.
