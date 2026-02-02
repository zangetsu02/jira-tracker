# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tool per analizzare microservizi e tracciare la copertura degli use case rispetto a documenti di requisiti (PDF) e codice legacy (ASPX). Genera automaticamente issue JIRA per le discrepanze trovate.

## Tech Stack

- **Framework**: Nuxt 4.1.2 (Vue 3)
- **UI**: Nuxt UI 4
- **Database**: PostgreSQL 15 + Drizzle ORM
- **Auth**: Better Auth
- **AI**: Claude CLI (Anthropic SDK)
- **Package Manager**: pnpm

## Commands

```bash
# Development
pnpm dev                # Start dev server at localhost:3000
pnpm lint               # Run ESLint

# Database
docker compose up       # Start PostgreSQL container
pnpm db:generate        # Generate Drizzle migrations
pnpm db:migrate         # Apply migrations to database

# Better Auth schema (run after modifying auth config)
pnpm auth:schema        # Regenerate auth schema from server/utils/auth.ts

# Build
pnpm build
pnpm preview
```

## Architecture

### Frontend (app/)
- **pages/**: Nuxt pages with file-based routing
- **composables/**: Vue composables (`useAuth.ts`, `useAnalysisStatus.ts`)
- **middleware/auth.global.ts**: Route protection

### Backend (server/)
- **api/**: Nitro API endpoints following `[resource]/[action].[method].ts` convention
- **database/schema/**: Drizzle ORM table definitions
- **utils/**: Core utilities (scanner, claude CLI integration, jira client, db connection)
- **prompts/analysis.ts**: Claude prompt templates for microservice analysis
- **routes/_ws.ts**: WebSocket handler for streaming analysis results

### Shared
- **shared/utils/types.ts**: TypeScript types shared between frontend and backend

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

Required in `.env` (see `.env.example`):
- `NUXT_DATABASE_URL`: PostgreSQL connection string
- `NUXT_BETTER_AUTH_SECRET`: Auth secret key
- `NUXT_APP_URL`: App URL (default: http://localhost:3000)

Optional:
- `NUXT_RESEND_API_KEY`: For email verification
- `NUXT_MICROSERVICES_DIR`: Default microservices directory (configurable via UI)

## Code Style

ESLint with Nuxt config. Key rules:
- No trailing commas (`commaDangle: 'never'`)
- 1TBS brace style

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

## Important Notes

- Default microservices pattern: `sil-ms-*` (directories starting with "sil-ms-")
- Legacy code search paths: `docs/aspx`, `docs/legacy`, `legacy`, `aspx`
- Claude CLI must be installed and configured on the system
- Jira credentials are stored per-user in the database
- WebSocket is enabled in Nitro for streaming analysis results
