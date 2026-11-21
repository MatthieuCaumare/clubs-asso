# Sites de clubs et associations sportives

Une seule plateforme pour tous les clubs, quel que soit le sport (football, handball, rugby, basket, volley, tennis, pétanque, judo… d'autres sports s'ajoutent facilement).
Les contenus sont stockés dans une base de données en ligne (Supabase, projet « clubs-asso ») et chaque club est alimenté par ses propres modérateurs.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Le site public du club |
| `admin.html` | L'espace modérateurs (connexion, ajout des contenus) |
| `config.js` | Adresse de la base et club affiché par défaut |
| `app.js`, `db.js`, `admin.js`, `*.css` | Le moteur et le design : rien à modifier |

## Adresses

- Site d'un club : `index.html?club=identifiant` (ex. `?club=nibas-fressenneville`)
- Espace modérateurs : `admin.html?club=identifiant`

## Les rôles

- **Administrateur de la plateforme** (vous) : crée les clubs, voit tous les clubs.
- **Administrateur d'un club** : gère les modérateurs de son club et tous ses contenus.
- **Modérateur** : ajoute et modifie les contenus de son club (matchs, scores, convocations, effectifs, évènements, tournoi, photos/vidéos).

Chacun ne peut modifier que son club : c'est la base de données elle-même qui l'impose.

## Ajouter un modérateur

1. Dans l'espace modérateurs → onglet **Modérateurs**, saisir son e-mail et son rôle.
2. Lui envoyer l'adresse de l'espace modérateurs.
3. Il clique sur « Créer mon compte » avec **le même e-mail**, confirme le lien reçu, puis se connecte.

## Ajouter un club

Connecté en administrateur de la plateforme → **+ Nouveau club** : nom, identifiant, sport, couleurs,
et l'e-mail de la personne qui administrera ce club. Le site du club est aussitôt disponible.

## Bon à savoir

- **Photos** : 5 Mo maximum, réduites automatiquement. Les vidéos se mettent sur YouTube (coller le lien).
- **Photos de joueurs** : affichées seulement si la case « autorisation » est cochée (accord des parents pour les mineurs).
- **E-mails de confirmation** : l'envoi intégré de Supabase est limité à quelques e-mails par heure. Au-delà, il faudra brancher un service d'envoi (Brevo, Resend…).
- **E-mails en français** : voir `emails/INSTALLATION.md`.
- **Mise en ligne** : il suffira de publier ce dossier (Netlify, GitHub Pages…), puis de renseigner l'adresse du site dans Supabase (Authentication → URL Configuration) pour que les liens des e-mails ramènent au bon endroit.
