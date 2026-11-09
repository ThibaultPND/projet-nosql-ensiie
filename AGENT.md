# Cliicker — plan du projet

## Objectif

Créer un clicker Web sur le thème de l’ENSIIE. On incarne un iiens qui commence
comme simple élève, s’investit dans une association, entre au bureau et progresse
jusqu’à devenir prez du BdE.

Ce document sert de base de travail. Les contraintes sont fixées ; les choix
techniques, les paliers et les chiffres ci-dessous sont des propositions à affiner.
Les rôles sont une progression fictive pour le jeu, pas une description officielle
du fonctionnement des associations de l’école.

## Contraintes fixées

- Application Web lancée avec Docker Compose.
- Utilisation réelle de PostgreSQL et d’une base NoSQL.
- Univers ENSIIE et vie associative étudiante.
- Progression de simple élève à prez du BdE.
- Première étape : planifier le projet avant de développer l’application.

## Première version jouable

Un jeu solo avec une sauvegarde persistante, une association fictive et une seule
voie de progression. Pas de multijoueur, de classement ou de système de prestige
dans cette version.

L’écran principal affiche le rôle actuel, les ressources, le bouton de clic,
les améliorations disponibles et les conditions de la prochaine promotion.
Il doit rester utilisable sur ordinateur et sur mobile, y compris au clavier.

### Boucle de jeu

1. Cliquer sur « S’impliquer » pour gagner de l’implication.
2. Dépenser cette implication dans des améliorations.
3. Produire de l’implication automatiquement grâce aux améliorations.
4. Réaliser des projets associatifs pour gagner de la réputation.
5. Atteindre les objectifs du prochain rôle et demander sa promotion.
6. Débloquer de nouvelles activités jusqu’à l’élection à la présidence du BdE.

### Ressources

| Ressource | Utilité | Obtention |
| --- | --- | --- |
| Implication | Acheter les améliorations et financer les projets | Clics et production passive |
| Réputation | Débloquer les promotions | Projets et événements accomplis |

La réputation est cumulative et ne se dépense pas. Limiter le jeu à deux
ressources au départ facilite l’équilibrage et la compréhension.

### Progression proposée

| Palier | Rôle | Objectif de passage proposé |
| --- | --- | --- |
| 1 | Simple élève | Accumuler de l’implication et participer à une activité |
| 2 | Membre d’asso | Acheter des améliorations et réaliser un premier projet |
| 3 | Membre du bureau d’asso | Organiser plusieurs activités et gagner de la réputation |
| 4 | Prez d’asso | Réaliser un événement important pour son association |
| 5 | Membre du BdE | Mener un projet entre plusieurs associations |
| 6 | Membre du bureau du BdE | Préparer une campagne et atteindre le seuil de réputation |
| 7 | Prez du BdE | Remporter l’élection finale et afficher le bilan de partie |

Chaque promotion doit apporter du contenu ou une amélioration visible.
Les seuils et la durée cible d’une partie seront fixés après un premier prototype.
L’élection finale sera un objectif déterministe dans le MVP, sans vote multijoueur.

### Exemples de contenu

- Améliorations de clic : préparer son pitch, organiser son planning.
- Production passive : groupe de révision, équipe de bénévoles, commission événementielle.
- Projets : tenir un stand, organiser une soirée, monter un événement inter-assos.
- Événements ponctuels : salle indisponible, renfort de bénévoles, semaine associative.

Pour le MVP, les projets ont un coût, des prérequis et une récompense immédiate.
Les événements aléatoires et les projets chronométrés viendront ensuite.
Utiliser des noms fictifs tant que les références aux vraies associations ne sont
pas définies. Le ton est étudiant et humoristique, sans viser de personnes réelles.

## Architecture proposée

- Frontend : React avec TypeScript et Vite.
- API : Node.js avec TypeScript et Fastify.
- Données transactionnelles : PostgreSQL.
- Données documentaires : MongoDB, pour répondre à la contrainte NoSQL.
- Déploiement local : Docker Compose.

