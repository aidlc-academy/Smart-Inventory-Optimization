---
inclusion: always
---

# Technology Stack and Coding Conventions

## Stack Decision

The workspace was empty at project start. The following stack was chosen as the simplest setup appropriate for a small student team, with broad community support and no licensing friction.

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript 5 + Vite 5 | Familiar to most students; Vite's dev server is fast; TypeScript catches formula bugs at compile time |
| UI components | Plain CSS modules (no external UI library in v1) | Keeps the dependency list short; easier to audit |
| Backend | Node.js 20 LTS + Express 4 | Minimal boilerplate; runs everywhere; easy to extend |
| Database | SQLite 3 via `better-sqlite3` | Zero-configuration; single file; sufficient for demo and student evaluation |
| ORM / query | Raw SQL via `better-sqlite3` prepared statements | Keeps queries visible and auditable; avoids hidden N+1 issues |
| Testing | Vitest (frontend) + Jest (backend) | Both support TypeScript natively |
| Dev tooling | ESLint + Prettier | Consistent formatting; enforced via pre-commit hooks optional |

## Project Layout

```
smart-inventory-optimization/
├── frontend/          # React + TypeScript + Vite app
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/         # deterministic formula functions
│   │   └── types/
│   └── vite.config.ts
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── db/            # SQLite setup and migrations
│   │   ├── services/      # business-logic / formula layer
│   │   └── seed/          # demo dataset
│   └── package.json
├── DECISIONS.md
└── README.md
```

## Coding Conventions

### General
- All files use UTF-8 encoding.
- Indentation: 2 spaces (no tabs).
- Maximum line length: 100 characters.
- Filenames: `kebab-case` for files and directories; `PascalCase` for React components.

### TypeScript
- `strict: true` in `tsconfig.json` for both frontend and backend.
- No use of `any`; prefer explicit types or `unknown`.
- Interfaces are named with `I` prefix only when needed to distinguish from a class (otherwise just a type alias).
- Exported formula functions must include a JSDoc comment citing the formula and edge-case behaviour.

### React
- Functional components only; no class components.
- One component per file.
- Props types are defined with a `Props` suffix type alias directly above the component.
- Side effects (data fetching) belong in custom hooks under `src/hooks/`.

### Backend
- All database access goes through prepared statements; never string-concatenate user input into SQL.
- Route handlers are thin — they parse input, call a service function, and return the result.
- Service functions contain all business logic and formulas.
- All API responses are JSON. Error responses follow `{ error: string }`.

### Formula Purity Rule
Every inventory calculation function must be:
- A pure function (no side effects, no global state, same input always produces the same output).
- Exported from `frontend/src/utils/inventory.ts` (frontend) and `backend/src/services/inventory.ts` (backend).
- Covered by at least one unit test.
