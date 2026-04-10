# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Structure

- `fastnote/` - Frontend app built with Vue 3 + Ionic + Vite. Frontend code follows FSD.
- `backend/` - PocketBase Go host app, static asset bootstrap, hooks, and migrations.
- `docs/` - Product, development, and architecture documents.

## Essential Commands

### Frontend

- `cd fastnote && npm run dev` - Start the frontend dev server on port `8888`
- `cd fastnote && npm run build` - Run `vue-tsc` and build the frontend
- `cd fastnote && npm run preview` - Preview the production frontend build
- `cd fastnote && npm run lint` - Run ESLint
- `cd fastnote && npm run test:unit` - Run Vitest unit/integration tests
- `cd fastnote && npm run test:e2e` - Run Cypress end-to-end tests
- `cd fastnote && npm run tauri` - Run Tauri commands for desktop app development

### Backend

- `cd backend && go mod tidy` - Sync Go module dependencies
- `cd backend && go build ./...` - Build the PocketBase host app
- `cd backend && go run . serve` - Start the PocketBase backend locally

## Architecture Overview

### Frontend

- Tech stack: Ionic 8 + Vue 3 + TypeScript + Vite
- Storage: Dexie / IndexedDB for local-first persistence
- Sync: PocketBase JavaScript SDK with realtime and file APIs
- Editor: Tiptap rich text editor with formatting, table, and upload extensions
- Structure: `app -> processes -> pages/widgets/features -> entities -> shared`

### Backend

- Tech stack: Go + PocketBase
- Entry: `backend/main.go`
- Bootstrap: `backend/internal/server/bootstrap`
- Hooks: `backend/internal/server/hooks`
- Schema and setup changes: `backend/migrations`
- Current scope: host-only setup, no business routes or business schema in repo yet

## Working Rules

- Do not put backend logic into `fastnote/src`.
- Do not put frontend state or view logic into `backend`.
- Treat PocketBase collection schema changes as backend changes and record them in `backend/migrations`.
- Keep the app offline-first: local persistence is the immediate source of truth, cloud sync is eventual consistency.
- Default PocketBase access should be same-origin in production and explicit local backend in development.

## Current Dev Defaults

- Frontend dev server: `https://localhost:8888` when `VITE_HTTPS=true`
- Local backend: `http://127.0.0.1:8090`
- Frontend production build output: `fastnote/dist`

## Key Paths

- Frontend PocketBase client: `fastnote/src/shared/api/pocketbase/client.ts`
- Frontend router: `fastnote/src/app/router/*`
- Frontend sync flow: `fastnote/src/processes/sync-notes/*`
- Backend startup: `backend/main.go`
