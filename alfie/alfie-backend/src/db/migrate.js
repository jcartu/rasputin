import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations() {
  const result = await db.query('SELECT name FROM migrations ORDER BY id');
  return new Set(result.rows.map(row => row.name));
}

async function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }
  
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function runMigration(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  await db.transaction(async (client) => {
    await client.query(sql);
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [filename]
    );
  });
  
  console.log(`Applied: ${filename}`);
}

async function migrate() {
  console.log('Running migrations...');
  
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = await getMigrationFiles();
  
  let count = 0;
  for (const file of files) {
    if (!applied.has(file)) {
      await runMigration(file);
      count++;
    }
  }
  
  if (count === 0) {
    console.log('No new migrations to apply.');
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
}

async function rollback(steps = 1) {
  await ensureMigrationsTable();
  
  const result = await db.query(
    'SELECT name FROM migrations ORDER BY id DESC LIMIT $1',
    [steps]
  );
  
  if (result.rows.length === 0) {
    console.log('No migrations to rollback.');
    return;
  }
  
  for (const row of result.rows) {
    const downFile = row.name.replace('.sql', '.down.sql');
    const downPath = path.join(MIGRATIONS_DIR, downFile);
    
    if (fs.existsSync(downPath)) {
      const sql = fs.readFileSync(downPath, 'utf8');
      await db.transaction(async (client) => {
        await client.query(sql);
        await client.query('DELETE FROM migrations WHERE name = $1', [row.name]);
      });
      console.log(`Rolled back: ${row.name}`);
    } else {
      console.log(`No rollback file for: ${row.name}, removing from tracking only`);
      await db.query('DELETE FROM migrations WHERE name = $1', [row.name]);
    }
  }
}

async function status() {
  await ensureMigrationsTable();
  
  const applied = await getAppliedMigrations();
  const files = await getMigrationFiles();
  
  console.log('Migration status:');
  console.log('------------------');
  
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }
  
  for (const file of files) {
    const marker = applied.has(file) ? '[x]' : '[ ]';
    console.log(`${marker} ${file}`);
  }
}

async function createMigration(name) {
  if (!name) {
    console.error('Usage: migrate create <name>');
    process.exit(1);
  }
  
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `${timestamp}_${name}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);
  
  fs.writeFileSync(filepath, `-- Migration: ${name}\n\n`);
  console.log(`Created: ${filepath}`);
}

async function runInitialSchema() {
  console.log('Running initial schema...');
  
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('schema.sql not found');
    process.exit(1);
  }
  
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await db.query(sql);
  console.log('Initial schema applied successfully.');
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await migrate();
        break;
      case 'down':
      case 'rollback':
        await rollback(parseInt(arg, 10) || 1);
        break;
      case 'status':
        await status();
        break;
      case 'create':
        await createMigration(arg);
        break;
      case 'init':
        await runInitialSchema();
        break;
      default:
        console.log('Usage: node migrate.js <command>');
        console.log('Commands:');
        console.log('  init              Run initial schema.sql');
        console.log('  up, migrate       Run pending migrations');
        console.log('  down, rollback    Rollback last migration');
        console.log('  status            Show migration status');
        console.log('  create <name>     Create new migration file');
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
