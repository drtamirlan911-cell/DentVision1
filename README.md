# DentVision V2

AI-powered dental clinic management platform — CRM, scheduling, billing, AI workspace, e-commerce shop, and online academy.

## Product Specification

Canonical product & company foundation (Microsoft / Apple / Stripe–level):

→ **[`docs/spec/MISSION.md`](docs/spec/MISSION.md)** — Core Mission (CRITICAL)  
→ **[`docs/00_CONSTITUTION/02_PRODUCT_DNA.md`](docs/00_CONSTITUTION/02_PRODUCT_DNA.md)** — Product DNA (CRITICAL)  
→ **[`docs/spec/README.md`](docs/spec/README.md)** — DentVision Platform Specification v1.0

Covers first-run AI experience, ChatGPT-class intelligence + 10 agents, world-class CRM, Kaspi-class Marketplace, School, Community (IG/Threads), Jobs (HH.kz-class), and the 5-year 3D scanner hardware vision.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand (stores), React Query (server state) |
| UI | Custom design system (23+ components), Framer Motion, Radix UI |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL (Neon cloud) |
| Realtime | WebSocket (native `ws` library) |
| AI | Intent engine + proactive alerts |
| Hosting | Vercel (frontend), Render (backend) |

## Getting Started

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Configure environment
cp server/.env.example server/.env   # set DATABASE_URL, JWT_SECRET, etc.

# Start dev server
npm run dev          # frontend on http://localhost:5000
cd server && node index.js   # backend on http://localhost:3001
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (202 kB main bundle) |
| `npm run lint` | ESLint (0 errors) |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
  components/
    ui/ds/          # Design system (23+ components)
    intelligence/   # AI workspace, chat, alerts
    ai/             # AI service cards, greeting
  layouts/          # IntelligenceLayout, Sidebar, BottomNav, AlertDropdown
  pages/
    crm/            # Schedule, Patients, Cashier, Lab, Documents, etc.
    shop/           # Marketplace, products, orders, checkout
    school/         # Academy courses, cases, library
    admin/          # ShopAdmin, SchoolAdmin (superadmin)
  queries/          # React Query hooks + useDataQuery compat layer
  services/
    websocket/      # WS client, SocketProvider, event types
  store/            # Zustand stores (auth, cart, workspace)
  utils/            # API client, helpers, constants
  lib/              # Utilities (cn, formatMoney, etc.)

server/
  index.js          # Express + WebSocket server entry
  ws.js             # WebSocket server (JWT auth, clinic-scoped)
  seed.js           # Database initialization
  routes/           # REST API routes
  lib/              # Prisma client
```

## Key Features

- **CRM** — Patient management, scheduling, medical cards, visits, ICD-10, documents
- **Billing** — Cashier, price list, receipts, promotions, inventory
- **AI Workspace** — Chat interface, intent engine, proactive alerts, `Cmd+K` command palette
- **E-Commerce** — Product marketplace, cart, checkout, orders, favorites, suppliers
- **Academy** — Online courses, clinical cases, library
- **Analytics** — Revenue reports, doctor performance, patient demographics
- **Multi-Clinic** — Role-based access (11 org roles + 4 platform roles), clinic switching
- **Realtime** — WebSocket events for patients, appointments, visits, documents
- **Mobile** — Bottom navigation, responsive layout, safe area support

## Architecture

- **Route-level code splitting** — All 30+ pages lazy-loaded via `React.lazy`
- **Vendor chunking** — React (52 kB gz), Framer Motion (42 kB gz), Lucide icons (10 kB gz), React Query (13 kB gz)
- **React Query** — Server state management with optimistic updates, prefetching, cache invalidation
- **Zustand** — Client state (auth, cart, workspace)
- **WebSocket** — Real-time events with automatic reconnection and heartbeat
- **Web Vitals** — CLS, FID, LCP, TTFB, INP monitoring

## Environment Variables

### Frontend
| Variable | Description |
|----------|------------|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:3001`) |

### Backend (`server/.env`)
| Variable | Description |
|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string (Neon pooler) |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | Server port (default: 3001) |
| `KASPI_CALLBACK_SECRET` | Platform Kaspi webhook secret (Academy / Shop / SaaS) |
| `PUBLIC_API_URL` | Public API URL for clinic webhook links |

## Kaspi / оплата

- **Касса клиники** → свой Kaspi/банк клиники. Инструкция: [`docs/KASPI_CLINIC_SETUP.md`](docs/KASPI_CLINIC_SETUP.md)  
  UI: `CRM → Настройки клиники → Оплата на кассе (Kaspi клиники)`
- **Academy / Магазин / тариф SaaS** → Kaspi платформы DentVision

## License

Private — DentVision
