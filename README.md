# Cliicker

Un clicker solo sur la vie associative à l’ENSIIE : de simple élève à prez du BdE.

## Jouer

- Clique pour gagner des points.
- Achète « Un clic plus fort » pour gagner un point de plus à chaque clic.
- Les points gagnés au total débloquent automatiquement les sept échelons.
  Chaque promotion augmente aussi la valeur du clic.

Le premier bonus coûte 20 points et la première promotion arrive à 50 points
cumulés. Dépenser ses points ne fait pas reculer la progression. Les associations
LeBar(c), Bakaclub et ARISE suivent les mêmes règles. Il n’y a plus de projets,
d’équipe à gérer, de réputation, de revenus passifs ou de temps d’attente.
La partie reste jouable après le dernier échelon.

L’écran principal contient le score, le bouton de clic, le prochain échelon et
une seule amélioration. La fiche et son historique restent accessibles par « Ma fiche ».
La fiche est réellement conservée dans **PostgreSQL et MongoDB**.

## Lancer avec Docker Compose

```sh
docker compose up -d --build --wait
```

Ouvrir **http://localhost:8080**. Aucun `.env` n’est nécessaire en local.
Compose construit les images, initialise les bases et démarre l’API et le frontend.
La construction et le démarrage ont été vérifiés avec Docker Engine sur cette machine.

```sh
docker compose ps
docker compose logs api init
docker compose stop
docker compose start
```

Les volumes nommés conservent les données. Ne pas utiliser `docker compose down -v`
pour un simple redémarrage : cette commande efface les bases.

Pour une partie de démonstration distincte sur **http://localhost:8081** :

```sh
docker compose -p cliicker-demo -f compose.yaml -f compose.demo.yaml up -d --build --wait
```

Cette instance possède ses propres volumes et son cookie. Elle suit les mêmes règles
que la partie normale : le jeu simplifié n’a plus de délais à accélérer.
Utiliser les mêmes options `-p` et `-f` pour l’inspecter ou l’arrêter.

## Anciennes parties

À la première lecture d’une partie `ensiie-1`, le serveur la convertit vers
`ensiie-simple-2`. Il conserve la fiche, le solde, le rôle et le nombre de clics.
Chaque ancien niveau d’amélioration devient un point de bonus permanent par clic.
La progression cumulée repart au minimum du seuil du rôle déjà atteint et du solde
conservé. Les anciennes missions ne sont plus actives.

La sauvegarde complète d’origine reste dans `game_state_backups`, dans la même
transaction que la conversion. Le catalogue d’origine reste également en base.
Les nouvelles parties utilisent directement le catalogue simplifié.

## Développer et vérifier

Node 22.12+ recommandé. Le lancement local nécessite un Linux/macOS compatible
avec les binaires PostgreSQL et MongoDB des dépendances de développement.

```sh
npm ci
npm run dev:local
```

Ouvrir **http://localhost:8080**. Les données locales sont conservées dans
`.local-data/normal/`. Ctrl+C arrête les moteurs sans supprimer les données.
`npm run dev:demo` lance une partie indépendante sur le port 8081.

```sh
npm run build
npm test
npm run test:integration
npm run test:browser
npm run simulate
```

- Moteur : prix, bonus, promotions automatiques, lots de clics, limites et conversion.
- Intégration : deux vrais moteurs, double écriture, reprise après panne, isolation,
  achats concurrents, idempotence, archive des anciennes parties et redémarrage.
- Navigateur : inscription, clics, achat, promotion, fiche, historique, sauvegarde,
  mobile et réponse perdue après une écriture réussie. Chromium requis
  (`/usr/bin/chromium`, ou variable `CHROMIUM_PATH`). Captures dans `test-results/`.
- Simulation : parcours complet des trois associations en achetant les bonus dès
  qu’ils sont abordables. Environ 772 clics jusqu’au dernier échelon avec cette stratégie.

Les tests créent leurs propres bases et ne modifient pas les parties Docker.

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
                              ├── PostgreSQL : fiches, sessions, partie, outbox
                              └── MongoDB : historique des fiches, catalogue
init → migrations PostgreSQL + catalogue MongoDB
```

PostgreSQL valide chaque action sous verrou par joueur. Les points sont stockés en
millièmes entiers, les clics sont limités à dix par seconde et chaque requête possède
une clé d’idempotence. Les achats et les promotions sont calculés côté serveur.
Un lot de clics donne les mêmes gains que des clics isolés, y compris au passage
d’un échelon. Il n’y a pas de revenu hors ligne.

Une soumission de fiche écrit sa révision et une tâche d’outbox dans la même
transaction SQL. L’API réplique les tâches vers MongoDB toutes les deux secondes,
avec un upsert idempotent. La reprise après panne est automatique ; il n’y a pas
de transaction distribuée. L’historique est lu dans MongoDB, trié par révision.

Le catalogue est versionné, validé et chargé depuis MongoDB. Modifier son contenu
nécessite une nouvelle version. Les cookies sont HttpOnly et SameSite=Strict ;
les jetons sont stockés sous forme d’empreinte. Les bases ne publient pas de port hôte.

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

## Limites

La partie est solo et liée au cookie du navigateur. Il n’y a pas de récupération
de compte : changer de navigateur ou perdre le cookie fait perdre l’accès à la
partie, même si les données restent en base. Le changement d’association n’est
pas disponible. Les rôles et promotions sont fictifs.

Les membres de l’équipe, le dépôt distant et l’hébergement du rendu restent à
renseigner. Les clés d’idempotence sont conservées sans purge automatique.
