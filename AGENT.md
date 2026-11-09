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
- Progression sur plusieurs jours, avec des sessions courtes et des activités variées.
- Première étape : planifier le projet avant de développer l’application.

## Première version jouable

Un jeu solo avec une sauvegarde persistante et une campagne visant 7 à 10 jours.
Le prototype commence avec une association fictive ; la première version complète
offre trois spécialités d’association et une même échelle de responsabilités.
Pas de multijoueur, de classement ou de système de prestige dans cette version.
Le calendrier est une cible d’équilibrage, pas un verrou imposant d’attendre un jour réel.

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
Les seuils seront ajustés par simulation et tests pour viser une campagne de 7 à 10 jours.
L’élection finale sera un objectif déterministe dans le MVP, sans vote multijoueur.

### Exemples de contenu

- Améliorations de clic : préparer son pitch, organiser son planning.
- Production passive : groupe de révision, équipe de bénévoles, commission événementielle.
- Projets : tenir un stand, organiser une soirée, monter un événement inter-assos.
- Événements ponctuels : salle indisponible, renfort de bénévoles, semaine associative.

Pour le prototype technique, les projets ont une récompense immédiate. La première
version complète ajoute les projets chronométrés et les événements à choix décrits
ci-dessous. Le prototype sert à vérifier la boucle ; il ne représente pas toute l’expérience.
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
- `active_projects` : projet, équipe affectée, début, fin et état de récompense.
- `event_instances` : événement tiré, choix proposés, décision et récompense.
- `team_members` et `team_assignments` : membres recrutés et affectations.
- `campaign_progress` : engagements, soutiens et étapes de campagne accomplis.
- `achievements` : succès obtenus et récompenses déjà distribuées.
- `owned_upgrades` : partie, identifiant d’amélioration, niveau.
- `completed_projects` : partie, identifiant du projet, date de réalisation.
- `promotions` : partie, rôle atteint, date de promotion.
- `processed_actions` : clés d’idempotence des achats, projets et promotions.

MongoDB :

- `catalog_versions` : version, état de validation et métadonnées.
- `roles` : ordre, conditions et contenu débloqué.
- `upgrades` : coûts, progression des prix et effets.
- `projects` : prérequis, coûts et récompenses.
- `events` : conditions, choix, effets et règles de répétition.
- `associations`, `characters`, `campaigns`, `achievements` : définitions des
  spécialités, personnages, engagements de campagne et succès.

Les documents de contenu portent leur version de catalogue. Les conditions et
effets suivent un schéma validé, sans exécution de code fourni par les documents.

### Règles de sauvegarde et de calcul

- Démarrer sans inscription, avec une session anonyme en cookie HttpOnly.
  La récupération sur un autre navigateur attendra une gestion de compte.
- Le serveur calcule les gains ; le navigateur transmet uniquement les intentions.
- Calculer la production passive à partir du temps serveur écoulé, à chaque action
  ou lecture de la sauvegarde. Aucun processus par joueur n’est nécessaire.
- Accorder jusqu’à 24 heures de production hors ligne à taux plein, à ajuster en test.
  Une absence plus longue ne retire ni réputation, ni amélioration, ni projet terminé.
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

Pour les projets chronométrés, remplacer la route de réalisation immédiate du
prototype par `POST /api/projects/:id/start` et
`POST /api/project-runs/:id/claim`. Ajouter des actions idempotentes pour choisir
l’association, recruter/affecter un équipier, résoudre une instance d’événement,
choisir les engagements de campagne et lancer l’élection. Les identifiants
d’instances appartiennent à une partie et sont vérifiés côté serveur.

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

1. **Cadrage du gameplay.** Partir de la durée cible de 7 à 10 jours, valider les paliers et écrire
   un petit catalogue avec au moins un déblocage par promotion.
   Livrable : tableau des coûts, gains et conditions de progression.
2. **Socle technique.** Créer le frontend, l’API, Compose, les migrations et le seed.
   Critère : une installation vierge démarre avec la commande documentée et l’API
   peut lire les deux bases.
