# Installer les e-mails en français dans Supabase

Ces e-mails prennent automatiquement **le nom, les couleurs et le logo du club** de la personne qui s'inscrit.

## 1. Les modèles

Ouvrir : https://supabase.com/dashboard/project/rxorbymavilpwyjwpvvp/auth/templates

Pour chaque onglet, remplacer le **Subject** et coller tout le contenu du fichier dans **Message body** (onglet « Source »), puis **Save** :

| Onglet Supabase | Sujet à mettre | Fichier à coller |
|---|---|---|
| Confirm signup | Confirmez votre adresse e-mail | `1-confirmation-inscription.html` |
| Reset password | Réinitialisation de votre mot de passe | `2-mot-de-passe-oublie.html` |
| Change email address | Confirmez votre nouvelle adresse e-mail | `3-changement-email.html` |
| Magic link | Votre lien de connexion | `4-lien-de-connexion.html` |

## 2. L'adresse du site (pour que le lien de l'e-mail ramène au bon endroit)

Ouvrir : https://supabase.com/dashboard/project/rxorbymavilpwyjwpvvp/auth/url-configuration

- **Site URL** : pour l'instant `http://localhost:5173/admin.html` ; après la mise en ligne, l'adresse du site (ex. `https://clubs-asso.netlify.app/admin.html`).
- **Redirect URLs** : ajouter `http://localhost:5173/**` (et plus tard `https://votre-site/**`).

## 3. Plus tard : l'expéditeur

Les e-mails partent de « Supabase Auth », avec quelques envois par heure au maximum. Pour un expéditeur à votre nom
(« Clubs du Vimeu <contact@…> ») et sans limite, brancher un service comme Brevo ou Resend :
https://supabase.com/dashboard/project/rxorbymavilpwyjwpvvp/auth/smtp

## Modifier les textes

Les textes sont dans `_generer.js`. Après modification : `node emails/_generer.js` depuis le dossier `club`.
`_apercu-confirmation.html` montre le rendu avec les couleurs de l'US Nibas-Fressenneville.
