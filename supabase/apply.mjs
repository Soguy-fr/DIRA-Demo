// Applique migrations 0001..NN puis un seed sur la base Supabase.
// Usage: PGPASSWORD=... PGHOST=... node supabase/apply.mjs <seedFile>
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const seedFile = process.argv[2];

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function run(label, sql) {
  process.stdout.write(`-> ${label} ... `);
  await client.query(sql);
  console.log('OK');
}

const main = async () => {
  await client.connect();
  console.log('connected');
  const migDir = join(here, 'migrations');
  const files = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    await run(`migration ${f}`, readFileSync(join(migDir, f), 'utf8'));
  }
  if (seedFile) {
    await run(`seed ${seedFile}`, readFileSync(join(here, seedFile), 'utf8'));
  }
  await client.end();
  console.log('DONE');
};

main().catch(async (e) => { console.error('FAILED:', e.message); await client.end().catch(()=>{}); process.exit(1); });
