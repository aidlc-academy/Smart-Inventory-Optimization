# Supabase PostgreSQL Migration - Complete

## Setup Commands (PowerShell)

```powershell
# 1. Navigate to backend directory
cd "c:\Users\ELCOT\OneDrive\Documents\kiro project\smart-inventory-optimization\backend"

# 2. Install PostgreSQL dependencies
npm install

# 3. Copy environment template
Copy-Item .env.example .env

# 4. Edit .env and set your DATABASE_URL
# Example for Supabase:
# DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres?sslmode=require

# 5. Run the backend (creates tables automatically)
npm run dev

# 6. In a new terminal, import existing SQLite data (one-time)
npm run import-sqlite
```

## Changed Files

| File | Changes |
|------|---------|
| `package.json` | Added `pg`, `dotenv`; kept `better-sqlite3` in devDependencies for importer |
| `tsconfig.json` | No changes needed |
| `.gitignore` | Added `.env` files to ignore list |
| `.env.example` | Added placeholder for `DATABASE_URL` |
| `src/db/database.ts` | Replaced `better-sqlite3` with `pg` Pool; added helper functions |
| `src/db/migrations.ts` | Converted to PostgreSQL DDL (SERIAL, TEXT, indexes) |
| `src/routes/products.ts` | All routes converted to async/await; `RETURNING id` for inserts |
| `src/routes/sales.ts` | Transactions with `BEGIN/COMMIT/ROLLBACK`; `FOR UPDATE` locking; `ON CONFLICT` upsert |
| `src/routes/orders.ts` | Transactional receipt with idempotency check; `FOR UPDATE` lock |
| `src/routes/dashboard.ts` | Async with PostgreSQL date helpers |
| `src/routes/seed.ts` | Async seed operations |
| `src/seed/demo-data.ts` | PostgreSQL version with `ON CONFLICT` |
| `src/index.ts` | Async startup, dotenv, graceful shutdown |
| `src/scripts/import-from-sqlite.ts` | One-time data importer (NEW) |
| `src/routes/sales.test.ts` | Updated for PostgreSQL test database |
| `jest.config.js` | Added timeout and setup file |
| `jest.setup.js` | Jest timeout configuration (NEW) |

## Checks Performed

1. **TypeScript compilation**: Passes (after `npm install`)
2. **Schema preservation**: All tables, constraints, indexes preserved
3. **Transaction safety**: Sales, restocks, and order receipts use single client with `BEGIN/COMMIT/ROLLBACK`
4. **Idempotency**: Purchase order receipt checks `status === 'Received'` before processing
5. **Date format**: Kept as TEXT (YYYY-MM-DD) to preserve API responses
6. **Boolean format**: Kept as INTEGER (0/1) to preserve API responses
7. **IDs preserved**: Importer uses explicit ID values and resets sequences

## Tests Not Run

The following tests require a PostgreSQL database connection:

```powershell
# Set test database URL
$env:TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/smart_inventory_test"

# Run tests
npm test
```

Tests to run:
- `src/services/inventory.test.ts` - Pure function tests (no DB)
- `src/routes/sales.test.ts` - Integration tests for sales, restocks, movements

## Key PostgreSQL Changes

| SQLite | PostgreSQL |
|--------|------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `date('now', '-N days')` | `CURRENT_DATE - INTERVAL 'N days'` (or JS helper) |
| `INSERT OR REPLACE` | `INSERT ... ON CONFLICT DO UPDATE` |
| `result.lastInsertRowid` | `INSERT ... RETURNING id` |
| `db.transaction(() => {...})` | `BEGIN; ... COMMIT;` with single client |
| `SQLITE_CONSTRAINT_UNIQUE` | Error code `23505` |

## Security

- **Credentials**: DATABASE_URL in `.env` (gitignored)
- **TLS**: `ssl: { rejectUnauthorized: true }` in Pool config
- **No frontend exposure**: Frontend uses `/api/v1` relative URLs only
- **Supabase Data API**: Inventory tables remain private; only backend can access

## Rollback

If issues arise:

1. Revert `package.json` to SQLite version
2. Restore original `src/db/database.ts`, `src/db/migrations.ts`, and all route files from git
3. SQLite database (`inventory.db`) is preserved unchanged
