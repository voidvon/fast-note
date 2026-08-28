<div align="center">

<img src="fastnote/public/icons/icon-128x128.png" alt="Fastnote" width="112">

# Fastnote

[![Vue](https://img.shields.io/badge/Vue.js-3-42b883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Framework7](https://img.shields.io/badge/Framework7-9-EE350F.svg?logo=framework7&logoColor=white)](https://framework7.io/)
[![Go](https://img.shields.io/badge/Go-1.24%2B-00ADD8.svg?logo=go&logoColor=white)](https://go.dev/)
[![Release](https://img.shields.io/badge/release-v0.1.16-orange.svg)](https://github.com/voidvon/fast-note/releases/tag/v0.1.16)

**An offline-first, self-hosted note-taking app for rich writing, organization, synchronization, and public sharing.**

English | [简体中文](README_CN.md)

<p>
  <a href="https://n.0122.vip">Try the demo</a> ·
  <a href="https://github.com/voidvon/fast-note/releases">Download</a> ·
  <a href="docs/开发文档/README.md">Documentation</a>
</p>

</div>

## Overview

Fastnote is a full-stack notebook designed to keep writing responsive even when
the network is unavailable. Notes and folders are written to local storage
first, then synchronized with a PocketBase backend when an account and network
connection are available.

It can be used as a hosted web application, deployed as a self-hosted service,
or developed locally as a single repository containing the Vue frontend and Go
backend.

> Fastnote is currently under active development. Back up the `pb_data/`
> directory before upgrades or other operational changes.

## Features

- **Offline-first editing** - create and edit notes locally with immediate UI
  feedback, then synchronize changes when connectivity returns.
- **Rich-text notes** - write with Tiptap-based formatting, headings, lists,
  task lists, tables, links, images, and attachments.
- **Folders and navigation** - organize notes in nested folders, move notes,
  browse large lists, and restore useful navigation and scroll state.
- **Authentication and sync** - register and sign in through PocketBase, sync
  notes across devices, receive realtime changes, and monitor sync status.
- **Public notes** - expose selected notes and folders through public user
  pages while keeping private content in the authenticated workspace.
- **AI assistant** - search notes and folders conversationally and run supported
  actions with confirmation; configure your own compatible AI provider.
- **Protected notes** - use note locking and guarded unlock flows for sensitive
  content.
- **Attachments** - store and reconcile note attachments locally while keeping
  their remote references synchronized.
- **Responsive workspace** - use a desktop split-pane layout or a mobile list
  and detail flow from the same application.

## Downloads

The current published build is **v0.1.16**, a prerelease intended for testing.
Download packages from [GitHub Releases](https://github.com/voidvon/fast-note/releases/tag/v0.1.16).

These archives are self-hosted server packages. Each package contains the
platform binary, an empty `pb_data/` directory, and a small package README.
The frontend is embedded in the binary, so a separate static frontend server
is normally not required.

| Platform | Targets | Package |
|---|---|---|
| macOS | `darwin-amd64`, `darwin-arm64` | ZIP archive |
| Linux | `linux-amd64`, `linux-arm64`, `linux-armv7`, `linux-ppc64le`, `linux-s390x` | ZIP archive |
| Windows | `windows-amd64`, `windows-arm64` | ZIP archive |

## Getting Started

### Use the demo

Open the [online demo](https://n.0122.vip) in a modern browser. For a private
workspace and production data, deploy your own Fastnote instance instead.

### Run a release package

Download and extract the package for your operating system, then run the binary
from the extracted directory so that `pb_data/` stays next to it:

```bash
cd fastnote_v0.1.16_linux_amd64
./fastnote serve --http=127.0.0.1:8090
```

On Windows PowerShell:

```powershell
cd fastnote_v0.1.16_windows_amd64
.\fastnote.exe serve --http=127.0.0.1:8090
```

Open `http://127.0.0.1:8090` and register an account. The service will keep its
runtime database, uploaded files, and other persistent state in `./pb_data/`.

### Deploy behind a reverse proxy

For a long-running installation:

1. Extract the matching release archive into a dedicated directory such as
   `/opt/fastnote/`.
2. Make sure the service user can read and write the directory, especially
   `/opt/fastnote/pb_data/`.
3. Start `./fastnote serve --http=127.0.0.1:8090` with systemd, supervisor, or
   another process manager.
4. Proxy your HTTPS domain to the local Fastnote service with Nginx, Caddy, or
   an equivalent reverse proxy.
5. Include `pb_data/` in your regular backup policy.

### Upgrade an installation

The built-in update command downloads the latest **stable** GitHub Release for
the current platform and creates a `pb_data` backup before replacing the
program files:

```bash
./fastnote update
```

Stop the service before updating, keep the existing `pb_data/` directory, and
restart it through the same process manager afterwards. You can also upgrade
manually by extracting a new archive and replacing only the binary and package
documentation.

## Local Development

### Requirements

- Node.js and npm
- Go 1.24 or later
- A modern browser

Install frontend dependencies and tidy the backend module from the repository
root:

```bash
npm run install:frontend
npm run tidy:backend
```

Start the frontend and local PocketBase Go host together:

```bash
npm run dev
```

The frontend is available at `http://127.0.0.1:8888` and the local backend at
`http://127.0.0.1:8090`. The development backend uses `backend/pb_data`; its
accounts and data are separate from any hosted or production instance.

Run either side independently when needed:

```bash
npm run dev:frontend
npm run dev:backend
```

### Build and test

```bash
npm run build
npm run lint
npm run test:unit -- --run
npm run test:e2e
```

Create a complete cross-platform release bundle with:

```bash
npm run release -- --version=v0.1.16
```

The release script builds the frontend, embeds its static assets into the Go
host, and generates packages in `build/releases/` for all supported targets.
Use `npm run release:local` to build only the current host target.

## Configuration and Data

- `fastnote/.env.example` contains frontend development defaults.
- `backend/.env.example` documents the optional `FASTNOTE_WEB_DIST` static
  asset override.
- Runtime data belongs in `pb_data/`; do not commit, delete, or overwrite it
  casually.
- Static assets are resolved from `FASTNOTE_WEB_DIST`, `./pb_public`, the
  adjacent frontend build, and finally the embedded frontend in that order.
- AI features require provider configuration. Review the provider's data
  handling before sending private note content to an external service.

## Architecture

Fastnote is organized as a frontend/backend monorepo:

```text
backend/
  main.go                         # PocketBase Go host
  internal/server/                 # bootstrap, routes, and hooks
  migrations/                     # PocketBase migration entry point

fastnote/
  src/app/                         # application setup and routing
  src/processes/                   # sync, session, navigation, public notes
  src/pages/                       # route-level page composition
  src/widgets/                     # larger business UI modules
  src/features/                    # user actions and use cases
  src/entities/                    # domain state and rules
  src/shared/                      # storage, APIs, UI, and utilities
```

The frontend uses Vue 3, TypeScript, Framework7, Vite, UnoCSS, Dexie, Tiptap,
and the PocketBase JavaScript SDK. The backend uses Go and PocketBase as the
runtime host. Local IndexedDB state is the immediate source of truth; cloud
sync provides eventual consistency across authenticated devices.

## Documentation

| Document | Description |
|---|---|
| [Development documentation](docs/开发文档/README.md) | Architecture, setup, implementation notes, and testing |
| [Product documentation](docs/产品文档/README.md) | Product scope, features, user flows, and roadmap |
| [AI Agent documentation](docs/AI对话Agent/README.md) | AI assistant requirements, architecture, and current implementation |
| [GitHub Releases](https://github.com/voidvon/fast-note/releases) | Published versions and platform packages |

Issues and pull requests are welcome. When reporting a problem, include the
affected platform, reproduction steps, release version, and relevant logs.