3. **Première boucle jouable.** Ajouter session, clics, sauvegarde et une amélioration
   passive issue de MongoDB.
   Critère : les gains sont calculés côté serveur et la partie survit à un redémarrage.
4. **Progression complète.** Ajouter associations, équipe, projets chronométrés,
   événements à choix, conditions, promotions et campagne finale.
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

## Design détaillé — une campagne sur plusieurs jours

### Promesse et rythme

« Tu venais juste assister à une réunion. Maintenant, on te demande d’organiser le gala. »

Le plaisir vient de trois choses : voir son petit stand devenir une organisation,
choisir comment résoudre les galères étudiantes et retrouver les conséquences de
ses décisions à la connexion suivante. Les clics lancent la progression ; la gestion
de son équipe et de ses projets prend progressivement le relais.

Cible : deux ou trois sessions de 3 à 8 minutes par jour. La première session doit
donner une amélioration en moins d’une minute, une production passive en moins de
trois minutes et le choix d’une association en environ dix minutes. Ces objectifs
sont à mesurer ; ils ne sont pas encore validés par une simulation.

| Moment indicatif | Progression | Nouveauté principale |
| --- | --- | --- |
| Début du jour 1 | Élève puis membre d’asso | Clics, achats et choix de spécialité |
| Jours 1–2 | Bureau d’asso | Premier équipier et délégation |
| Jours 3–4 | Prez d’asso | Deux projets en parallèle et événement signature |
| Jours 5–6 | Membre du BdE | Coopérations entre assos et soutiens |
| Jours 7–8 | Bureau du BdE | Liste, programme et débat |
| Jours 9–10 | Présidence du BdE | Élection et bilan personnalisé |

Les jours indiquent un parcours moyen, pas des dates de déblocage. Un joueur qui
revient une fois par jour peut finir plus lentement sans rencontrer de contenu perdu.
Le jeu ne demande pas de se connecter la nuit et n’envoie pas de notifications dans le MVP.

### Une session typique au jour 3

1. Lire le bilan : « Ton équipe a tenu le stand. Le kakémono a survécu. »
2. Récupérer les gains passifs et le projet terminé la veille.
3. Décider comment réagir à une réservation de salle en double.
4. Choisir entre améliorer son organisation ou recruter un bénévole.
5. Lancer un petit projet et préparer le prochain grand événement.
6. Partir avec une indication claire : ce qui tourne, ce qui sera prêt et ce qui
   manque pour la promotion suivante.

### Le clic reste satisfaisant

Le bouton et son décor évoluent : distribuer des flyers, préparer le stand,
coordonner les bénévoles, puis convaincre les étudiants. Afficher les gains près
du bouton, une animation courte et un retour sonore désactivable.

Le MVP garde un clic simple et accessible au clavier. Après validation du rythme,
ajouter un « coup de main » facultatif : pendant 30 secondes, les 30 premiers clics
acceptés valent double, puis retour au gain normal. Disponibilité toutes les
quatre heures à partir de la dernière activation ; aucune accumulation obligatoire.
Le serveur contrôle le bonus. Pas de mécanique qui récompense la vitesse extrême.
Prévoir une option de réduction des animations et aucun flash rapide.

### Trois façons de vivre son association

Les noms suivants sont inventés pour le jeu. Le choix donne une couleur au parcours,
trois projets exclusifs et un bonus modéré ; aucune spécialité ne bloque un palier.

| Spécialité | Nom de travail fictif | Identité de jeu | Bonus initial à tester |
| --- | --- | --- | --- |
| Tech et jeux | CompIIle & Play | LAN, outils et bidouilles | +10 % de production passive |
| Culture et création | ScènIIE ouverte | Affiches, scène et improvisation | +10 % de réputation de projets |
| Sport et entraide | ÉquIIpe solidaire | Tournois et actions collectives | −10 % de durée des projets |

Expliquer le bonus avant le choix. Autoriser un changement gratuit au palier
« prez d’asso », sans perte de progression ; les projets déjà lancés gardent leurs
paramètres. Le joueur conserve les souvenirs des projets exclusifs déjà terminés.
Tous les objectifs obligatoires disposent d’une solution commune aux spécialités.

