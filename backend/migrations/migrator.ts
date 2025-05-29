import { promises as fs } from 'fs';
import path from 'path';
import {
  Kysely,
  Migrator,
  FileMigrationProvider,
  MigrationResultSet,
} from 'kysely';
import { createDb } from '../lib/db-client';

const runMigrations = async (direction: 'up' | 'down' = 'up') => {
  const db = createDb();
  
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  let resultSet: MigrationResultSet;
  
  if (direction === 'up') {
    resultSet = await migrator.migrateToLatest();
  } else {
    resultSet = await migrator.migrateDown();
  }

  const { results, error } = resultSet;

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('❌ Failed to run migrations');
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
};

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'up':
    console.log('🚀 Running migrations...');
    runMigrations('up');
    break;
  case 'down':
    console.log('🔽 Rolling back last migration...');
    runMigrations('down');
    break;
  case 'latest':
    console.log('🚀 Migrating to latest...');
    runMigrations('up');
    break;
  default:
    console.log(`
Usage:
  bun run migrate:up      - Run all pending migrations
  bun run migrate:down    - Rollback last migration
  bun run migrate:latest  - Migrate to latest (same as up)
    `);
    process.exit(1);
}

export { runMigrations };