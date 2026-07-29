# DentVision V2 — Performance Report

**Date:** 2026-07-17

---

## CURRENT ISSUES

### Bundle & Loading
| Issue | Impact | Fix |
|---|---|---|
| No route-level code splitting per service | All 38 routes in one lazy chunk per section | Split CRM/Shop/School into separate lazy bundles |
| constants.ts (510L) imported everywhere | Large shared chunk | Split into domain files, import only what's needed |
| Framer Motion on every component | Heavy animation library loaded upfront | Use CSS transitions for simple hover/focus effects |
| Prisma packages in frontend deps | Unnecessary weight | Remove from package.json |

### Data Fetching
| Issue | Impact | Fix |
|---|---|---|
| useData loads ALL clinic data on mount | 17 tables fetched at once | Lazy-load per section |
| Zero React Query prefetching | Every navigation = fresh fetch | Add prefetchQuery on hover/intent |
| Zero optimistic updates | UI waits for server | Add optimistic mutations for CRUD |
| No request deduplication in useData | Multiple components fetch same data | Migrate to React Query (handles dedup) |
| No stale-while-revalidate | UI shows stale data until fetch completes | React Query default behavior |

### Rendering
| Issue | Impact | Fix |
|---|---|---|
| Module-level mutable store in useData | Changes don't trigger re-renders reliably | Use React state or Zustand |
| Large components (30 files >300 lines) | Slow re-renders, hard to memoize | Split into smaller components |
| No React.memo on list items | Full re-render on list changes | Add memo to PatientCard, AppointmentCard, etc. |
| No virtualization for large lists | Schedule, Patients, Cashier render all rows | Add react-window or react-virtuoso |

### Backend
| Issue | Impact | Fix |
|---|---|---|
| N+1 risk on Patient queries (7 relations) | 700 queries for 100 patients with includes | Use select + explicit includes |
| No database connection pooling config | Neon connection limits | Configure pool size |
| Seed data runs on every server start | Slow cold starts | Move seed to separate script |
| 10MB body limit on new backend | DoS vector | Reduce to 1MB |

---

## TARGET METRICS

| Metric | Current (est.) | Target |
|---|---|---|
| Initial bundle size | ~500KB+ | <200KB |
| Time to Interactive | ~3-5s | <2s |
| First Contentful Paint | ~1-2s | <1s |
| API response time (p95) | ~500ms | <200ms |
| Largest Contentful Paint | ~3-4s | <2.5s |
| Cumulative Layout Shift | Unknown | <0.1 |

---

## RECOMMENDATIONS

### Phase 1: Quick Wins
1. Remove Prisma from frontend dependencies
2. Add React.memo to list item components
3. Enable React Query stale-while-revalidate (already default)
4. Split constants.ts into domain-specific files

### Phase 2: Data Layer
5. Migrate useData to React Query for all CRM pages
6. Add prefetchQuery on navigation hover
7. Implement optimistic updates for CRUD mutations
8. Add request deduplication

### Phase 3: Rendering
9. Split large components (>300 lines)
10. Add virtualization for large lists
11. Replace Framer Motion with CSS where possible
12. Add React.memo to expensive renders

### Phase 4: Architecture
13. Implement route-level code splitting per service
14. Add error boundaries around routes
15. Configure Neon connection pooling
16. Add performance monitoring (Web Vitals)
