# DentVision Codespaces Development Environment

This setup is an isolated development/test environment. It does not deploy the application and does not modify the existing Render service.

## Create the environment

1. Open the repository in GitHub and select the branch `dev-env/codespaces-bootstrap-20261025`.
2. Use **Code → Codespaces → Create codespace on this branch**.
3. Wait for the container to finish creating and for `.devcontainer/post-create.sh` to install the frontend and backend dependencies.
4. If Codespaces reports that the repository or account is not eligible, check the account's Codespaces access and usage quota. This repository change does not create or bill a Codespace by itself.

The dev container uses Node.js 22 and a separate PostgreSQL 16 container. Database credentials and signing/encryption keys in this configuration are local-only development placeholders; never reuse them in production or a shared environment.

## Start the application

Open two terminals in the Codespace.

Terminal 1 — backend:

```bash
cd dentvision-backend
npx prisma generate
npm run dev
```

Terminal 2 — frontend:

```bash
npm run dev -- --host 0.0.0.0
```

The frontend uses port 3000 and the API uses port 3001. Ports are forwarded by Codespaces when the processes start.

## Database and tests

The PostgreSQL container starts automatically, but schema migrations and fixture seeding are intentionally not run automatically. First inspect the current migration/fixture guidance in the repository and then run the appropriate setup command against the local `dentvision_dev` database only.

Useful frontend checks:

```bash
npm run typecheck
npm test
npm run build
```

Playwright checks require the backend, frontend, and an appropriately prepared local test database. Follow the existing E2E and CI instructions before running the full suite; do not point this environment at production or the existing Render database.

## Persistence and cost

Codespaces is a resumable development environment, not a guaranteed 24/7 server. It may stop after inactivity and is subject to the GitHub account's included quota and billing settings. Source changes should be committed and pushed to the branch so work remains in Git even if the Codespace is deleted.
