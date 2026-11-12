# Cliicker

Un clicker solo sur la vie associative à l’ENSIIE. Tu rejoins **LeBar(c)**,
**Bakaclub** ou **ARISE**, construis ton équipe et progresses jusqu’à la présidence
du **BdE**. Les personnages, projets et élections sont fictifs.

Projet conçu pour le [sujet NoSQL](https://leperuvienn.github.io/notes-cours/S3/NSQL/Projet/).
La fiche saisie dans le navigateur est réellement conservée dans **PostgreSQL et
MongoDB**. L’historique affiché dans le jeu est lu dans MongoDB.

## État de la livraison

- Implémentés : formulaire, double persistance récupérable, sessions anonymes,
  sauvegarde serveur, 7 rôles, 3 associations de départ, 5 améliorations, 20 projets,
  3 équipiers, 6 événements, soutiens des assos et objectifs de campagne.
- Tests : moteur et simulation ; API avec de vrais processus PostgreSQL et MongoDB ;
  navigateur Chromium sur ordinateur et mobile.
- Compose normal et démo : fichiers validés par le CLI Compose, images disponibles.
  **Construction des images et exécution des conteneurs non vérifiées : aucun moteur
  Docker n’est disponible sur la machine de développement.**
- À compléter pour le rendu : membres de l’équipe, URL GitHub, hébergement serveur
  et vérification du lancement Compose depuis un clone neuf. Aucun dépôt distant
  ou serveur n’a été créé automatiquement.

## Interface et interactions

Le campus rassemble le bouton principal, la prochaine promotion et une suggestion
pour avancer. La barre de ressources reste visible ; la navigation passe en bas de
l’écran sur mobile. Les projets se filtrent par disponibilité, durée, campagne ou
réalisation, et une recherche permet de retrouver une mission rapidement.

Les clics réagissent immédiatement, les projets affichent leur progression et les
promotions sont célébrées dans un dialogue. Le compteur d’implication est une
estimation animée entre les confirmations du serveur : aucune ressource n’est
attribuée par le navigateur. Une réponse perdue peut être rejouée avec la même clé,
sans doubler les gains. Les raisons des verrouillages sont affichées sur les cartes.

Les animations respectent la préférence système. Elles peuvent aussi être réduites
avec le bouton en bas de la navigation sur ordinateur, ou dans **Ma fiche** sur
mobile. Les illustrations sont des SVG embarqués, sans ressource externe à charger.

## Jouer sans Docker sur cette machine

Prérequis : npm et un environnement Linux/macOS compatible avec les binaires de
PostgreSQL et MongoDB des dépendances de développement. Node 22.12+ recommandé ;
le projet inclut aussi un binaire Node 22 comme outil de développement npm.

```sh
npm ci
npm run dev:local
```

Ouvrir **http://localhost:8080**. Le premier démarrage peut télécharger le binaire
MongoDB. Il lance deux vrais moteurs sur des ports locaux libres et l’API sert le
frontend compilé. Pas de Docker, pas de privilèges administrateur requis.
Les données restent dans `.local-data/normal/`, ignoré par Git. Ctrl+C arrête les
processus sans effacer la sauvegarde. Garder le même navigateur et le même nom
d’hôte pour retrouver sa session.

Pour parcourir rapidement les promotions :

```sh
npm run dev:demo
```

Ouvrir **http://localhost:8081**. Les durées des projets et les gains passifs sont
accélérés × 3 600. Les données et le cookie de session sont distincts de la partie
normale. Le premier achat nécessite toujours 20 clics. Le mode démo est une option
au lancement du serveur, jamais une commande envoyée depuis le navigateur.

Les tests créent leurs propres bases et ne touchent pas ces sauvegardes. Si le
processus local a été tué brutalement, un fichier `launch.lock` peut subsister :
contrôler le PID indiqué et l’absence de processus utilisant ce dossier avant toute
intervention. Ne pas effacer le dossier de données pour résoudre un blocage.

## Lancer avec Docker Compose

Prérequis : Docker Engine et Compose récent ; Compose 2.24.4+ pour `!override`
utilisé par la configuration de démonstration. Depuis le clone du dépôt :

```sh
docker compose up
```

Ouvrir **http://localhost:8080**. Les valeurs locales par défaut permettent de
lancer sans fichier `.env`. Compose construit les images, attend les bases,
exécute les migrations et le seed, puis démarre l’API et le frontend.
Les volumes nommés conservent les données entre les arrêts.

```sh
docker compose ps
docker compose logs api init
docker compose stop
docker compose start
```

Après une modification du code, utiliser `docker compose up --build`.
Ne pas lancer `docker compose down -v` pour un simple redémarrage : cette commande
efface les volumes des bases.

Mode soutenance, sur le port 8081 et dans des volumes distincts :

```sh
docker compose -p cliicker-demo -f compose.yaml -f compose.demo.yaml up
```

Utiliser toujours les mêmes options `-p` et `-f` pour arrêter ou inspecter cette
instance. Ne pas activer le mode démo sur les volumes d’une partie normale.

## Vérifier la double persistance

1. Créer une fiche avec un pseudo et une présentation reconnaissables.
2. Attendre « Fiche enregistrée dans les deux bases ».
3. Ouvrir les deux terminaux suivants et comparer les champs et identifiants.

Terminal PostgreSQL :

```sh
docker compose exec postgres psql -U cliicker -d cliicker
```

```sql
SELECT submission_id, nickname, association_id, presentation, revision
FROM profile_submissions
ORDER BY created_at DESC LIMIT 5;

SELECT submission_id, delivered_at, attempts FROM outbox_events;
```

Terminal MongoDB :

```sh
docker compose exec mongo sh -lc 'mongosh --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin cliicker'
```

```javascript
db.student_profiles.find({}, {
  _id: 0, submissionId: 1, nickname: 1, associationId: 1,
  presentation: 1, revision: 1
}).sort({createdAt: -1}).limit(5)

db.catalogs.find({}, { _id: 0, version: 1 })
```

Modifier la présentation dans **Ma fiche**, consulter l’historique et retrouver les
deux révisions dans les bases. Faire `docker compose restart` puis répéter la lecture.

Pour montrer la reprise après panne : arrêter uniquement MongoDB avec
`docker compose stop mongo`, modifier une fiche existante, puis remettre MongoDB
avec `docker compose start mongo`. La saisie reste dans PostgreSQL et est répliquée
au retour de MongoDB ; l’interface attend la confirmation. Ne pas redémarrer l’API
pendant cette démonstration : son catalogue est déjà en cache et la panne ne doit
pas être confondue avec un démarrage sans catalogue.

## Architecture et données

```text
Navigateur → web (Nginx) → api (Fastify)
                              ├── PostgreSQL : profils, sessions, jeu, outbox
                              └── MongoDB : historique des profils, catalogue
init → migrations PostgreSQL + catalogue MongoDB
```

**PostgreSQL** conserve `players`, `sessions`, `player_profiles`,
`profile_submissions`, `outbox_events`, `game_states` et `processed_actions`.
Les tables de profils rendent les saisies directement consultables en SQL.
La progression du jeu est un agrégat JSONB dans `game_states`, verrouillé par joueur
pour chaque mutation. Cette simplification remplace les nombreuses petites tables
initialement envisagées, tout en conservant les transactions PostgreSQL.

**MongoDB** conserve les révisions des fiches dans `student_profiles`, indexées
par identifiant de soumission et par joueur/révision. `catalogs` contient les règles
et les projets sous forme d’un document validé par version. Le catalogue est chargé
par l’API, jamais utilisé comme autorité par le navigateur. Une sauvegarde conserve
sa version ; modifier un catalogue publié exige un nouvel identifiant de version.

Lors d’une saisie, une transaction PostgreSQL écrit la fiche courante, sa révision
et une tâche d’outbox. Toutes les deux secondes, l’API transmet les tâches à MongoDB
avec un upsert idempotent, puis confirme leur livraison dans PostgreSQL. Une panne
entre ces opérations est récupérable. **Il n’y a pas de transaction distribuée** :
la cohérence entre les deux moteurs est éventuelle et son état est affiché.
Les révisions sont triées par numéro, pas par ordre de livraison.

Les actions du jeu sont validées côté serveur, avec des clés d’idempotence, un
verrou par joueur, un plafond de clics et des dates serveur. Les récompenses sont
figées au lancement d’un projet et ne peuvent être récupérées qu’une fois. Les gains
passifs sont limités à 24 h ; les projets terminés restent récupérables sans expiration.

Les cookies de session sont HttpOnly et SameSite=Strict ; les jetons sont stockés
sous forme d’empreinte. Les mutations demandent un en-tête propre à l’application
et, en configuration Compose, une origine autorisée. Aucun CORS public n’est activé.
Les bases ne sont pas publiées sur des ports hôte.

## Développer et tester

```sh
npm ci
npm test
npm run test:integration
npm run build
npm run test:browser
npm run simulate
```

- `test` : règles économiques, plafonds, concurrence logique des équipiers,
  récompenses uniques, catalogue et parcours complet des trois associations.
- `test:integration` : vraies bases temporaires, mêmes saisies dans les deux moteurs,
  isolation des sessions, reprises et achats concurrents. PostgreSQL et MongoDB sont
  aussi redémarrés avec les mêmes données. Les données temporaires de PostgreSQL restent
  dans un dossier `cliicker-test-*` sous le répertoire temporaire du système.
- `test:browser` : nécessite Chromium (`/usr/bin/chromium` par défaut, personnalisable
  par `CHROMIUM_PATH`). Création, jeu, modification, historique, rechargement, filtres, recherche, dialogues,
  mobile, animations réduites et reprise après perte de réponse réseau.
  Captures dans `test-results/`, ignoré par Git. Exécuter `build` avant.
- `simulate` : stratégie automatique avec 1, 3 ou 12 passages par jour. Résultats
  initiaux : 14–16 jours, 7–8 jours et 4,7–5,4 jours respectivement. Cela teste la
  faisabilité, sans remplacer l’équilibrage avec de vrais joueurs.

Pour travailler avec des bases déjà disponibles, définir `DATABASE_URL` et
`MONGO_URL`, puis utiliser `npm run db:init`, `npm run dev:api` et `npm run dev`
dans des terminaux distincts. Le serveur Vite relaie `/api` au port 3000.

## Déploiement serveur à effectuer

La machine distante doit disposer de Docker et Compose. Copier `.env.example` vers
`.env`, remplacer les mots de passe locaux par des secrets aléatoires URL-safe,
configurer `APP_ORIGIN` avec l’URL exacte et `COOKIE_SECURE=true` derrière HTTPS.
Ne jamais committer `.env`. Les identifiants sont initialisés au premier lancement
des bases : changer simplement les variables après création des volumes ne change
pas les mots de passe stockés dans les moteurs.

Conserver `WEB_BIND=127.0.0.1` avec un reverse proxy HTTPS sur le serveur qui relaie
vers le port 8080. L’URL publique, les membres de l’équipe et la destination GitHub
restent à renseigner. Une fois le serveur disponible, y vérifier le parcours et
les deux bases avant de déclarer le déploiement terminé.

## Démonstration de soutenance

1. Présenter le parcours élève → asso → BdE et les quatre associations.
2. Remplir la fiche, puis prouver la double écriture avec `psql` et `mongosh`.
3. Expliquer la différence entre les rôles des deux moteurs et la reprise par outbox.
4. Jouer en mode démo : 20 clics, planning partagé, première affiche, promotion,
   projets longs accélérés, puis soutiens et engagements BdE.
5. Modifier la fiche, afficher les révisions et démontrer la persistance au redémarrage.

## Limites et suites

Le jeu est solo. Il n’y a pas de récupération de compte : perdre le cookie ou changer
de navigateur fait perdre l’accès à la partie, même si les données restent en base.
Le changement d’asso en cours de campagne, les succès cosmétiques, le choix du nom
de liste et les réponses au débat restent à développer. Le débat et deux engagements
sont actuellement des projets à accomplir. Le catalogue propose 6 événements au
lieu des 12 imaginés dans le plan. Les clés d’idempotence sont conservées sans
purge automatique : prévoir une politique de rétention avant une exploitation longue.

La conception détaillée et les objectifs ultérieurs sont dans [AGENT.md](AGENT.md).
