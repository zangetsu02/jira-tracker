# Jira Tracker - Microservice Analysis Tool

## Overview

Tool per analizzare microservizi e tracciare la copertura degli use case rispetto a documenti di requisiti (PDF) e codice legacy (ASPX). Genera automaticamente issue JIRA per le discrepanze trovate.

## Tech Stack

- **Framework**: Nuxt 4.1.2 (Vue 3)
- **UI**: Nuxt UI 4
- **Database**: PostgreSQL 15 + Drizzle ORM
- **Auth**: Better Auth
- **AI**: Claude CLI (Anthropic SDK)
- **Package Manager**: pnpm

## Project Structure

```
├── app/                      # Frontend Nuxt
│   ├── pages/
│   │   ├── index.vue         # Dashboard con stats microservizi
│   │   ├── settings.vue      # Config directory e Jira
│   │   ├── sign-in.vue       # Login
│   │   ├── sign-up.vue       # Registrazione
│   │   ├── microservice/[name].vue  # Dettaglio microservizio
│   │   └── analysis/[name].vue      # Risultati analisi
│   ├── composables/
│   │   ├── useAuth.ts        # Gestione autenticazione
│   │   └── useAnalysisStatus.ts
│   ├── layouts/
│   │   ├── default.vue       # Layout principale
│   │   └── login.vue         # Layout login
│   └── middleware/
│       └── auth.global.ts    # Protezione route
│
├── server/                   # Backend Nitro
│   ├── api/
│   │   ├── microservices/    # CRUD microservizi
│   │   │   ├── index.get.ts  # Lista microservizi
│   │   │   ├── [name].get.ts # Dettaglio singolo
│   │   │   └── [name]/
│   │   │       ├── analyze.post.ts        # Avvia analisi
│   │   │       ├── analyze-stream.post.ts # Analisi con streaming
│   │   │       ├── pdf.get.ts             # Scarica PDF
│   │   │       └── pdf.post.ts            # Upload PDF
│   │   ├── analysis/         # Risultati analisi
│   │   │   ├── [msName].get.ts
│   │   │   ├── history.get.ts
│   │   │   └── [id]/jira.patch.ts
│   │   ├── jira/             # Integrazione Jira
│   │   │   ├── config.get.ts
│   │   │   ├── config.post.ts
│   │   │   ├── issue.post.ts
│   │   │   ├── issue-types.get.ts
│   │   │   ├── issues/[label].get.ts
│   │   │   ├── test.post.ts
│   │   │   └── users.get.ts
│   │   ├── settings/         # Impostazioni app
│   │   │   ├── index.get.ts
│   │   │   └── index.post.ts
│   │   ├── usecases/[msName].get.ts
│   │   └── auth/[...all].ts  # Better Auth handler
│   │
│   ├── database/
│   │   ├── schema/           # Drizzle schema
│   │   │   ├── auth.ts       # User, session, account, verification
│   │   │   ├── microservices.ts
│   │   │   ├── usecases.ts
│   │   │   ├── analysis.ts
│   │   │   ├── jira.ts
│   │   │   └── settings.ts
│   │   ├── migrations/       # SQL migrations
│   │   └── drizzle.config.ts
│   │
│   ├── utils/
│   │   ├── scanner.ts        # Scan directory microservizi
│   │   ├── claude.ts         # Esecuzione Claude CLI
│   │   ├── analysis.ts       # Logica analisi e parsing
│   │   ├── jira.ts           # Client Jira REST API
│   │   ├── db.ts             # Connessione database
│   │   ├── auth.ts           # Config Better Auth
│   │   └── runtimeConfig.ts  # Env variables
│   │
│   ├── prompts/
│   │   └── analysis.ts       # Template prompt per Claude
│   │
│   └── routes/
│       └── _ws.ts            # WebSocket per streaming
│
├── shared/
│   └── utils/
│       └── types.ts          # Types condivisi
│
├── docker-compose.yml        # PostgreSQL container
├── .env                      # Configurazione
└── .env.example
```

## Database Schema

### Tables

- **user**: Utenti (Better Auth)
- **session**: Sessioni (Better Auth)
- **account**: Account OAuth (Better Auth)
- **verification**: Token verifica email
- **microservices**: Microservizi tracciati (name, path, pdfPath, legacyPath, lastAnalysis)
- **usecases**: Use case estratti dai PDF
- **analysis_results**: Risultati analisi (status, confidence, evidence, jiraIssueKey)
- **jira_config**: Configurazione Jira per utente (url, username, password, defaultProject)
- **app_settings**: Settings app per utente (microservicesDirectory, microservicesPattern)

## Key Flows

### 1. Scansione Microservizi

```
Settings -> POST /api/settings (salva directory)
         -> GET /api/microservices (scansiona con pattern sil-ms-*)
```

Il pattern default `sil-ms-*` cerca directory che iniziano con "sil-ms-".

### 2. Analisi Microservizio

```
1. Upload PDF requisiti -> POST /api/microservices/[name]/pdf
2. Avvia analisi -> POST /api/microservices/[name]/analyze-stream
3. Claude CLI analizza:
   - Codice microservizio
   - PDF requisiti (opzionale)
   - Codice legacy ASPX in docs/aspx (opzionale)
4. Output JSON con issues
5. Salva in analysis_results
```

### 3. Creazione Issue Jira

```
1. Configura Jira -> POST /api/jira/config
2. Test connessione -> POST /api/jira/test
3. Crea issue da analisi -> POST /api/jira/issue
4. Collega issue -> PATCH /api/analysis/[id]/jira
```

## Environment Variables

```bash
# Database
NUXT_DATABASE_URL=postgres://user:password@localhost:5432/jira_checker

# Auth
NUXT_BETTER_AUTH_SECRET=your-secret-key

# App
NUXT_APP_URL=http://localhost:3000
NUXT_APP_NAME=Jira Tracker
NODE_ENV=development

# Email (opzionale)
NUXT_RESEND_API_KEY=re_xxx

# Microservizi (opzionale, configurabile da UI)
NUXT_MICROSERVICES_DIR=/path/to/microservices
```

## Commands

```bash
# Development
pnpm dev

# Database
pnpm db:generate    # Genera migrations
pnpm db:migrate     # Applica migrations

# Auth schema
pnpm auth:schema    # Genera schema Better Auth

# Build
pnpm build
pnpm preview
```

## Issue Types

L'analisi Claude genera issue con questi tipi:
- `missing_implementation`: Funzionalita assente
- `partial_implementation`: Funzionalita incompleta
- `legacy_mismatch`: Comportamento diverso dal legacy
- `behavior_difference`: Differenza rispetto ai requisiti
- `missing_test`: Funzionalita non testata
- `security_concern`: Problema di sicurezza
- `performance_concern`: Problema di performance
- `documentation_gap`: Documentazione mancante

## Analysis Status

- `implemented`: Use case completamente implementato
- `partial`: Implementazione parziale
- `missing`: Non implementato
- `unclear`: Non determinabile

## Notes

- Il pattern microservizi default e` `sil-ms-*`
- Il codice legacy viene cercato in: `docs/aspx`, `docs/legacy`, `legacy`, `aspx`
- Claude CLI deve essere installato e configurato nel sistema
- Le credenziali Jira sono salvate per utente nel database
