# RelancePro

SaaS de gestion commerciale pour petites entreprises (Burkina Faso, XOF).
Documentation d'architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Prérequis

- Node.js 24 LTS ou supérieur
- npm 11 ou supérieur
- XAMPP avec MySQL/MariaDB démarré (Apache inutile)

XAMPP fournit MariaDB 10.4. Le projet reste compatible avec MySQL 8. Le
classement utilisé est `utf8mb4_unicode_ci` (compatible MariaDB et MySQL) au
lieu de `utf8mb4_0900_ai_ci`, spécifique à MySQL 8.

MariaDB 10.4 n'étant plus maintenu, le développement local peut l'utiliser mais
la production doit cibler MySQL 8.4 ou une version MariaDB LTS. Les migrations
doivent être rejouées sur la version de production avant déploiement.

## Installation

```bash
npm install
```

## Base de données de développement

Démarrer MySQL depuis le panneau de contrôle XAMPP, puis créer la base et
l'utilisateur :

```sql
CREATE DATABASE IF NOT EXISTS relancepro_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'relancepro_dev'@'127.0.0.1'
  IDENTIFIED BY '<mot_de_passe_local>';
ALTER USER 'relancepro_dev'@'127.0.0.1'
  IDENTIFIED BY '<mot_de_passe_local>';
GRANT ALL PRIVILEGES ON relancepro_dev.* TO 'relancepro_dev'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Créer `server/.env` à partir de `server/.env.example` et renseigner le mot de
passe ainsi qu'un secret JWT local. Ce fichier est ignoré par Git.

```bash
npm run db:migrate
```

## Base de données de test

Les tests d'intégration utilisent une base séparée, `relancepro_test`. La base
doit exister ; ses tables sont migrées automatiquement par la suite de tests.
Créer la base et autoriser l'utilisateur :

```sql
CREATE DATABASE IF NOT EXISTS relancepro_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON relancepro_test.* TO 'relancepro_dev'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## Variables d'environnement

| Variable                 | Rôle                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `NODE_ENV`               | `development`, `test` ou `production`                                                  |
| `PORT`                   | Port de l'API (5000 par défaut)                                                        |
| `APP_ORIGIN`             | Origine CORS (5173 en développement, HTTPS obligatoire en production)                  |
| `DB_HOST`, `DB_PORT`     | Hôte et port MySQL/MariaDB                                                             |
| `DB_USER`, `DB_PASSWORD` | Identifiants de la base locale                                                         |
| `DB_NAME`                | `relancepro_dev` en développement, `relancepro_test` en test                           |
| `JWT_ACCESS_SECRET`      | Secret HS256 aléatoire, 32 caractères minimum ; valeur d’exemple refusée en production |
| `COOKIE_SECURE`          | `false` en local HTTP, `true` obligatoire en production HTTPS                          |
| `AUTH_RATE_LIMIT_MAX`    | Tentatives auth par fenêtre de 15 min (5 par défaut)                                   |

Ne jamais committer `server/.env` ni afficher son contenu dans les logs.

## Démarrage

Deux terminaux :

```bash
npm run dev:server
npm run dev:client
```

- API : http://localhost:5000/api/v1/health
- Interface : http://localhost:5173
- Proxy Vite : `/api` → `http://localhost:5000`

Le front utilise `react-router`. En production, le serveur statique doit
renvoyer `index.html` pour toutes les routes inconnues.

## Authentification

Routes disponibles sous `/api/v1/auth` :

| Méthode | Route                       | Accès         |
| ------- | --------------------------- | ------------- |
| `POST`  | `/register`                 | public        |
| `POST`  | `/login`                    | public        |
| `POST`  | `/refresh`                  | cookie + CSRF |
| `POST`  | `/logout`                   | cookie + CSRF |
| `GET`   | `/me`                       | access cookie |
| `POST`  | `/reset-password`           | public + code |
| `PATCH` | `/password`                 | auth + CSRF   |
| `POST`  | `/recovery-code/regenerate` | auth + CSRF   |

Cookies : `rp_at` (access JWT, 15 min), `rp_rt` (refresh opaque, 30 jours,
rotatif), `csrf_token` (lisible par le JS pour le double-submit). Les cookies
`rp_at` et `rp_rt` sont httpOnly et `rp_rt` est limité à `/api/v1/auth`.

Le code de récupération est affiché une seule fois à l'inscription ou après
réinitialisation. Il n'est jamais renvoyé ensuite et aucun email n'est envoyé au
MVP.

## Qualité

```bash
npm run lint
npm run format:check
npm test
npm run db:check
npm run db:migrate
```

`npm test` exécute les tests serveur (supertest + base `relancepro_test`) puis
les tests client (Vitest + Testing Library + jsdom).

## Structure

```
client/   interface React (Vite, Tailwind)
server/   API Express, accès MySQL, migrations, stockage local
docs/     documentation d'architecture
```