### Une petite équipe qui devient attachante

Recruter au maximum trois personnages fictifs. Pas de tirage payant ni de rareté
aléatoire. Chaque recrutement a un coût annoncé et un prérequis de progression.

- **Le roi du tableur** : réduit de 10 % la durée du projet auquel il participe.
  « Il a fait un tableau pour retrouver les autres tableaux. »
- **La reine de la débrouille** : réduit de 10 % le coût du projet affecté.
  « On n’a pas de budget, mais on a du scotch. »
- **Le pote qui connaît tout le monde** : augmente de 10 % la réputation du projet.
  « Il a déjà créé le groupe de discussion. »

Un équipier maximum par projet, affecté au lancement et occupé jusqu’à sa fin.
Il est libéré automatiquement à l’heure de fin, même si la récompense n’a pas encore
été récupérée. Les projets terminés ne bloquent pas les emplacements actifs.
Les personnages ne demandent ni nourriture, ni salaire récurrent, ni entretien.
Les bonus sont déterministes et récapitulés avant confirmation.

### Projets : choisir selon le temps dont on dispose

| Format | Durée cible | Usage | Exemple |
| --- | --- | --- | --- |
| Action de bienvenue | Immédiate, une seule fois | Apprendre sans attendre | Préparer sa première affiche |
| Petit projet | 15–30 minutes | Une session prolongée | Tenir le stand de recrutement |
| Projet normal | 2–4 heures | Entre deux passages | Organiser un tournoi ou une scène ouverte |
| Grand projet | 8–12 heures | Nuit ou journée de cours | Monter l’événement signature de son asso |

Un emplacement actif au départ, deux au palier prez d’asso. Les projets communs
sont rejouables ; les récompenses narratives et les soutiens uniques ne le sont pas.
Le coût est payé au lancement et tous les paramètres sont figés à cet instant.
Le résultat de base est garanti : pas d’échec aléatoire après douze heures d’attente.
Un projet en cours ne s’annule pas dans le MVP ; sa durée est clairement affichée.

La progression exige des catégories variées, par exemple deux projets distincts
et un événement signature, plutôt que vingt répétitions du même stand. Les grands
projets sont compétitifs en récompense par heure pour rendre viable un passage quotidien.
Un projet fini hors ligne reste récupérable sans expiration.

### Événements à choix : les petites galères du campus

Présenter au maximum un événement en attente. Après résolution, un nouvel événement
peut apparaître lors d’un retour au moins quatre heures plus tard, avec un maximum
de deux nouvelles instances par période de 24 heures depuis la création de la partie.
Le tirage est enregistré côté serveur ; actualiser la page ne change pas l’événement.
Un événement ne se répète pas parmi les cinq derniers événements résolus.

Chaque événement comporte deux choix, leurs effets visibles et une sortie gratuite.
Il attend le joueur et ne bloque pas le reste du jeu. Les événements ne retirent
jamais de réputation acquise et ne sont pas nécessaires pour terminer la campagne.

| Situation | Choix A | Choix B |
| --- | --- | --- |
| L’imprimante a décidé de faire grève | Payer un coût d’implication affiché pour une récompense de réputation | Faire une affiche à la main : petite récompense gratuite |
| Deux assos ont réservé la même salle | Mutualiser : gagner un peu de réputation | Installer un stand dehors : gagner de l’implication |
| Le vidéoprojecteur refuse le HDMI | Appeler l’équipe technique : bonus si spécialité tech, récompense de base sinon | Improviser au tableau : réputation garantie |
| Le tableur du budget a 47 onglets | Le ranger : gain d’implication | En faire un atelier : gain de réputation |
| Le groupe de discussion a 312 messages | Publier un récapitulatif : réputation | Répartir les tâches : implication |
| Il reste une montagne de viennoiseries | Organiser une distribution : réputation | Préparer le prochain accueil : implication |

Les valeurs dépendent du palier, sont affichées avant le choix et figées lors du
tirage. Les personnages et les décisions réapparaissent dans le journal de partie.
Les bonus de spécialité enrichissent une option sans supprimer les autres réponses.

