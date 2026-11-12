# Cliicker — direction du projet

## Version simplifiée

La demande du 13 novembre 2026 remplace la précédente conception de jeu de gestion.
L’objectif est un clicker très simple : cliquer, acheter un bonus au clic et gravir
progressivement les échelons jusqu’à la présidence du BdE.

- Un seul écran principal, un seul solde et une seule amélioration achetable.
- Sept rôles, débloqués automatiquement selon les points gagnés depuis le début.
- Les achats ne retirent rien à la progression cumulée.
- Chaque promotion augmente la valeur du clic. Les bonus achetés restent acquis.
- Aucun projet, réputation, équipe, campagne, événement ou revenu passif.
- Les trois associations sont des choix de personnage, sans différence économique.
- Fiche et historique accessibles à part. Pas de détails d’architecture dans le jeu.

Le catalogue `ensiie-simple-2` définit les seuils et les bonus. Les parties
`ensiie-1` sont converties sous transaction en conservant solde, rôle, clics et
bonus d’anciens achats. La sauvegarde d’origine est archivée dans
`game_state_backups`. Ne pas supprimer les volumes pour appliquer la mise à jour.

## Contraintes techniques conservées

Le formulaire de fiche (pseudo, association, présentation) et chaque révision
sont conservés dans PostgreSQL et MongoDB. La réplication utilise une outbox
transactionnelle avec reprise idempotente. L’historique vient de MongoDB.

Les mutations de jeu sont validées côté serveur sous verrou, avec une clé
d’idempotence et un plafond de dix clics par seconde. Un lot de clics doit donner
le même résultat que des clics isolés, même si une promotion survient au milieu.

Docker Compose lance web, API, PostgreSQL, MongoDB et l’initialisation. Les volumes
conservent les parties. Le mode démo conserve une session et des volumes distincts,
avec les mêmes règles de jeu.

## Vérification

Voir README.md : compilation, tests moteur, tests d’intégration sur les deux
moteurs réels, navigateur bureau/mobile et simulation du parcours jusqu’au BdE.
Les données de test sont indépendantes des parties existantes.