Le frontend appelle uniquement l’API. L’API est seule à accéder aux deux bases
et à calculer les gains, les achats et les promotions.

### Répartition des données

| Base | Données | Raison |
| --- | --- | --- |
| PostgreSQL | Joueurs, sessions, sauvegardes, soldes, améliorations possédées, projets terminés et promotions | Transactions et cohérence de la progression |
| MongoDB | Catalogue versionné des rôles, améliorations, projets et événements | Documents aux conditions et effets variables |

MongoDB est réellement utilisé : l’API y charge les règles et le contenu nécessaires
à une partie. Le catalogue initial est chargé par une commande de seed reproductible.
Un catalogue incomplet empêche la création d’une partie avec un message explicite.

Chaque partie référence une version immuable du catalogue et des identifiants
stables de contenu. Les anciennes versions utilisées par des sauvegardes sont
conservées. Une validation vérifie les références avant de publier un catalogue.
Les opérations de jeu écrivent uniquement dans PostgreSQL : elles n’ont pas besoin
d’une transaction distribuée entre les deux bases.

### Modèle de données minimal

PostgreSQL :

- `players` : identité anonyme du joueur.
- `sessions` : empreinte du jeton de session et expiration.
- `game_states` : joueur, version du catalogue, rôle, implication, réputation,
  date du dernier calcul de production et version de sauvegarde.
- `owned_upgrades` : partie, identifiant d’amélioration, niveau.
- `completed_projects` : partie, identifiant du projet, date de réalisation.
- `promotions` : partie, rôle atteint, date de promotion.
- `processed_actions` : clés d’idempotence des achats, projets et promotions.

MongoDB :

- `catalog_versions` : version, état de validation et métadonnées.
- `roles` : ordre, conditions et contenu débloqué.
- `upgrades` : coûts, progression des prix et effets.
- `projects` : prérequis, coûts et récompenses.
- `events` : conditions, choix et effets, pour une étape ultérieure.

Les documents de contenu portent leur version de catalogue. Les conditions et
effets suivent un schéma validé, sans exécution de code fourni par les documents.

### Règles de sauvegarde et de calcul

- Démarrer sans inscription, avec une session anonyme en cookie HttpOnly.
  La récupération sur un autre navigateur attendra une gestion de compte.
- Le serveur calcule les gains ; le navigateur transmet uniquement les intentions.
- Calculer la production passive à partir du temps serveur écoulé, à chaque action
  ou lecture de la sauvegarde. Aucun processus par joueur n’est nécessaire.
- Proposer un plafond de huit heures pour les gains hors ligne, à ajuster en test.
- Utiliser des unités entières et un reste de calcul pour éviter les erreurs d’arrondi.
- Regrouper les clics sur une courte fenêtre et plafonner leur fréquence côté serveur.
  Cela limite les abus sans prétendre éliminer les autoclickers.
- Traiter le calcul des gains et la mutation de progression dans une même transaction,
  avec verrouillage de la sauvegarde pour éviter les doubles dépenses entre onglets.
- Rendre les actions économiques idempotentes et ne jamais accepter un solde client.
- Prévoir validation des entrées, limites de requêtes et protection des actions
  authentifiées contre les requêtes provenant d’une autre origine.

### API envisagée

| Route | Fonction |
| --- | --- |
| `POST /api/session` | Créer ou retrouver une session anonyme |
| `GET /api/game` | Charger la progression et calculer les gains passifs |
| `GET /api/catalog` | Charger le contenu de la version associée à la partie |
| `POST /api/clicks` | Envoyer un lot borné de clics |
| `POST /api/upgrades/:id/buy` | Acheter un niveau d’amélioration |
| `POST /api/projects/:id/complete` | Réaliser un projet accessible |
| `POST /api/promotions` | Valider la prochaine promotion |
| `GET /api/health` | Vérifier la disponibilité de l’API et des bases |

### Services Docker Compose