### Campagne BdE : une vraie dernière étape

En devenant membre du BdE, débloquer un panneau de campagne. Les soutiens sont des
jalons uniques, pas une troisième monnaie à accumuler indéfiniment.

1. Obtenir trois soutiens parmi cinq collectifs fictifs : tech, culture, sport,
   entraide et événements. Chaque soutien se gagne avec une mission identifiable.
2. Donner un nom à sa liste, choisir un emblème prédéfini et deux engagements
   parmi quatre : matériel mutualisé, événements accessibles, accueil des nouveaux,
   simplification de l’organisation.
3. Accomplir une mission pour chacun des deux engagements retenus.
4. Participer à un débat en trois questions, avec plusieurs réponses cohérentes.
5. Lancer l’élection lorsque les conditions affichées sont remplies : rôle requis,
   seuil de réputation, trois soutiens, deux engagements réalisés et débat terminé.

La victoire est garantie quand ces conditions sont réunies. Les réponses au débat
modifient le texte du bilan et un titre honorifique, pas la possibilité de finir.
Pas de faux scrutin présenté comme un vrai vote ni de remise à zéro sur un jet de dés.
Les engagements peuvent être modifiés avant lancement de leur mission ; ensuite
ils sont conservés jusqu’à la fin de la campagne.

### Récompenses visibles et fin de partie

Le décor central passe du sac de cours au stand, au local associatif puis au bureau
de campagne. Chaque promotion ajoute un objet, une illustration ou un personnage.
Une réalisation mémorable doit apparaître dans l’interface après chaque palier.

Prévoir douze succès au lancement, visibles avec leur condition. Exemples :
« Première réunion, déjà volontaire », « Ça tient avec du scotch », « Le tableur
ultime », « On a retrouvé les clés » et « Bon, qui reprend l’asso ? ».
Ils donnent des badges et des éléments de décor, sans bonus économique obligatoire.

La victoire affiche le nom de liste, le parcours, l’équipe, les grands projets,
les engagements et un titre personnalisé. La partie reste jouable après la victoire.
Une future « nouvelle promo » pourra proposer un nouveau parcours avec héritage
cosmétique, mais aucun redémarrage forcé ni prestige économique dans le MVP.

### Économie : paramètres de départ et garde-fous

Deux ressources seulement. Les valeurs suivantes sont des points de départ pour
le prototype, pas un équilibrage validé de la campagne complète.

- Clic initial : 1 point d’implication ; pas de production passive avant le premier achat.
- Première amélioration : 20 points ; chaque niveau ajoute 0,2 point par seconde.
- Coût du niveau suivant : `ceil(coût_initial × 1,15^niveau_actuel)`.
- Autres familles : matériel de stand, outils d’organisation, réseau de bénévoles,
  coordination inter-assos ; les débloquer à des paliers différents.
- Appliquer les pourcentages à une base explicite ; additionner les bonus de même
  nature avant application pour éviter les multiplications incontrôlées.
- Stocker l’implication en millièmes entiers ; afficher une valeur lisible. Les
  gros entiers passent dans l’API sous forme de chaînes décimales si nécessaire.
- La réputation vient essentiellement des projets. Chaque palier exige un seuil
  cumulatif et des objectifs distincts, sans dépenser la réputation.
- À chaque déblocage, proposer au moins une activité abordable avec les revenus
  actuels. Éviter le verrou où gagner la ressource exige déjà la promotion recherchée.

Après les premiers jours, viser une majorité de revenus passifs : les clics restent
un appoint. Comparer trois profils simulés : un retour quotidien, trois sessions
courtes par jour, et activité intensive. Le profil régulier doit viser 7 à 10 jours ;
le profil quotidien doit pouvoir finir sans achats ni présence continue. Fixer les
seuils après cette simulation, puis vérifier avec de vraies parties.

Indicateurs de test : temps jusqu’au premier achat, temps entre promotions, temps
sans décision abordable, diversité des projets choisis et poids des clics dans les
revenus. Mesurer sur des parties de test ; aucun service d’analytics externe requis.

### Écrans et direction visuelle

