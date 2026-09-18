# Les deux mails d'Orgalise

`confirmation.html` — confirmation d'inscription
`lien-magique.html` — connexion sans mot de passe

## Où les coller

Supabase → Authentication → Emails → Templates.
`confirmation.html` va dans **Confirm signup**, `lien-magique.html` dans
**Magic Link**. Coller le fichier entier dans le champ *Message body*.

**L'éditeur est verrouillé tant qu'un SMTP perso n'est pas branché.**
Sans lui, Supabase impose ses templates par défaut, envoie depuis
`noreply@mail.app.supabase.io` et plafonne à 2 mails par heure. Le
réglage est dans Authentication → SMTP Settings ; ici c'est le SMTP de
Gmail, authentifié par un mot de passe d'application, qui sert de relais.

L'autre issue, si on ne veut pas de SMTP du tout, est de décocher
*Confirm email* dans Authentication → Sign In / Providers → Email :
aucun mail n'est alors envoyé à l'inscription. `signUp()` le gère déjà,
la session arrive directement.

## Le lien n'est pas décoratif

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
```

Ne pas le remplacer par `{{ .ConfirmationURL }}`, le lien par défaut.
Celui-ci revient avec un `?code=` qui a besoin d'un cookie posé dans le
navigateur **au moment de l'inscription**. Or le mail s'ouvre presque
toujours ailleurs : sur iPhone dans Safari, alors que l'inscription
venait de la PWA de l'écran d'accueil, qui a ses propres cookies. Le
cookie manque, l'échange échoue, l'utilisateur atterrit sur
`/connexion?erreur=lien`.

`token_hash` se vérifie côté serveur sans rien attendre du navigateur :
le lien marche depuis n'importe où.

Le `type` doit rester `email` pour la confirmation et `magiclink` pour
la connexion — `app/auth/callback/route.ts` s'en sert pour aiguiller,
et seul `email` mène à `/auth/confirme`.

## Ce que le HTML d'un mail impose

Rien à voir avec l'app : pas de variables CSS, pas de flex, pas de grid,
pas de feuille externe. Tout est en `style=` inline, la mise en page est
faite de `<table>`, et les espacements sont des `<div>` vides — les
marges sont ignorées par plusieurs clients.

Conséquences sur la charte :

- **Les polices ne suivent pas partout.** Fraunces et Karla sont
  chargées par `@import` : Apple Mail les affiche, Gmail les ignore et
  retombe sur Georgia et la police système. Ni Inter, ni Roboto, ni
  Arial dans les replis.
- **Le mode sombre est une faveur, pas une garantie.** La règle
  `prefers-color-scheme` est respectée par Apple Mail ; Gmail l'ignore
  et garde le thème clair, ou applique sa propre inversion. Les deux
  versions sont lisibles, c'est tout ce qu'on peut viser.
- **Le bouton est un `<td>` coloré**, pas un `<a>` avec du padding :
  Outlook ignore le padding sur un lien.

## Vérifier un changement

```sh
sed -e 's|{{ .SiteURL }}|https://exemple.app|g' \
    -e 's|{{ .TokenHash }}|jeton_de_test|g' \
    emails/confirmation.html > /tmp/apercu.html
google-chrome-stable --headless --screenshot=/tmp/apercu.png \
    --window-size=560,860 /tmp/apercu.html
```
