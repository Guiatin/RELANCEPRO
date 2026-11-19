# RelancePro — Analyse et architecture technique (Étape 1)

Statut : version finale, en attente de validation explicite pour l'Étape 2.
Développement non démarré.
Version : 1.2 — 19/11/2026 (décisions définitives intégrées)
Périmètre : MVP commercialisable, marché initial Burkina Faso, devise XOF,
interface FR, **budget zéro**.

Décisions validées : §17. Points résolus et vigilances non bloquantes : §18.
Aucun point bloquant technique ne subsiste pour démarrer l'Étape 2.

---

## 1. Synthèse

RelancePro est un SaaS multi-entreprises (multi-tenant) de gestion commerciale.
Chaque entreprise est un tenant isolé. Dans le MVP, une entreprise possède un
seul utilisateur propriétaire ; le modèle et les middlewares sont préparés pour
les rôles et invitations futurs. Toutes les données métier (clients, produits,
devis, factures, paiements, relances) portent un `company_id` et sont filtrées
côté serveur.

Choix structurants :

1. **Multi-tenant à schéma partagé**, isolation par `company_id`, FK composites
   sur toutes les relations métier, lignes de documents incluses.
2. **Montants en entiers** (XOF), calculs côté backend, sans flottants.
3. **TVA configurable** (18 % par défaut), taux par ligne, exonération à taux 0
   avec code prédéfini et motif pour « autre ».
4. **Solde et statut de paiement dérivés** des paiements ; aucune duplication.
5. **Numérotation** `DEV-AAAA-0001` / `FAC-AAAA-0001`, annuelle, attribuée à
   l'envoi du devis et à l'émission de la facture. Un brouillon n'a pas de numéro.
6. **JWT en cookies httpOnly**, refresh rotatif révocable, CSRF double-submit.
7. **PDF serveur via PDFKit**, générés à partir d'instantanés figés à l'émission.
8. **SQL explicite** dans des repositories, requêtes préparées, sans ORM.
9. **Aucun email au MVP.** Récupération de compte par **code de récupération**
   affiché une seule fois à la création, stocké uniquement sous forme d'empreinte.
10. **Identifiants `BIGINT` exposés en chaînes** dans l'API et le frontend.
11. **Relances manuelles** uniquement (journalisation, planification, statut).
12. **Stockage local** derrière une abstraction `storage`, sans service payant.
13. **Budget zéro** : uniquement des composants gratuits ou open source.
14. **Déploiement neutre** vis-à-vis de l'hébergeur.

---

## 2. Périmètre fonctionnel

### 2.1 Inclus dans le MVP

