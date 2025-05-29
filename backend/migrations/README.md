# Database Migrations

This project uses Kysely for database migrations with SQLite.

## Migration Commands

```bash
# Run all pending migrations
bun run migrate:up

# Rollback the last migration
bun run migrate:down  

# Migrate to latest (same as up)
bun run migrate:latest
```

## Creating New Migrations

1. Create a new migration file in `backend/migrations/migrations/` with format: `XXX_description.ts`
   - Use incrementing numbers: `001_`, `002_`, etc.
   - Use descriptive names: `002_add_user_preferences.ts`

2. Migration file template:
```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add your migration logic here
  await db.schema
    .createTable('table_name')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    // ... more columns
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Add rollback logic here
  await db.schema.dropTable('table_name').execute();
}
```

## Migration History

The `kysely_migration` table tracks which migrations have been run.

## Database Schema Types

Schema types are defined in `backend/lib/db-client.ts` and should be updated when adding new tables or columns.