| Service | Responsabilité |
| --- | --- |
| `web` | Servir le frontend compilé et relayer `/api` vers l’API |
| `api` | Exécuter les règles du jeu et accéder aux bases |
| `postgres` | Stocker les sauvegardes dans un volume persistant |
| `mongo` | Stocker le catalogue dans un volume persistant |
| `init` | Exécuter les migrations SQL et charger le catalogue avant le démarrage de l’API |

Seul `web` expose un port à l’hôte dans la configuration par défaut. Prévoir des
healthchecks, une attente explicite de l’initialisation et des nouvelles tentatives
de connexion côté API. L’initialisation doit être rejouable sans écraser les parties.
Les secrets passent par l’environnement ; un `.env.example` documentera les valeurs
nécessaires. Les versions d’images seront fixées lors de l’implémentation.

Commande cible : `docker compose up --build`. Cette commande n’est pas encore
disponible : ce dépôt contient pour l’instant le plan, pas l’application.

## Organisation cible du dépôt

```text
AGENT.md
README.md
compose.yaml
.env.example
apps/
  web/
  api/
packages/
  shared/       # Types et schémas partagés
content/        # Sources versionnées du catalogue à charger dans MongoDB
db/
  migrations/   # Migrations PostgreSQL
```

## Étapes de réalisation

1. **Cadrage du gameplay.** Choisir la durée cible, valider les paliers et écrire
   un petit catalogue avec au moins un déblocage par promotion.
   Livrable : tableau des coûts, gains et conditions de progression.
2. **Socle technique.** Créer le frontend, l’API, Compose, les migrations et le seed.
   Critère : une installation vierge démarre avec la commande documentée et l’API
   peut lire les deux bases.
3. **Première boucle jouable.** Ajouter session, clics, sauvegarde et une amélioration
   passive issue de MongoDB.
   Critère : les gains sont calculés côté serveur et la partie survit à un redémarrage.
4. **Progression complète.** Ajouter projets, conditions, promotions et fin de partie.
   Critère : on peut jouer du simple élève au prez du BdE sans modifier les bases à la main.
5. **Équilibrage et interface.** Ajuster les coûts, les retours visuels, l’affichage
   mobile et les gains hors ligne.
   Critère : le joueur comprend la prochaine action et la condition de promotion.
6. **Validation et livraison.** Documenter le lancement, vérifier la persistance
   et tester les principaux scénarios d’erreur et de concurrence.

## Vérifications attendues lors du développement

- Calcul des coûts, production passive, plafond hors ligne et promotions.
- Refus d’un achat sans ressources ou d’une promotion prématurée.
- Absence de double récompense après répétition d’une même requête.
- Achats concurrents sans solde négatif et progression cohérente entre deux onglets.
- Chargement du catalogue MongoDB et conservation de sa version pour une partie.
- Parcours complet jusqu’au BdE avec une configuration de test accélérée.
- Démarrage Compose sur des volumes neufs, puis redémarrage sans perte de données.
- Erreur compréhensible si une base est indisponible.

## Consignes pour la suite du travail

- Garder la documentation et le vocabulaire du jeu en français.
- Avancer par petites étapes jouables, en commençant par la boucle minimale.
- Garder les règles de gameplay côté serveur et le contenu dans le catalogue.
- Ne pas ajouter de services sans besoin concret du MVP.
- Ne pas committer de secrets, de données de joueurs ou de volumes de bases.
- Ne pas supprimer les volumes Docker pour résoudre un problème sans accord explicite.
- Mettre à jour ce plan quand un choix est validé ou modifié.
- Ce fichier se nomme `AGENT.md` à la demande du porteur du projet ; les outils qui
  recherchent uniquement `AGENTS.md` devront être explicitement dirigés vers ce fichier.

## Choix à affiner ensemble

- Durée cible d’une partie : courte démonstration ou progression sur plusieurs jours ?
- Noms et références ENSIIE : associations réelles ou univers entièrement fictif ?
- Direction visuelle : campus illustré, interface de gestion ou pixel art ?
- Compte utilisateur et sauvegarde entre appareils après le MVP ?
