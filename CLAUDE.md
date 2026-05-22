# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fastnote is a monorepo note-taking application with an integrated frontend-backend architecture. The frontend is built with Vue 3 + Ionic + Tiptap, and the backend is a PocketBase Go host that embeds the frontend static assets into a single binary for deployment.

## Repository Structure

- `fastnote/` - Frontend Vue 3 application following Feature-Sliced Design (FSD) architecture
- `backend/` - PocketBase Go host with minimal business logic
- `scripts/` - Build and development orchestration scripts (Node.js)
- `docs/` - Chinese documentation for architecture, features, and development
- `build/` - Build output directory (gitignored)

## Development Commands

### Setup
```bash
# Install frontend dependencies
npm run install:frontend

# Tidy backend Go modules
npm run tidy:backend
```

### Development
```bash
# Run both frontend and backend concurrently
npm run dev

# Run frontend only (port 8888)
npm run dev:frontend

# Run backend only (port 8090)
npm run dev:backend
```

### Testing
```bash
# Run all unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run P0 sync integrity test suite (critical path)
npm run test:p0:sync-integrity

# Run AI agent tests
npm run test:agent:unit
npm run test:agent:integration
npm run test:agent:p0
```

### Linting
```bash
npm run lint
```

### Building
```bash
# Build both frontend and backend
npm run build

# Build frontend only
npm run build:frontend

# Build backend only (includes frontend asset sync)
npm run build:backend

# Sync frontend assets to backend embed directory
npm run sync:web-assets
```

### Release
```bash
# Build all platform releases (darwin, linux, windows for amd64/arm64)
npm run release

# Build for current platform only
npm run release:local

# Build specific target
npm run release -- --target=linux-amd64 --version=v1.0.0

# List supported targets
npm run release -- --list-targets
```

## Architecture

### Frontend (FSD Layers)

The frontend follows Feature-Sliced Design with strict dependency rules:

- `app/` - Application initialization, routing, global providers
- `processes/` - Cross-feature orchestration (session, sync, navigation, public notes)
- `pages/` - Route-level page components
- `widgets/` - Composite UI components
- `features/` - User actions and use cases (note-detail-editor, ai-chat, global-search, etc.)
- `entities/` - Domain entities and business rules
- `shared/` - Reusable utilities, UI components, API clients, storage adapters

**Dependency direction**: `app → processes → pages/widgets/features → entities → shared`

Key architectural patterns:
- **Offline-first**: Uses Dexie (IndexedDB) for local storage with PocketBase sync
- **Realtime sync**: PocketBase realtime subscriptions for multi-device sync
- **AI integration**: Native tool calling for AI chat features (see `features/ai-chat/`)

### Backend (PocketBase Host)

The backend is intentionally minimal:
- `main.go` - PocketBase initialization and plugin registration
- `internal/server/bootstrap/` - Static asset serving (embeds `fastnote/dist`)
- `internal/server/hooks/` - Reserved for PocketBase event hooks
- `migrations/` - Database schema migrations

**Static asset resolution order**:
1. `FASTNOTE_WEB_DIST` environment variable
2. `./pb_public/` in working directory
3. `../fastnote/dist` (development)
4. Embedded assets in binary (production)

### Build System

- `scripts/dev.mjs` - Concurrent frontend + backend development server
- `scripts/release.mjs` - Cross-platform release builder with Go cross-compilation
- `scripts/sync-web-assets.mjs` - Copies `fastnote/dist` to `backend/internal/server/bootstrap/pb_public`
- `scripts/go-backend.mjs` - Go command wrapper with cache management

## Testing Strategy

### Unit Tests (Vitest)
Located in `fastnote/tests/unit/` and `fastnote/tests/integration/`
- Test stores, hooks, and feature logic
- Use `jsdom` environment
- Setup file: `fastnote/tests/setup/vitest.setup.ts`

### E2E Tests (Cypress)
Located in `fastnote/tests/e2e/`
- Test critical user flows
- Public note access scenarios in `tests/e2e/public/`

### P0 Test Suites
Critical path tests that must pass before deployment:
- `test:p0:sync-integrity` - Data sync correctness
- `test:p0:unit` - Core unit tests
- `test:p0:e2e` - Critical E2E flows

## Key Technical Details

### Frontend Configuration
- **Dev server**: Port 8888 (configurable via `fastnote/vite.config.ts`)
- **API proxy**: Proxies `/api`, `/e`, `/d` to backend (default: `http://127.0.0.1:8090`)
- **HTTPS mode**: Set `VITE_HTTPS=true` in `fastnote/.env`
- **Path alias**: `@/` maps to `fastnote/src/`

### Backend Configuration
- **Default port**: 8090 (PocketBase default)
- **Data directory**: `backend/pb_data/` (SQLite database, uploads, logs)
- **Go version**: 1.25.0 (see `backend/go.mod`)
- **PocketBase version**: 0.37.2

### AI Chat Features
- Located in `fastnote/src/features/ai-chat/`
- Uses native tool calling (migrated from JSON envelope pattern)
- Intent parsing for note operations (rewrite, search, etc.)
- Token counting with `js-tiktoken`

### Sync Architecture
- **Process**: `fastnote/src/processes/sync-notes/`
- **Strategy**: Offline-first with eventual consistency
- **Conflict resolution**: Last-write-wins with user scope isolation
- **Retry logic**: Exponential backoff for failed syncs

## Development Workflow

### Adding a New Feature
1. Create feature module in `fastnote/src/features/<feature-name>/`
2. Export public API via `index.ts`
3. Add tests in `fastnote/tests/unit/features/<feature-name>/`
4. Import and use in pages/widgets as needed

### Modifying Backend Schema
1. Create migration in `backend/migrations/`
2. Follow PocketBase migration conventions
3. Test with `go run . serve` in `backend/`

### Running Single Tests
```bash
# Unit test
cd fastnote && npm run test:unit -- tests/unit/stores/notes-delete-subtree.spec.ts

# E2E test
cd fastnote && npm run test:e2e -- --spec tests/e2e/public/public-home-smoke.cy.ts
```

## CI/CD

GitHub Actions workflow: `.github/workflows/p0-sync-integrity.yml`
- Runs on push to `main` or manual trigger
- Validates frontend with P0 sync integrity suite
- Builds and deploys to dev environment via SSH
- Uses Node.js 24 and Go version from `backend/go.mod`

## Deployment

Release packages include:
- Binary: `fastnote` or `fastnote.exe`
- Data directory: `pb_data/` (must persist across upgrades)
- README: Deployment instructions

**Important**: Always run the binary from the release directory to ensure `pb_data/` is in the correct location.

## Common Patterns

### PocketBase Client Usage
```typescript
import { pb } from '@/shared/api/pocketbase/client'
// Client is pre-configured and ready to use
```

### Local Storage (Dexie)
```typescript
import { db } from '@/shared/lib/storage/dexie'
// Access IndexedDB tables: db.notes, db.folders, etc.
```

### Routing
- Router defined in `fastnote/src/app/router/`
- Route guards in `processes/navigation/`
- Public note initialization in `processes/public-notes/`

## Notes for AI Assistants

- The project uses Chinese comments and documentation in `docs/`
- Frontend follows strict FSD layer boundaries - respect dependency rules
- Backend should remain minimal - avoid adding business logic there
- Sync integrity is critical - always run P0 tests after sync-related changes
- The release process embeds frontend assets into the Go binary
- `pb_data/` is the source of truth for runtime data - never delete it