| Module                | Contenu                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentification      | Inscription (entreprise + propriétaire), code de récupération affiché une fois, connexion, déconnexion, session, réinitialisation par code, changement de mot de passe, régénération du code |
| Tableau de bord       | Indicateurs période, impayés, retards, devis en attente, encaissements, dernières factures, relances à venir                                                                                 |
| Clients               | CRUD, recherche, activation/désactivation, fiche client, historique, relevé                                                                                                                  |
| Produits & services   | CRUD, type, prix unitaire, unité, TVA par défaut, activation/désactivation, recherche                                                                                                        |
| Devis                 | Brouillon, lignes, remises par ligne, TVA/exonérations, référence client externe facultative, PDF, envoi (numéro), statuts, conversion                                                       |
| Factures              | Brouillon (éditable, y compris issu d'une conversion), émission (numéro, immutabilité), PDF, échéance, annulation sans paiement, référence client externe facultative                        |
| Paiements             | Paiements multiples et partiels, méthodes, annulation motivée, calcul du solde                                                                                                               |
| Relances              | Journalisation manuelle, planification, canaux, statut. Aucun envoi réel                                                                                                                     |
| Paramètres entreprise | Identité, IFU/RCCM, logo, TVA par défaut et mention d'exonération, préfixes, délai de paiement, pied de document                                                                             |
| Utilisateurs          | Propriétaire unique ; colonnes `role`/`is_active` conservées                                                                                                                                 |

### 2.2 Explicitement hors périmètre MVP

- Gestion de stock.
- Comptabilité générale, lettrage, rapprochement bancaire.
- Avoirs et factures d'acompte.
- Paiements en ligne.
- **Tout email** (relances, réinitialisation, vérification) : V1.1.
- Invitations multi-utilisateurs et rôles avancés : V1.1.
- Bon de commande et escompte : version ultérieure.
- Application mobile native, multi-devises, multi-langues, portail client.
- Export comptable.
- Stockage objet (S3) et tout service payant.

### 2.3 Contrainte absolue : budget zéro

Le MVP ne doit introduire aucun coût récurrent ni dépendance nécessitant une
carte bancaire.

| Élément           | Choix gratuit / open source                                               |
| ----------------- | ------------------------------------------------------------------------- |
| Frontend          | React, Vite, Tailwind CSS, React Router, Axios (MIT)                      |
| Backend           | Node.js, Express (MIT), ES Modules                                        |
| Base de données   | MySQL Community 8 (GPL) — ou MariaDB compatible                           |
| PDF               | PDFKit (MIT)                                                              |
| Auth              | jsonwebtoken, bcrypt, crypto natif (MIT / Apache-2.0)                     |
| Validation        | Zod (MIT)                                                                 |
| Sécurité          | Helmet, express-rate-limit (MIT)                                          |
| Logs              | Pino (MIT)                                                                |
| Icônes            | lucide-react (ISC)                                                        |
| Polices           | Inter, auto-hébergée (SIL OFL) — aucun CDN payant ni Google Fonts distant |
| HTTPS             | Let's Encrypt (gratuit)                                                   |
| Email             | Aucun au MVP ; Nodemailer (MIT) réservé à la V1.1                         |
| Stockage fichiers | Disque local                                                              |
| Sauvegardes       | Scripts locaux (`mysqldump`, copie des uploads)                           |
| Supervision       | Logs locaux ; aucun SaaS payant                                           |

Règles :

- Toute nouvelle dépendance doit être gratuite, open source ou gratuite d'usage
  sans carte bancaire, avec licence compatible (MIT, ISC, BSD, Apache-2.0, GPL
  côté outil).
- Aucun service externe payant, essai payant, API facturée à l'usage ou service
  exigeant une carte bancaire sans validation préalable écrite.
- Les polices et icônes sont servies par l'application, pas par un tiers.
- Le développement et les tests se font intégralement en local, sans coût.
- La cible de déploiement finale devra être gratuite ou auto-hébergée ; ce point
  est traité à l'Étape 5 et ne bloque pas le développement.

---

## 3. Décisions d'architecture (ADR)

| #   | Décision                                                                          | Justification                                             | Alternative écartée                    |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| A1  | Monorepo `client/` + `server/`                                                    | Dépôt unique, versions cohérentes                         | Deux dépôts                            |
| A2  | Isolation tenant par `company_id` sur chaque table métier                         | Simple, performant, sans extension MySQL                  | Schéma par tenant                      |
| A3  | FK composites `(company_id, id)` sur toutes les relations métier, lignes incluses | Empêche au niveau SQL tout rattachement inter-entreprises | Contrôle applicatif seul               |
| A4  | Montants `BIGINT` (XOF entier)                                                    | Pas de flottant, pas d'arrondi monétaire                  | `DECIMAL`                              |
| A5  | Solde et statut de paiement calculés                                              | Source de vérité unique : `payments`                      | Cache `amount_paid`                    |
| A6  | Access JWT 15 min + refresh 30 j rotatif haché en base                            | Révocation réelle                                         | JWT longue durée                       |
| A7  | Cookies httpOnly, Secure en prod, SameSite=Lax                                    | Pas de token lisible en JS                                | localStorage                           |
| A8  | CSRF double-submit                                                                | Défense complémentaire                                    | SameSite seul                          |
| A9  | Numérotation par `document_sequences` + verrou ligne                              | Unicité et sûreté en concurrence                          | `MAX(number)+1`                        |
| A10 | Numéro attribué à l'envoi (devis) / à l'émission (facture)                        | Un brouillon n'est pas un document fiscal                 | Numéro dès la création                 |
| A11 | PDFKit côté serveur                                                               | Léger, pas de navigateur headless                         | Puppeteer                              |
| A12 | Snapshots client/entreprise au moment de l'émission                               | PDF fidèle même après modification des fiches             | Données vivantes                       |
| A13 | Soft delete et annulation au lieu de suppression                                  | Préserve l'historique                                     | Suppression physique                   |
| A14 | Pas d'ORM, SQL dans repositories                                                  | Exigence du cahier des charges                            | Prisma/Sequelize                       |
| A15 | Migrations SQL numérotées + runner maison                                         | SQL lisible, sans dépendance superflue                    | ORM de migration                       |
| A16 | Propriétaire unique au MVP, modèle multi-utilisateurs conservé                    | Réduit le périmètre sans bloquer l'évolution              | Invitations dès le MVP                 |
| A17 | TVA par ligne, exonération codifiée                                               | Souplesse et traçabilité fiscale                          | TVA globale fixe                       |
| A18 | Déploiement neutre, même origine recommandée                                      | Portabilité et cookies simples                            | Hébergeur imposé                       |
| A19 | Aucun email au MVP                                                                | Budget zéro et périmètre validé                           | SMTP dès le MVP                        |
| A20 | Code de récupération unique, affiché une fois, haché                              | Récupération de compte sans coût ni email                 | Reset par email / compte irrécupérable |
| A21 | Identifiants exposés en chaînes                                                   | Précision `BIGINT` garantie, pas de perte > 2^53          | Conversion en `Number`                 |
| A22 | Stockage local derrière l'abstraction `storage`                                   | Zéro coût, migration possible                             | S3 dès le MVP                          |
| A23 | Référence client externe facultative sur devis/facture                            | Besoin commercial courant, coût nul                       | Champ omis                             |
| A24 | Dépendances soumises à la règle budget zéro                                       | Aucune surprise de facturation                            | Adoption libre                         |

---

## 4. Architecture applicative

```
Navigateur
  React 19 + Vite + Tailwind 4 + React Router + Axios
  Cookies httpOnly (access/refresh) + X-CSRF-Token
  Identifiants = chaînes
        |
        | HTTPS, même origine recommandée
        v
Nginx (statique + reverse proxy /api)   [ou équivalent gratuit/auto-hébergé]
        |
        v
Express 5 (ES Modules)
  routes -> middlewares (auth, tenant, csrf, validation, rate limit)
         -> controllers (HTTP)
         -> services (règles métier, transactions)
         -> repositories (SQL préparé, filtré par company_id)
         -> mysql2 pool (BIGINT -> chaînes)
        |
        +--> PDFKit
        +--> storage local
        +--> mailer (interface inactive ; V1.1)
        v
MySQL 8 (utf8mb4, InnoDB, UTC)
```

### 4.1 Couches backend

| Couche       | Rôle                                                         | Interdits           |
| ------------ | ------------------------------------------------------------ | ------------------- |
| routes       | Endpoints, composition des middlewares                       | Métier, SQL         |
| controllers  | Entrée HTTP, appel service, formatage                        | SQL, règles métier  |
| services     | Règles métier, transactions, calculs, orchestration          | `req`/`res`         |
| repositories | SQL préparé, paramétré par `companyId`                       | HTTP, règles métier |
| middlewares  | Auth, tenant, CSRF, validation, erreurs, limites             | Accès tables        |
| utils        | Argent, dates, ids, pagination, erreurs, PDF, stockage, mail | Effets implicites   |

Aucun `company_id` accepté depuis le client : il provient du JWT
(`req.auth.companyId`, chaîne).

### 4.2 Flux d'une requête protégée

1. `requireAuth` : cookie access, signature, expiration → `{ userId, companyId, role }` (identifiants en chaînes).
2. `requireActiveUser` : utilisateur existant et actif.
3. `validate(schema)` : validation stricte (whitelist), rejet 422.
4. `csrfProtect` : comparaison cookie/header sur les écritures.
5. Controller → Service → Repository (`companyId` obligatoire).
6. Handler d'erreurs central, réponses normalisées, pas de stack en prod.

---

## 5. Arborescence proposée

```
relancepro/
├─ docs/
│  └─ ARCHITECTURE.md
├─ client/
│  ├─ public/
│  │  └─ fonts/               # Inter auto-hébergée
│  ├─ src/
│  │  ├─ app/                 # App, router, providers, guards
│  │  ├─ assets/
│  │  ├─ components/
│  │  │  ├─ ui/              # Button, Input, Select, Modal, Table, Badge,
│  │  │  │                   # Card, StatCard, EmptyState, Pagination, Toast,
│  │  │  │                   # ConfirmDialog, Skeleton, Tabs
│  │  │  ├─ layout/          # Sidebar, Topbar, MobileDrawer, PageHeader
│  │  │  └─ domain/          # StatusBadge, Amount, ClientPicker,
│  │  │                      # LineItemsEditor, TaxInput, RecoveryCodeModal
│  │  ├─ features/
│  │  │  ├─ auth/  dashboard/  clients/  products/  quotes/
│  │  │  ├─ invoices/  payments/  reminders/  settings/
│  │  │  │   (pages/, components/, hooks/, api.js, schemas.js)
│  │  ├─ lib/                # http.js, format.js, validation.js, constants.js
│  │  ├─ hooks/              # useDebounce, usePagination, useConfirm
│  │  ├─ context/            # AuthContext, ToastContext
│  │  └─ styles/
│  ├─ index.html
│  └─ vite.config.js
├─ server/
│  ├─ src/
│  │  ├─ config/             # env.js, db.js, constants.js
│  │  ├─ routes/             # auth, clients, products, quotes, invoices,
│  │  │                      # payments, reminders, dashboard, company
│  │  ├─ controllers/
│  │  ├─ services/
│  │  ├─ repositories/
│  │  ├─ middlewares/        # auth, csrf, validate, error, rateLimit
│  │  ├─ validators/         # schémas Zod par domaine
│  │  ├─ utils/              # money, dates, ids, errors, pdf, storage,
│  │  │                      # recoveryCode, mail, logger
│  │  ├─ templates/          # PDF devis/facture (gabarit commun)
│  │  ├─ db/
│  │  │  ├─ migrations/      # 001_init.sql, 002_...
│  │  │  ├─ seeds/           # dev/test uniquement, double garde
│  │  │  └─ migrate.js
│  │  ├─ app.js
│  │  └─ server.js
│  ├─ tests/
│  └─ .env.example
├─ package.json
├─ .gitignore
└─ README.md
```

---

## 6. Modèle relationnel MySQL

Conventions :

- InnoDB, `utf8mb4`, `utf8mb4_0900_ai_ci`.
- Clés primaires `BIGINT UNSIGNED AUTO_INCREMENT`.
- **En base** : identifiants `BIGINT`. **En JavaScript et dans l'API** : chaînes
  (`"42"`), jamais converties en `Number`.
- Horodatages UTC ; dates métier en `DATE`.
- Montants `BIGINT` (XOF entier), taux `DECIMAL(5,2)`.
- `company_id BIGINT UNSIGNED NOT NULL` sur chaque table métier.
- Types strictement identiques entre colonnes de FK composites.

### 6.1 Tables

#### companies

`id`, `name`, `legal_name`, `tax_id` (IFU), `trade_register` (RCCM),
`email`, `phone`, `address`, `city`, `country` (def. `BF`), `currency`
(def. `XOF`), `logo_path`, `default_tax_rate` (def. 18.00),
`tax_exemption_mention`, `quote_prefix` (def. `DEV`), `invoice_prefix`
(def. `FAC`), `payment_terms_days` (def. 30), `document_footer`,
`created_at`, `updated_at`.

#### users

`id`, `company_id` FK, `full_name`, `email` **UNIQUE global**, `password_hash`,
`role` ENUM(`owner`,`admin`,`member`) — `owner` seul au MVP —, `is_active`,
`created_at`, `updated_at`, `deleted_at`.
Contraintes : `UNIQUE(company_id, id)`, `UNIQUE(email)`.
Index : `(company_id, is_active)`.
Le propriétaire ne peut être ni supprimé ni désactivé s'il est le dernier
compte actif.

#### recovery_codes

`id`, `user_id` FK, `code_hash` CHAR(64), `created_at`, `used_at`, `revoked_at`.
Index : `(user_id)`, `(user_id, used_at, revoked_at)`.
Un seul code actif par utilisateur (`used_at` et `revoked_at` NULL), garanti par
le service dans une transaction avec verrou sur l'utilisateur.
Aucune valeur en clair n'est stockée, journalisée ou renvoyée après la création.

#### sessions

`id`, `user_id` FK, `token_hash` CHAR(64), `expires_at`, `revoked_at`,
`replaced_by_id`, `ip`, `user_agent`, `created_at`.
Index : `(user_id)`, `(token_hash)`.

#### clients

`id`, `company_id` FK, `name`, `contact_name`, `email`, `phone`, `whatsapp`,
`address`, `city`, `notes`, `is_active`, `created_by`, `created_at`,
`updated_at`, `deleted_at`.
Contraintes : `UNIQUE(company_id, id)`. Index `(company_id, name)`,
`(company_id, phone)`, `(company_id, is_active)`.

#### products

`id`, `company_id` FK, `type` ENUM(`product`,`service`), `name`,
`description`, `unit`, `unit_price` BIGINT, `tax_rate` DECIMAL(5,2),
`is_active`, `created_at`, `updated_at`, `deleted_at`.
Contraintes : `UNIQUE(company_id, id)`. Index `(company_id, is_active)`,
`(company_id, name)`.

#### quotes

`id`, `company_id`, `client_id`, `number` NULL tant que brouillon,
`status` ENUM(`draft`,`sent`,`accepted`,`refused`,`converted`),
`issue_date` (date d'envoi), `valid_until`, `subtotal`, `discount_total`,
`tax_total`, `total`, `notes`, `terms`, `client_reference` VARCHAR(100) NULL,
`client_snapshot` JSON NULL, `issuer_snapshot` JSON NULL, `created_by`,
`sent_at`, `accepted_at`, `created_at`, `updated_at`, `deleted_at`.
Contraintes :

- `UNIQUE(company_id, number)` (plusieurs NULL autorisés : brouillons).
- `UNIQUE(company_id, id)`.
- FK composite `(company_id, client_id)` → `clients(company_id, id)`
  `ON DELETE RESTRICT`.
  Index : `(company_id, status)`, `(company_id, valid_until)`,
  `(company_id, client_id)`, `(company_id, client_reference)`.

#### quote_items

`id`, `company_id`, `quote_id`, `product_id` NULL, `position`, `description`,
`quantity` DECIMAL(12,2), `unit`, `unit_price` BIGINT,
`discount_rate` DECIMAL(5,2), `tax_rate` DECIMAL(5,2),
`tax_exemption_code` ENUM(`legal`,`export`,`special_regime`,`other`) NULL,
`tax_exemption_reason` VARCHAR(150) NULL, `line_subtotal`, `line_discount`,
`line_tax`, `line_total`.
Contraintes :

- FK composite `(company_id, quote_id)` → `quotes(company_id, id)`
  `ON DELETE CASCADE`.
- FK composite `(company_id, product_id)` → `products(company_id, id)`
  `ON DELETE RESTRICT` (non vérifiée si `product_id` NULL, comportement voulu).
- Règles applicatives : `tax_rate = 0` ⇒ `tax_exemption_code` obligatoire ;
  code `other` ⇒ `tax_exemption_reason` obligatoire ; `tax_rate > 0` ⇒ code et
  motif NULL.
  Index : `(company_id, quote_id, position)`.

#### invoices

`id`, `company_id`, `client_id`, `quote_id` NULL, `number` NULL tant que
brouillon, `status` ENUM(`draft`,`issued`,`cancelled`), `issue_date`,
`due_date`, `subtotal`, `discount_total`, `tax_total`, `total`, `notes`,
`terms`, `client_reference` VARCHAR(100) NULL, `client_snapshot` JSON NULL,
`issuer_snapshot` JSON NULL, `created_by`, `issued_at`, `cancelled_at`,
`cancel_reason`, `created_at`, `updated_at`, `deleted_at`.
Contraintes :

- `UNIQUE(company_id, number)`.
- `UNIQUE(company_id, id)`.
- `UNIQUE(quote_id)` — une seule facture par devis (plusieurs NULL autorisés).
- FK composite `(company_id, client_id)` → `clients(company_id, id)`
  `ON DELETE RESTRICT`.
- FK composite `(company_id, quote_id)` → `quotes(company_id, id)`
  `ON DELETE RESTRICT`.
  Index : `(company_id, status)`, `(company_id, due_date)`,
  `(company_id, client_id)`, `(company_id, issued_at)`,
  `(company_id, client_reference)`.

#### invoice_items

Structure identique à `quote_items`, avec `invoice_id` et FK composite
`(company_id, invoice_id)` → `invoices(company_id, id)` `ON DELETE CASCADE`.

#### payments

`id`, `company_id`, `invoice_id`, `amount` BIGINT, `method` ENUM(`cash`,
`mobile_money`,`bank_transfer`,`cheque`,`card`,`other`), `reference`,
`paid_at` DATETIME, `notes`, `status` ENUM(`recorded`,`voided`),
`voided_at`, `voided_by`, `void_reason`, `recorded_by`, `created_at`.
Contraintes :

- FK composite `(company_id, invoice_id)` → `invoices(company_id, id)`
  `ON DELETE RESTRICT`.
  Index : `(invoice_id, status)`, `(company_id, paid_at)`.
  Aucune suppression physique : annulation uniquement.

#### reminders

`id`, `company_id`, `invoice_id`, `channel` ENUM(`email`,`phone`,`whatsapp`,
`sms`,`letter`,`other`), `status` ENUM(`planned`,`done`,`cancelled`),
`scheduled_at`, `done_at`, `subject`, `message`, `created_by`, `created_at`,
`updated_at`.
Contraintes :

- FK composite `(company_id, invoice_id)` → `invoices(company_id, id)`
  `ON DELETE RESTRICT`.
  Index : `(company_id, status, scheduled_at)`, `(invoice_id, created_at)`.
  Client déduit de la facture.

#### document_sequences

`company_id`, `doc_type` ENUM(`quote`,`invoice`), `period` SMALLINT (année),
`last_value` INT UNSIGNED. PK `(company_id, doc_type, period)`.

#### audit_logs

`id`, `company_id`, `user_id` NULL, `action`, `entity_type`, `entity_id`,
`metadata` JSON, `ip`, `created_at`.
Index : `(company_id, created_at)`, `(entity_type, entity_id)`.
Journalise au minimum : inscription, régénération/utilisation du code de
récupération, émission/annulation de facture, paiement/annulation, envoi de
devis, conversion, modifications de paramètres, échecs de connexion.

#### schema_migrations

`version`, `applied_at`.

### 6.2 Relations

```
companies 1─n users            users 1─n recovery_codes / sessions
companies 1─n clients
companies 1─n products
companies 1─n quotes           quotes 1─n quote_items
companies 1─n invoices         invoices 1─n invoice_items
companies 1─n payments
companies 1─n reminders
clients   1─n quotes / invoices
products  1─n quote_items / invoice_items (optionnel)
quotes    0..1─1 invoices (via invoices.quote_id, unique)
invoices  1─n payments
invoices  1─n reminders
```

### 6.3 Contraintes garantissant l'isolation (vérifiées)

| Relation enfant → parent       | Colonnes                   | Effet si tentative inter-entreprises |
| ------------------------------ | -------------------------- | ------------------------------------ |
| quote.client → client          | `(company_id, client_id)`  | FK refusée                           |
| invoice.client → client        | `(company_id, client_id)`  | FK refusée                           |
| invoice.quote → quote          | `(company_id, quote_id)`   | FK refusée                           |
| quote_item.quote → quote       | `(company_id, quote_id)`   | FK refusée                           |
| quote_item.product → product   | `(company_id, product_id)` | FK refusée (si produit)              |
| invoice_item.invoice → invoice | `(company_id, invoice_id)` | FK refusée                           |
| invoice_item.product → product | `(company_id, product_id)` | FK refusée (si produit)              |
| payment.invoice → invoice      | `(company_id, invoice_id)` | FK refusée                           |
| reminder.invoice → invoice     | `(company_id, invoice_id)` | FK refusée                           |

Ces FK reposent sur `UNIQUE(company_id, id)` déclaré sur `clients`,
`products`, `quotes`, `invoices` et `users`.

Règles applicatives :

- `company_id` du JWT injecté par middleware, jamais lu dans le body.
- Toute requête par identifiant comporte `AND company_id = ?`.
- Ressource d'une autre entreprise → `404`.
- Tests obligatoires : insertion SQL directe inter-entreprises → erreur FK ;
  appels API avec un identifiant de B depuis la session A → 404.

### 6.4 Suppression, immutabilité et historique

| Entité                               | Suppression | Règle                                                                     |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| Client                               | Logique     | Refusée si devis/factures non brouillon existent ; désactivation possible |
| Produit                              | Logique     | Refusée si utilisé dans un document non brouillon                         |
| Devis brouillon                      | Logique     | Lignes remplaçables                                                       |
| Devis envoyé/accepté/refusé/converti | Interdite   | Immuable hors statut                                                      |
| Facture brouillon                    | Logique     | Aucun numéro consommé ; éditable                                          |
| Facture émise                        | Interdite   | Immuable ; annulation sans paiement uniquement                            |
| Paiement                             | Interdite   | Annulation motivée                                                        |
| Relance                              | Interdite   | Clôture ou annulation                                                     |
| Code de récupération                 | Rotation    | Ancien code révoqué, nouveau créé ; jamais réaffiché                      |
| Propriétaire                         | Interdite   | Désactivation impossible pour le dernier propriétaire actif               |
| Sessions / codes expirés             | Physique    | Purge planifiée autorisée                                                 |

Historique :

- `client_snapshot` et `issuer_snapshot` (JSON) figés à l'envoi/à l'émission,
  utilisés pour régénérer le PDF à l'identique.
- Les lignes conservent description, unité, prix, remise, taux et code/motif
  d'exonération. Modifier un produit ne change aucun document passé.
- `issue_date`, `issued_at` et le numéro d'une facture émis sont définitifs et
  conservés dans l'historique (audit).
- Aucun numéro émis n'est réutilisé, même après annulation.
- `document_sequences` n'est jamais supprimé en cours d'année.

---

## 7. Règles métier et calculs financiers

### 7.1 Montants, TVA et exonérations

- XOF sans sous-unité : entiers positifs. Saisie décimale rejetée (422).
- Borne de sécurité : montant ≤ 999 999 999 999 FCFA (validation), conversions
  sûres vers `Number` pour les montants uniquement ; les identifiants restent
  des chaînes.
- Arrondi `ROUND_HALF_UP` par ligne, puis somme.
- Calcul d'une ligne :
  1. `line_subtotal = ROUND(quantity × unit_price)`
  2. `line_discount = ROUND(line_subtotal × discount_rate / 100)`
  3. `base = line_subtotal − line_discount`
  4. `line_tax = ROUND(base × tax_rate / 100)`
  5. `line_total = base + line_tax`
- Totaux : `subtotal`, `discount_total`, `tax_total`, `total =
subtotal − discount_total + tax_total`. Invariant vérifié ; les totaux
  envoyés par le client sont ignorés.

TVA :

- `companies.default_tax_rate` = 18 % modifiable ; taux par ligne 0–100.
- **Taux 0 = exonération** avec `tax_exemption_code` obligatoire :
  - `legal` → « Exonération légale »
  - `export` → « Exportation »
  - `special_regime` → « Régime particulier »
  - `other` → « Autre », avec `tax_exemption_reason` obligatoire (1–150 car.)
- Taux > 0 ⇒ code et motif NULL (rejet 422 sinon).
- PDF : libellé du code sur la ligne (+ précision pour « autre ») et
  `companies.tax_exemption_mention` en pied de page.
- Les règles fiscales exactes restent à vérifier avant commercialisation ; le
  modèle les supporte.

Remises : par ligne uniquement (0–100). Quantité > 0, prix ≥ 0.

### 7.2 Devis

- **Aucun numéro à la création.** Numéro `DEV-AAAA-0001` attribué à l'envoi
  (`mark-sent`), transaction + verrou de séquence.
- `issue_date` = date d'envoi ; `valid_until` = envoi + 30 jours par défaut.
- Statuts stockés : `draft`, `sent`, `accepted`, `refused`, `converted`.
  « Expiré » = affichage dérivé (`sent` et `valid_until < today`).
- Seul un brouillon est modifiable (lignes remplacées atomiquement) et
  supprimable logiquement.
- `client_reference` facultative, affichée sur le PDF et utilisée en recherche.
- Conversion : autorisée pour `sent`, `accepted` ou expiré (avertissement),
  refusée pour `refused` et `converted`. Transaction unique :
  **création d'une facture brouillon** (sans numéro), copie des lignes et de la
  référence client, statut `converted`, `invoices.quote_id` renseigné.
- **La facture brouillon est entièrement vérifiable et modifiable** (client,
  lignes, dates, référence) avant émission. Aucune émission automatique.
- Les instantanés de la facture ne sont figés qu'à l'émission.
- PDF disponible ; sans numéro, mention « BROUILLON — sans valeur ».

### 7.3 Factures

- Création en brouillon, sans numéro ; lignes et champs éditables.
- Émission (`issue`) :
  - valide client, lignes, échéance ≥ date d'émission ;
  - `issue_date` = **date du jour**, non modifiable, fuseau
    Africa/Ouagadougou ; **aucun antidatage** ;
  - attribue `FAC-AAAA-0001` (séquence `YEAR(issue_date)`, verrou ligne) ;
  - fige totaux, `client_snapshot`, `issuer_snapshot`, `issued_at` ;
  - statut `issued`, document immuable.
- `due_date` par défaut : `issue_date + payment_terms_days`.
- `client_reference` facultative, affichée sur le PDF.
- Annulation : uniquement si **aucun paiement** (`recorded` ou `voided`)
  n'existe. Motif obligatoire ; numéro conservé ; statut `cancelled` ; document
  exclu des totaux.
- Suppression physique interdite ; suppression logique d'un brouillon seulement.
- PDF : instantanés pour un document émis, mention « BROUILLON » pour un
  brouillon, filigrane « ANNULÉE » pour une facture annulée.

### 7.4 Paiements

- Paiements multiples et partiels autorisés.
- Refus (409) si : montant ≤ 0 ; facture non `issued` ; annulée ;
  `somme(recorded) + montant > total`.
- Enregistrement transactionnel avec `SELECT ... FOR UPDATE` sur la facture.
- Annulation (`voided`) motivée, auteur et date conservés ; solde recalculé.
- `paid_total = SUM(amount) WHERE status = 'recorded'`
- `balance_due = total − paid_total`

### 7.5 Statut d'affichage des factures

```
annulée                          -> cancelled
brouillon                        -> draft
payé (balance <= 0)              -> paid
0 < payé < total                 -> partial
payé = 0 et due_date >= today    -> pending
payé = 0 et due_date < today     -> overdue
partiel et due_date < today      -> overdue (montant restant affiché)
```

« Aujourd'hui » calculé dans `Africa/Ouagadougou` (UTC+0).

### 7.6 Relances (MVP manuel)

- Événement tracé : canal, date, message, auteur, statut.
- Création manuelle, planification, clôture ou annulation. **Aucun envoi.**
- Canaux : email (journalisé), téléphone, WhatsApp, SMS, courrier, autre.
- Client déduit de la facture.
- V1.1 : envoi réel et automatisation, sans changement de modèle.

### 7.7 Tableau de bord

- **CA encaissé** : paiements `recorded` sur la période.
- **CA facturé** : factures `issued` émises sur la période.
- **Impayé total** : soldes des factures `issued` non soldées.
- **En retard** : soldes des factures `issued` avec `due_date < today`.
- **Devis en attente** : devis `sent` non expirés.
- Filtres de période ; un seul graphique (encaissements sur 12 mois).

---

## 8. API REST

Base : `/api/v1`. JSON. Dates ISO 8601.

### 8.1 Conventions

- **Identifiants** : chaînes numériques (`"id": "42"`). Aucun `Number`, aucun
  `parseInt`. Les paramètres d'URL sont validés par expression régulière.
- **Montants** : nombres JSON entiers, bornés (≤ 999 999 999 999).
- Liste : `{ "data": [...], "meta": { "page", "limit", "total" } }`
- Unité : `{ "data": {...} }`
- Erreur : `{ "error": { "code", "message", "details?" } }`
- Codes : `VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401), `FORBIDDEN` (403),
  `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500).
- Pagination `page`, `limit` (max 100), tri en liste blanche.
- Aucun `company_id` en paramètre.

### 8.2 Routes

**Auth**

```
POST   /auth/register                       # renvoie recovery_code UNE FOIS
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me
POST   /auth/reset-password                 # email + code + nouveau mot de passe
PATCH  /auth/password                       # ancien mot de passe requis
POST   /auth/recovery-code/regenerate       # authentifié, mot de passe requis
```

Réponses d'authentification : jamais journalisées ni mises en cache.
`recovery_code` n'apparaît que dans les réponses de `register`,
`reset-password` et `recovery-code/regenerate`.

**Clients**

```
GET    /clients?search=&active=&page=
POST   /clients
GET    /clients/:id
PATCH  /clients/:id
DELETE /clients/:id
GET    /clients/:id/statement
```

**Produits**

```
GET    /products?search=&type=&active=&page=
POST   /products
GET    /products/:id
PATCH  /products/:id
DELETE /products/:id
```

**Devis**

```
GET    /quotes?status=&client_id=&reference=&from=&to=&page=
POST   /quotes
GET    /quotes/:id
PATCH  /quotes/:id               # brouillon uniquement
DELETE /quotes/:id               # brouillon uniquement
POST   /quotes/:id/mark-sent     # attribue le numéro
POST   /quotes/:id/status        # accepted | refused
POST   /quotes/:id/convert       # crée une facture brouillon éditable
GET    /quotes/:id/pdf
```

**Factures**

```
GET    /invoices?status=&payment_status=&client_id=&reference=&from=&to=&overdue=&page=
POST   /invoices                 # brouillon
GET    /invoices/:id
PATCH  /invoices/:id             # brouillon uniquement
DELETE /invoices/:id             # brouillon uniquement
POST   /invoices/:id/issue       # date du jour, numéro, immutabilité
POST   /invoices/:id/cancel      # interdit si paiement existant
GET    /invoices/:id/pdf
GET    /invoices/:id/payments
GET    /invoices/:id/reminders
```

**Paiements**

```
POST   /invoices/:id/payments
GET    /payments?from=&to=&method=&page=
POST   /payments/:id/void
```

**Relances**

```
GET    /reminders?status=&channel=&from=&to=&page=
POST   /reminders
PATCH  /reminders/:id
POST   /reminders/:id/complete
POST   /reminders/:id/cancel
```

**Tableau de bord**

```
GET    /dashboard/summary?from=&to=
GET    /dashboard/cashflow?months=12
GET    /dashboard/overdue?page=
```

**Paramètres**

```
GET    /company
PATCH  /company
POST   /company/logo            # PNG/JPEG, 2 Mo max
DELETE /company/logo
```

**Utilisateurs** : non exposés au MVP (V1.1) ; `requireRole` reste implémenté.

### 8.3 Permissions

MVP : seul `owner`. Matrice cible conservée pour la V1.1 :

| Action                        | owner | admin | member |
| ----------------------------- | ----- | ----- | ------ |
| Lecture métier                | oui   | oui   | oui    |
| Création/édition métier       | oui   | oui   | oui    |
| Annulation facture / paiement | oui   | oui   | non    |
| Paramètres entreprise         | oui   | oui   | non    |
| Gestion utilisateurs          | oui   | non   | non    |

Contrôle serveur obligatoire.

---

## 9. Sécurité

### 9.1 Authentification, session et code de récupération

- `bcrypt` coût 12 ; mot de passe ≥ 8 caractères ; liste noire courte.
- Access JWT 15 min (`rp_at`, httpOnly, Secure en prod, SameSite=Lax, Path=/).
- Refresh 30 jours (`rp_rt`, httpOnly, SameSite=Lax, Path=/auth), haché
  SHA-256, rotation à chaque refresh, réutilisation → révocation.
- Claims : `sub`, `cid`, `role`, `jti`, **en chaînes**. La base reste la
  référence pour `is_active` et les révocations.
- Aucun token lisible en JS. `GET /auth/me` restaure la session.
- Axios : refresh unique simultané (single-flight), rejeu, sinon déconnexion.

Code de récupération :

- Généré à l'inscription : 20 caractères Crockford Base32 (100 bits
  d'entropie), affiché par groupes de 5 (`XXXXX-XXXXX-XXXXX-XXXXX`).
- **Affiché une seule fois** dans la réponse HTTPS ; l'interface propose copie,
  téléchargement `.txt` et impression, avec confirmation explicite.
- Stocké uniquement sous forme d'empreinte SHA-256 (`recovery_codes.code_hash`).
  Jamais journalisé, jamais renvoyé ultérieurement, jamais récupérable par le
  support.
- Normalisation avant hachage : majuscules, séparateurs et espaces supprimés.
- Un seul code actif ; régénération (authentifié + mot de passe actuel) révoque
  l'ancien et affiche le nouveau une fois.
- Réinitialisation : `email` + code + nouveau mot de passe ; comparaison en
  temps constant ; message d'erreur générique ; rate limit dédié
  (5 tentatives / 15 min par IP+email) ; toutes les sessions révoquées ; code
  marqué utilisé ; nouveau code généré et affiché une fois.
- Aucun email n'est envoyé au MVP. L'interface `mailer` reste vide et prête
  pour la V1.1.

### 9.2 CSRF et CORS

- Cookie `csrf_token` non httpOnly + header `X-CSRF-Token` sur les écritures,
  comparaison en temps constant.
- CORS restrictif, `credentials: true`, jamais `*`.
- Même origine recommandée ; sinon SameSite=None + Secure + CORS explicite.

### 9.3 Registre des risques

| Risque                           | Impact   | Mitigation                                                                               |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| Injection SQL                    | Critique | Requêtes préparées, listes blanches                                                      |
| IDOR / fuite inter-entreprises   | Critique | `company_id` JWT, FK composites, tests                                                   |
| XSS                              | Élevé    | Échappement React, CSP, cookies httpOnly                                                 |
| Vol de token                     | Élevé    | httpOnly, Secure, access court, refresh rotatif                                          |
| CSRF                             | Élevé    | SameSite + double-submit + CORS strict                                                   |
| Brute force login                | Élevé    | Rate limit 5/15 min, délai progressif, message générique                                 |
| Brute force code de récupération | Élevé    | 100 bits d'entropie, rate limit dédié, comparaison constante                             |
| Perte du code de récupération    | Élevé    | Avertissement fort, téléchargement, régénération authentifiée, procédure documentée §9.5 |
| Code de récupération journalisé  | Critique | Redaction des logs, tests dédiés                                                         |
| Énumération de comptes           | Moyen    | Réponses identiques                                                                      |
| Mass assignment                  | Moyen    | Validation Zod stricte                                                                   |
| Upload malveillant               | Moyen    | PNG/JPEG, MIME réel, 2 Mo, nom aléatoire, `nosniff`                                      |
| Fuite d'erreurs                  | Moyen    | Handler central, pas de stack en prod                                                    |
| Concurrence paiements/numéros    | Élevé    | Transactions, verrous, uniques, retry contrôlé                                           |
| Secrets dans Git                 | Critique | `.env` ignoré, `.env.example`, validation d'environnement                                |
| Dépendance payante introduite    | Moyen    | Revue systématique (licence + carte bancaire)                                            |
| Perte de données                 | Critique | Sauvegardes locales base + uploads, test de restauration                                 |
| Seed en production               | Critique | Double garde `NODE_ENV` + `ALLOW_SEED`                                                   |

### 9.4 Configuration serveur

- `helmet` (HSTS en prod, nosniff, frame-ancestors 'none').
- `express-rate-limit` global + limiteur auth + limiteur reset.
- `trust proxy` derrière le reverse proxy.
- Body limit 1 Mo (2 Mo pour le logo), timeouts, arrêt propre.
- Logs Pino structurés, redaction des champs sensibles (`password`,
  `recovery_code`, tokens, cookies).
- MySQL : utilisateur applicatif restreint à la base RelancePro.

### 9.5 Procédure de récupération de compte (documentée)

1. À l'inscription, l'utilisateur reçoit le code une seule fois. Il doit le
   conserver hors de l'application (gestionnaire de mots de passe, impression).
2. Mot de passe oublié : page « Réinitialiser », saisie email + code + nouveau
   mot de passe. En cas de succès, un nouveau code est affiché et toutes les
   sessions sont fermées.
3. Code perdu mais session active : « Paramètres → Sécurité → Régénérer le code
   de récupération », avec mot de passe actuel. L'ancien code est révoqué.
4. Code perdu et session fermée : **aucune récupération en libre-service**.
   Le support ne peut pas lire le code (empreinte uniquement). Dernier recours :
   intervention manuelle de l'opérateur sur la base après vérification
   d'identité, tracée dans `audit_logs`. Procédure réservée, hors interface.
5. Prévention : confirmation obligatoire à l'affichage, téléchargement proposé,
   rappel dans les paramètres. La perte du code est le risque accepté de la
   contrainte zéro budget.

---

## 10. Frontend et direction artistique

### 10.1 Architecture

- Vite + React 19, React Router 7 (`createBrowserRouter`).
- Routes protégées, layout authentifié, chargement différé par module.
- `AuthContext` : utilisateur, login/logout, refresh silencieux.
- Identifiants manipulés comme chaînes de bout en bout (types, routes, clés de
  listes). Aucun calcul numérique sur un identifiant.
- Données : hooks par feature sur Axios, états loading/error/empty.
  Pas de store global ni de cache tiers au MVP.
- Formulaires contrôlés, validation Zod partagée côté client (schémas
  dupliqués ou exposés), backend autoritaire. React Hook Form non adopté.
- Erreurs API lisibles et actionnables.

### 10.2 Design system

| Rôle                        | Valeur                      |
| --------------------------- | --------------------------- |
| Bleu nuit (primaire)        | `#0B1F3A` (hover `#132F52`) |
| Bleu clair (secondaire)     | `#E8F1FB`, accent `#2F6FED` |
| Fond application            | `#F5F7FA`                   |
| Surface                     | `#FFFFFF`                   |
| Texte principal             | `#0F172A`                   |
| Texte secondaire            | `#64748B`                   |
| Bordure                     | `#E2E8F0`                   |
| Succès / payé               | `#16A34A`                   |
| Avertissement / exonération | `#D97706` (fond `#FEF3C7`)  |
| Danger / retard             | `#DC2626` (fond `#FEE2E2`)  |

Inter auto-hébergée (SIL OFL), chiffres tabulaires. Desktop : sidebar 248 px,
topbar 64 px, contenu max 1280 px. Tablette : sidebar réduite. Mobile : topbar

- tiroir, tableaux en cartes ou défilement horizontal avec première colonne
  figée.

Composants : `StatCard`, `DataTable`, `StatusBadge`, `Amount`
(`1 250 000 FCFA`), `LineItemsEditor` (TVA + code/motif d'exonération),
`RecoveryCodeModal` (copie/téléchargement/confirmation), `ConfirmDialog`,
`Toast`, `Skeleton`.

Accessibilité : contraste AA, focus visible, labels, clavier, cibles ≥ 44 px.
Écran d'inscription : le code de récupération est présenté comme critique, avec
avertissement explicite « il ne sera plus jamais affiché ».

---

## 11. PDF, emails et fichiers

### 11.1 PDF

- PDFKit, streamé (`Content-Disposition: attachment`).
- Gabarit commun devis/facture.
- Contenu : logo, identité entreprise, numéro, dates, client, référence client
  externe si renseignée, lignes, remises, TVA, exonérations (libellé + motif
  pour « autre »), totaux, solde dû, coordonnées de paiement, mentions.
- Données issues des instantanés pour un document émis ; brouillon marqué
  « BROUILLON », facture annulée marquée « ANNULÉE ».
- Police embarquée (accents), FCFA avec espaces insécables.
- Accès authentifié, aucune donnée inter-entreprises.

### 11.2 Emails

- **Aucun email au MVP.** Pas de SMTP, pas de fournisseur, aucun coût.
- Interface `mailer` définie mais non implémentée ; Nodemailer est validé pour
  la V1.1 et n'est pas installé tant qu'il n'est pas utilisé.
- Évolution V1.1 : reset par email, relances réelles, vérification d'email, avec
  SPF/DKIM et deliverability à préparer.

### 11.3 Fichiers

- Logo : PNG/JPEG, 2 Mo max, MIME réel, nom aléatoire.
- Abstraction `storage` (`put`, `get`, `delete`, `url`) avec implémentation
  locale (`UPLOAD_DIR`). Aucun S3 ni service payant.
- Fichiers servis avec `nosniff`, jamais exécutés, hors racine statique.
- Sauvegarde des uploads incluse dans la stratégie de backup.
- L'adaptateur objet pourra être ajouté en V1.1 sans modifier les services.

---

## 12. Tests

| Niveau           | Outils                          | Couverture minimale                                                         |
| ---------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Unitaire backend | Vitest                          | argent, arrondis, TVA/exonérations, statuts, dates, normalisation des codes |
| Intégration API  | Vitest + Supertest, base dédiée | auth, code de récupération, CRUD, émission, conversion, paiements, PDF      |
| Isolation        | Tests dédiés                    | aucune lecture/écriture inter-entreprises, FK composites refusées           |
| Concurrence      | Tests ciblés                    | paiements simultanés, numéros simultanés, double conversion                 |
| Immutabilité     | Tests ciblés                    | PATCH refusé après émission, numéro/date inchangés, snapshots               |
| Sécurité         | Tests ciblés                    | code jamais renvoyé après création, jamais loggé, rotation, rate limit      |
| Identifiants     | Tests ciblés                    | sérialisation en chaînes, absence de conversion `Number`, tri SQL correct   |
| Suppression      | Tests ciblés                    | soft delete, refus si références, historique intact                         |
| Frontend         | Vitest + Testing Library        | formulaires, TVA, statuts, formatage, IDs chaînes                           |
| E2E (V1.1)       | Playwright                      | inscription → devis → facture → paiement                                    |

Bloquants pour la production : isolation, calculs financiers, numérotation,
immutabilité, sécurité du code de récupération. Aucune fonctionnalité déclarée
terminée sans test exécuté.

---

## 13. Déploiement

- **Neutre vis-à-vis de l'hébergeur**, sous contrainte de gratuité.
  Exigences : Node 24 LTS, MySQL 8, HTTPS, reverse proxy, disque persistant
  pour les uploads, sauvegardes locales.
- Cibles acceptables : auto-hébergement existant, VPS déjà disponible, ou offre
  gratuite sans carte bancaire avec disque persistant. **Aucun service payant.**
- Référence : Nginx (statique + proxy `/api`), Node via systemd/PM2, MySQL
  local, Let's Encrypt, pare-feu.
- Même origine recommandée. Sinon : SameSite=None + Secure + CORS explicite.
- Variables : `NODE_ENV`, `PORT`, `APP_ORIGIN`, `DB_*`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE`, `UPLOAD_DIR`,
  `MAX_UPLOAD_MB`, `ALLOW_SEED`. `SMTP_*` sera ajouté en V1.1.
  Validation au démarrage, échec si absente.
- Base : utilisateur dédié, accès restreint, migrations explicites (jamais au
  boot).
- Sauvegarde quotidienne locale chiffrée (base + uploads), rétention 30 jours,
  test de restauration.
- CI gratuite (GitHub Actions free tier) : lint, tests, audit.
- Seeds : uniquement si `NODE_ENV ∈ {development,test}` **et**
  `ALLOW_SEED=true` ; refus inconditionnel en production.

Contraintes des offres gratuites à vérifier à l'Étape 5 : disque persistant,
mise en veille, quotas de base, sauvegardes, expiration. Si aucune offre
gratuite ne convient, l'auto-hébergement reste la solution.

---

## 14. Dépendances (validées, budget zéro)

### Frontend

| Paquet                          | Licence | Usage                   |
| ------------------------------- | ------- | ----------------------- |
| react, react-dom                | MIT     | UI                      |
| react-router-dom                | MIT     | Routage                 |
| axios                           | MIT     | HTTP                    |
| tailwindcss + @tailwindcss/vite | MIT     | Styles                  |
| lucide-react                    | ISC     | Icônes                  |
| clsx                            | MIT     | Classes conditionnelles |
| date-fns                        | MIT     | Dates (ou Intl natif)   |

Non adoptés par défaut : `react-hook-form`, `recharts` (justification écrite
requise).

### Backend

| Paquet             | Licence | Usage                          |
| ------------------ | ------- | ------------------------------ |
| express            | MIT     | HTTP                           |
| mysql2             | MIT     | Pool MySQL, requêtes préparées |
| jsonwebtoken       | MIT     | JWT                            |
| bcrypt             | MIT     | Mots de passe                  |
| cookie-parser      | MIT     | Cookies                        |
| cors               | MIT     | CORS restrictif                |
| helmet             | MIT     | En-têtes                       |
| express-rate-limit | MIT     | Limitation de débit            |
| zod                | MIT     | Validation                     |
| pdfkit             | MIT     | PDF                            |
| dotenv             | BSD-2   | Environnement                  |
| compression        | MIT     | Compression                    |
| pino + pino-http   | MIT     | Logs                           |

Développement : `nodemon`, `vitest`, `supertest`, `eslint`, `prettier`.
Nodemailer (MIT) : validé pour la V1.1, non installé au MVP.
Exclus : ORM, `body-parser`, `uuid`, `moment`, librairie UI lourde, tout service
payant.

---

## 15. Risques projet et vigilances

1. **Perte du code de récupération** : sans email, le compte n'est pas
   récupérable en libre-service. Risque accepté, atténué par l'affichage unique
   accompagné, le téléchargement et la régénération authentifiée.
2. **Règles fiscales TVA** : catégories et mentions à vérifier avant
   commercialisation ; le modèle les supporte.
3. **Numérotation** : brouillons sans numéro, annulations conservant leur
   numéro, donc trous visibles. À expliquer dans l'interface.
4. **Fuseau horaire** : Africa/Ouagadougou (UTC+0), stockage UTC, calcul du
   retard centralisé.
5. **Snapshots JSON** : forme documentée et rétrocompatible.
6. **Identifiants en chaînes** : toute conversion implicite en `Number` est un
   bug ; tests et revue de code dédiés.
7. **Hébergement gratuit** : disque persistant et sauvegardes à vérifier à
   l'Étape 5 ; l'auto-hébergement reste possible.
8. **Périmètre** : stock, avoirs, paiement en ligne, emails et PO/escompte hors
   MVP.
9. **Conservation légale** : durée à valider.
10. **Mobile** : éditeur de lignes à maquetter avant développement.
11. **Multi-utilisateurs futur** : email global unique = un utilisateur, une
    entreprise ; limitation assumée.

---

## 16. Plan de développement (un module par validation)

| Étape | Livrable                                                              | Critère de validation                                                            |
| ----- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2     | Monorepo, env, MySQL, health check, lint, scripts, storage local      | Front et back démarrent, connexion DB vérifiée                                   |
| 3.1   | Auth, inscription, code de récupération, reset, layout, design system | Inscription, code affiché une fois, reset, rotation, login/logout/refresh testés |
| 3.2   | Clients                                                               | CRUD, recherche, isolation, suppression logique                                  |
| 3.3   | Produits & services                                                   | CRUD, TVA par défaut, isolation                                                  |
| 3.4   | Devis + PDF + TVA/exonération                                         | Calculs, codes d'exonération, numérotation à l'envoi                             |
| 3.5   | Factures + numérotation + PDF + snapshots                             | Émission, date figée, immutabilité, annulation, concurrence                      |
| 3.6   | Paiements                                                             | Partiels, trop-perçu refusé, annulation, soldes                                  |
| 3.7   | Relances manuelles                                                    | Historique, planification, statuts                                               |
| 3.8   | Tableau de bord                                                       | Indicateurs §7.7                                                                 |
| 3.9   | Paramètres + logo                                                     | Identité dans les PDF, régénération du code                                      |
| 4     | Tests et sécurité                                                     | Matrice §12 exécutée                                                             |
| 5     | Déploiement gratuit                                                   | Cible sans coût, sauvegardes, doc technique                                      |

---

## 17. Décisions validées

### 17.1 Décisions initiales

| #   | Décision                                                         | Traduction                                      |
| --- | ---------------------------------------------------------------- | ----------------------------------------------- |
| 1   | TVA 18 % configurable, par ligne, exonération                    | `default_tax_rate`, `tax_rate`, code/motif      |
| 2   | Propriétaire unique au MVP                                       | `users.role` conservé, invitations V1.1         |
| 3   | Relances manuelles                                               | Aucun envoi, statuts et journal                 |
| 4   | Numérotation `FAC/DEV-AAAA-0001`, annuelle, préfixes modifiables | `document_sequences`, numéro à l'envoi/émission |
| 5   | Stock hors périmètre                                             | Aucune table de stock                           |
| 6   | Annulation sans paiement, avoirs V1.1                            | Contrôle serveur, motif, numéro conservé        |
| 7   | Déploiement compatible VPS                                       | §13 neutre                                      |
| 8   | Dépendances validées                                             | §14                                             |
| 9   | Données de démo dev/test                                         | Double garde, refus en production               |
| 10  | Logo dès le MVP                                                  | Upload + `storage` + PDF                        |

### 17.2 Décisions finales

| #   | Décision                                                | Traduction                                                                                            |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 11  | Aucun SMTP ; code de récupération unique                | `recovery_codes`, affichage unique, empreinte SHA-256, reset par code, régénération, `mailer` inactif |
| 12  | Date d'émission = jour, non modifiable, sans antidatage | `issue_date`/`issued_at` figés à l'émission, conservés                                                |
| 13  | Conversion = facture brouillon éditable                 | Copie depuis devis, édition avant `issue`, jamais d'émission automatique                              |
| 14  | Stockage local + abstraction                            | `storage` local, aucun S3, adaptateur futur                                                           |
| 15  | Identifiants `BIGINT` en chaînes                        | API/JS en chaînes, aucune conversion `Number`                                                         |
| 16  | Récupération de compte documentée                       | §9.5, procédure utilisateur et support                                                                |
| 17  | Exonérations codifiées                                  | `legal`, `export`, `special_regime`, `other` + motif si autre                                         |
| 18  | Référence client externe facultative                    | `client_reference` sur devis/factures, PDF et recherche ; PO/escompte reportés                        |
| 19  | Budget zéro                                             | §2.3, revue systématique des licences et coûts                                                        |

---

## 18. État des points ouverts et points bloquants

### 18.1 Points résolus

| Point                      | Résolution                                                             |
| -------------------------- | ---------------------------------------------------------------------- |
| Reset sans SMTP            | Code de récupération unique, empreinte, affichage unique, régénération |
| Date d'émission            | Jour, immuable, historisée                                             |
| Conversion devis → facture | Brouillon éditable, émission manuelle                                  |
| Stockage                   | Disque local, abstraction `storage`                                    |
| Identifiants `BIGINT`      | Chaînes de bout en bout                                                |
| Récupération de compte     | Procédure §9.5                                                         |
| Motifs d'exonération       | Liste fermée + précision pour « autre »                                |
| Champs supplémentaires     | `client_reference` ; PO et escompte reportés                           |

### 18.2 Confirmation

**Aucun point bloquant technique ne subsiste pour démarrer l'Étape 2.**
Toutes les décisions nécessaires au développement sont prises et cohérentes.

Vigilances non bloquantes, à traiter aux étapes indiquées :

1. **Conformité fiscale** des exonérations et mentions : à vérifier avant la
   commercialisation (Étape 4/5), pas avant le développement.
2. **Hébergement gratuit** avec disque persistant : à sélectionner à l'Étape 5 ;
   l'auto-hébergement reste une solution de repli.
3. **Perte du code de récupération** : risque produit accepté, à atténuer par
   l'UX et la documentation ; aucune solution gratuite alternative n'existe sans
   email.
4. **Sauvegardes en environnement gratuit** : à valider avec la cible retenue.

---

## 19. Validation attendue

Merci de confirmer explicitement cette version 1.2 comme référence de
développement. Aucune ligne de code ne sera écrite avant ce feu vert. Les
éventuelles remarques seront reportées dans ce document avant l'Étape 2.
