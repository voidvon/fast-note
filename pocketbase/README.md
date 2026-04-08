# PocketBase Runtime Assets

This directory stores PocketBase runtime customizations that stay outside the source-built launcher.

- `pb_hooks/`: JavaScript hooks loaded by the PocketBase binary.
- `pb_migrations/`: JavaScript migrations loaded by the PocketBase binary.
- `version.json`: locked PocketBase release metadata used by the packaging scripts.

The PocketBase binary itself is not committed. Packaging downloads the pinned release and assembles the final `backend/` directory.
