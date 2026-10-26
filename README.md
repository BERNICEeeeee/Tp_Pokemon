# API Pokémon

API REST en Express, TypeScript et PostgreSQL, avec Prisma ORM. Le domaine est
organisé autour des classes `Attack`, `Pokemon` et `Trainer` : elles portent
les règles de jeu, tandis que Prisma persiste leurs relations.

## Prérequis et démarrage

- Bun
- PostgreSQL

1. Installer les dépendances : `bun install`
2. Copier `.env.example` vers `.env`, puis renseigner `DATABASE_URL`.
3. Générer le client et créer les tables : `bun run db:generate`, puis
   `bun run db:migrate --name init`.
4. Démarrer l'API : `bun run dev` (ou `bun run start`).

L'API écoute sur le port `3000` par défaut. La variable `PORT` permet de le
modifier. `GET /health` vérifie que le serveur répond.

Commandes utiles : `bun run typecheck`, `bun test`, et `bun run db:deploy`
pour appliquer les migrations déjà créées en environnement de déploiement.

## Routes

Les routes sont préfixées par `/api`. Les corps de requêtes sont en JSON.

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/trainers` | Liste les dresseurs avec leurs Pokémon et attaques |
| `POST` | `/trainers` | Crée un dresseur (`{ "name": "Sacha" }`) |
| `GET` | `/trainers/:trainerId` | Récupère un dresseur et son équipe |
| `POST` | `/trainers/:trainerId/pokemons` | Ajoute un Pokémon (`{ "name": "Pikachu", "maxLife": 30 }`) |
| `POST` | `/pokemons/:pokemonId/attacks` | Apprend une attaque (`{ "name": "Éclair", "damage": 8, "usageLimit": 5 }`) |
| `POST` | `/pokemons/:pokemonId/heal` | Soigne un Pokémon et réinitialise ses attaques |
| `POST` | `/trainers/:trainerId/tavern` | Soigne toute l'équipe |
| `POST` | `/trainers/:trainerId/experience` | Ajoute de l'expérience (`{ "amount": 3 }`) |
| `POST` | `/battles/random` | Défi aléatoire avec soin préalable |
| `POST` | `/battles/deterministic` | Duel des Pokémon ayant le plus de PV, sans soin |
| `POST` | `/arenas/1` | 100 défis aléatoires, classement par niveau puis expérience |
| `POST` | `/arenas/2` | Jusqu'à 100 duels déterministes, sans soin et arrêt à l'élimination |

Les quatre routes de combat attendent
`{ "trainer1Id": "...", "trainer2Id": "..." }`. Elles renvoient le vainqueur
(ou `null` en cas d'égalité), l'historique des actions ou des combats et les
statistiques finales des arènes. Un dresseur doit posséder au moins un Pokémon
pour combattre. Les attaques infligent des dégâts positifs, ont un nombre
d'utilisations limité, et un Pokémon peut connaître quatre attaques au maximum.
Les combats sont exécutés dans une transaction : les PV, utilisations et gains
d'expérience sont persistés ensemble.
