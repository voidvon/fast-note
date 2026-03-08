# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build production version (includes TypeScript compilation)
- `npm run preview` - Preview production build
- `vue-tsc` - Run TypeScript compiler check

### Quality & Testing

- `npm run lint` - Run ESLint with auto-formatting
- `npm run test:unit` - Run unit tests with Vitest
- `npm run test:e2e` - Run end-to-end tests with Cypress

### Mobile & Desktop

- `npm run tauri` - Tauri commands for desktop app development
- `npx cap add ios` / `npx cap add android` - Add mobile platforms
- `npx cap sync` - Sync web assets to native projects

## Architecture Overview

### Technology Stack

- **Frontend**: Ionic 8 + Vue 3 + TypeScript
- **Database**: Dexie.js (IndexedDB wrapper) for local-first storage
- **Editor**: Tiptap rich text editor with extensions (Color, TextAlign, Image, Table, etc.)
- **Styling**: UnoCSS + SCSS + Ionic CSS variables
- **Build**: Vite with path aliases (`@/*` → `./src/*`)
- **Mobile**: Capacitor for iOS/Android, Tauri for desktop
- **Sync**: Cloud synchronization with conflict resolution

### Application Architecture

This is a **local-first note-taking application** with the following key characteristics:

1. **Data Flow**: Local IndexedDB → Cloud Sync → Multi-device access
2. **Composition API Hooks Pattern**: Business logic organized in `src/hooks/`
3. **Route-based Navigation**: Supports nested folder hierarchies up to 5 levels deep
4. **Rich Text Editing**: Tiptap editor with file upload and formatting capabilities

### Core Hooks (Business Logic)

- `useDexie.ts` - Database initialization and schema management
- `useNote.ts` - CRUD operations for notes and folders
- `useSync.ts` - Cloud synchronization with timestamp-based conflict resolution
- `useFiles.ts` - File attachment management
- `useUserInfo.ts` - User authentication and session management

### Routing Structure

- `/home` - Main notes and folders list
- `/login` - User authentication
- `/n/:uuid` - Note detail/editor page
- `/f/:uuid/...` - Folder navigation (supports up to 5 nested levels)
- `/deleted` - Deleted items view

### Development Configuration

- **Dev Server**: Runs on `0.0.0.0:3000` with HTTPS support
- **Proxy**: `/e` and `/d` routes proxied to `https://next.0122.vip`
- **Mode**: Ionic set to iOS mode for consistent UI
- **TypeScript**: Strict mode enabled with path mapping

### Data Models

Key interfaces defined in hooks:

- `Note`: Core note structure with version control and hierarchy
- `TypedFile`: File attachments with hash-based deduplication
- `UserInfo`: User session and authentication data

### Sync Strategy

- Uses `lastdotime` timestamps and `version` numbers for conflict resolution
- Local-first: All operations work offline, sync when connection available
- Bidirectional sync: Uploads local changes, downloads remote updates

### File Organization

- `src/components/` - Reusable UI components including the main editor
- `src/views/` - Page-level components
- `src/hooks/` - Business logic and data management
- `src/api/` - HTTP client and API service configuration
- `src/css/` - SCSS stylesheets and CSS variables
