# FastNote Deployment

## Source Layout

- `apps/web`: web frontend source, tests, and Vite config
- `apps/launcher`: Go launcher that starts the official PocketBase binary
- `apps/desktop`: desktop packaging shell, isolated from server deployment
- `pocketbase/pb_hooks`: PocketBase JavaScript hooks
- `pocketbase/pb_migrations`: PocketBase JavaScript migrations
- `pocketbase/version.json`: pinned PocketBase release metadata

## Release Flow

```bash
npm install
npm run release
```

The release command performs:

1. Build `apps/web`
2. Build `apps/launcher`
3. Download the pinned PocketBase binary for the current platform
4. Assemble `build/FastNote`

## Release Layout

```text
build/FastNote/
  fastnote
  backend/
    pocketbase
    pb_hooks/
    pb_migrations/
    pb_public/
  data/
  logs/
  README.md
```

## Runtime Notes

- Start the service with `./fastnote`
- The launcher runs `backend/pocketbase serve --dir ./data`
- `pb_public` is served by PocketBase directly
- Keep `data/` and `logs/` across upgrades
