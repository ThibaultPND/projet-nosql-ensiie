# Cliicker

Projet NoSQL de Thibault CHASSAGNE et Alice MERAUD.

Un clicker solo sur la vie associative à l’ENSIIE : crée ta fiche, clique pour
gagner des points et achète des bonus jusqu’à devenir prez du BdE.
La fiche et ses modifications sont enregistrées dans **PostgreSQL et MongoDB**.

## Lancer avec Docker

Avec Docker et Docker Compose installés :

```sh
git clone https://github.com/ThibaultPND/projet-nosql-ensiie.git
cd projet-nosql-ensiie
docker compose up -d --build --wait
```

Ouvrir **http://localhost:8080**. Aucun fichier `.env` n’est nécessaire en local.
Compose démarre le frontend Nginx, l’API Fastify, PostgreSQL et MongoDB, et initialise les bases.

Pour arrêter et reprendre : `docker compose stop`, puis `docker compose start`.
Les données sont conservées dans les volumes. `docker compose down -v` les supprime.

## Lancer sans Docker

Prérequis : Node.js 22.12+ et Linux/macOS compatible avec les moteurs embarqués.

```sh
npm ci
npm run dev:local
```

Le jeu est disponible sur **http://localhost:8080**. PostgreSQL et MongoDB sont
lancés automatiquement. Les données restent dans `.local-data/normal/` après un arrêt avec Ctrl+C.

## Vérifier les deux bases

Dans le jeu, créer une fiche et attendre « Fiche enregistrée dans les deux bases ».
Avec le lancement Docker, ouvrir deux terminaux :

**PostgreSQL**

```sh
docker compose exec postgres psql -U cliicker -d cliicker
```

```sql
SELECT submission_id, nickname, association_id, presentation, revision
FROM profile_submissions ORDER BY created_at DESC LIMIT 5;
```

**MongoDB**

```sh
docker compose exec mongo sh -lc 'mongosh --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin cliicker'
```

```javascript
db.student_profiles.find({}, { _id: 0 }).sort({ createdAt: -1 }).limit(5)
```

Comparer les identifiants, les champs et les révisions. Une modification dans
**Ma fiche** ajoute une révision dans les deux bases. L’historique est lu dans MongoDB.
L’API enregistre d’abord la fiche dans PostgreSQL, puis la réplique vers MongoDB ;
elle réessaie automatiquement si MongoDB est temporairement indisponible.

## Tests

```sh
npm run build
npm test
npm run test:integration
```

Les tests d’intégration utilisent leurs propres bases PostgreSQL et MongoDB.
Le parcours navigateur se teste avec `npm run test:browser` (Chromium requis,
chemin configurable via `CHROMIUM_PATH`).

## Déploiement

Le déploiement sur serveur reste à faire. Avant le premier lancement, copier
`.env.example` vers `.env`, remplacer les mots de passe, renseigner `APP_ORIGIN`
et activer `COOKIE_SECURE=true` derrière un reverse proxy HTTPS vers le port 8080.
Conserver `WEB_BIND=127.0.0.1`. Ne pas publier le fichier `.env`.

La partie est liée au cookie du navigateur : sans ce cookie, elle n’est plus accessible.