- **Campus** : rôle, deux ressources, scène évolutive, bouton principal et prochain objectif.
- **Asso** : améliorations, équipe et projets avec durée et récompense avant lancement.
- **Vie étudiante** : événement en attente, journal court et album de succès.
- **Campagne** : panneau débloqué tardivement, soutiens et programme.

Sur mobile, navigation basse et actions principales accessibles sans survol. Sur
ordinateur, scène au centre et panneaux latéraux. Direction proposée : carnet
associatif, affiches superposées, badges, post-it et couleurs propres à l’association.
Commencer avec des illustrations simples en SVG/CSS et des personnages fictifs ;
les assets plus travaillés viendront après validation de la boucle.
Ne pas utiliser la couleur seule pour indiquer un état. Montrer un compte à rebours
textuel, le détail des bonus et la confirmation de sauvegarde.

### Conséquences techniques des nouvelles mécaniques

- Un projet possède un état `running`, `ready` ou `claimed`, avec une date de fin.
  L’état `ready` peut être dérivé de l’heure serveur ; la récompense s’inscrit une seule fois.
- Résoudre la production passive jusqu’à l’instant d’une mutation avant d’appliquer
  un nouvel achat ou bonus. Un bonus acquis au retour ne s’applique pas rétroactivement.
- Les projets progressent selon leur date de fin même au-delà du plafond des gains
  passifs. Ne pas confondre ce plafond avec la durée de progression des projets.
- Conserver dans PostgreSQL les coûts, effets et dates figés d’une instance, ainsi
  que son identifiant de contenu MongoDB et sa version.
- Les récompenses et déblocages sont atomiques avec la résolution d’une action.
  Une seconde récupération du même projet ou soutien ne produit aucun gain.
- L’API valide les plafonds d’emplacements, affectations et prérequis sous verrou.
- La consultation recalcule les échéances : aucun cron, Redis ou worker requis
  pour ces mécaniques dans le MVP.
- Un mode de test accéléré agit sur l’horloge injectée du moteur en environnement
  de test ; aucun endpoint public ne permet d’avancer le temps.

### Périmètre et ordre de priorité

| Livraison | Contenu | Validation |
| --- | --- | --- |
| Prototype | Clics, passif, sauvegarde, un achat et un projet | La boucle fonctionne avec les deux bases et Compose |
| Version jouable sur plusieurs jours | 7 paliers, 3 spécialités, 3 équipiers, 5 familles d’améliorations, 18 projets dont 9 communs et 9 exclusifs, 12 événements, 12 succès et campagne finale | Chaque spécialité peut finir ; retours intéressants et sauvegarde fiable |
| Après tests | Coup de main, davantage de dialogues, variantes de décor et récupération de compte | Ajouts guidés par les problèmes observés |
| Plus tard | Nouvelle promo, défis alternatifs, éventuel classement facultatif | Ne retarde pas la première campagne complète |

Les missions de soutien et d’engagement font partie des neuf projets communs et
peuvent valider plusieurs objectifs ; éviter de multiplier les catalogues distincts.
Les exemples de ce document fixent le ton. Les coûts, textes et conditions complets
seront écrits dans le catalogue versionné lors de l’implémentation.

### Inspiration ENSIIE et limites de la fiction

La [présentation officielle de la vie associative de l’ENSIIE](https://www.ensiie.fr/vie-etudiante/vie-associative)
décrit une vie associative variée et le rôle du BdE dans son organisation.
C’est le point d’ancrage de l’univers ; les noms proposés, personnages, promotions,
soutiens et règles électorales de ce document sont des inventions de gameplay.
Source consultée le 12 novembre 2026. Les idées et durées ci-dessus sont des choix
de conception, sans prétendre reproduire les usages réels de l’école.

## Choix à affiner ensemble

- Ajuster la cible de 7 à 10 jours après simulation puis tests de jeu.
- Noms et références ENSIIE : associations réelles ou univers entièrement fictif ?
- Direction visuelle : campus illustré, interface de gestion ou pixel art ?
- Compte utilisateur et sauvegarde entre appareils après le MVP ?
