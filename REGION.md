# Région d'exécution

**À régler dans l'interface Vercel, pas dans un fichier.**

Project Settings → Functions → Function Region → la région du projet
Supabase.

Le tableau `regions` de `vercel.json` est ignoré sur le plan Hobby : c'est
une option Pro. Le fichier a donc été retiré pour ne pas laisser croire
que le réglage est versionné.

Par défaut, Vercel exécute à `iad1` (Washington). Si Supabase est en
Europe, chaque requête traverse l'Atlantique deux fois — mesuré à
**+130 ms sur une page qui ne fait pourtant aucune requête base**.

| Région Supabase | Function Region Vercel |
|---|---|
| West EU (Paris) | Paris, France (cdg1) |
| West EU (Ireland) | Dublin, Ireland (dub1) |
| West EU (London) | London, UK (lhr1) |
| Central EU (Frankfurt) | Frankfurt, Germany (fra1) |
| East US (N. Virginia) | Washington, D.C. (iad1) |

Pour vérifier après coup, l'en-tête `x-vercel-id` d'une réponse donne
`<entrée>::<exécution>::<id>`. Les deux premiers doivent être identiques.
