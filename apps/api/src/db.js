const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const DATABASE_URL = process.env.DATABASE_URL || null;
let dbClient = null;
let isPostgres = false;
const normalizeSqlForSqlite = (sql) => sql.replace(/\$\d+/g, '?');

if (DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  isPostgres = true;
  dbClient = {
    async get(sql, params = []) { const result = await pool.query(sql, params); return result.rows[0] || null; },
    async all(sql, params = []) { const result = await pool.query(sql, params); return result.rows || []; },
    async run(sql, params = []) { const result = await pool.query(sql, params); return { rowCount: result.rowCount }; },
    async query(sql, params = []) { return pool.query(sql, params); }
  };
} else {
  const Database = require('better-sqlite3');
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/vote.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8'));
  dbClient = {
    async get(sql, params = []) { return sqlite.prepare(normalizeSqlForSqlite(sql)).get(...params) || null; },
    async all(sql, params = []) { return sqlite.prepare(normalizeSqlForSqlite(sql)).all(...params) || []; },
    async run(sql, params = []) { const info = sqlite.prepare(normalizeSqlForSqlite(sql)).run(...params); return { lastInsertRowid: info.lastInsertRowid, changes: info.changes }; },
    async query(sql, params = []) { return { rows: sqlite.prepare(normalizeSqlForSqlite(sql)).all(...params) }; }
  };
}

async function bootstrapSuperadmin() {
  const username = String(process.env.INITIAL_ADMIN_USERNAME || '').trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD || '';
  if (!username && !password) return;
  if (!username || password.length < 8) { console.warn('Initial superadmin not created: configure username and password (at least 8 characters).'); return; }
  const existing = await dbClient.get('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return;
  const id = require('crypto').randomUUID();
  const password_hash = await bcrypt.hash(password, 12);
  await dbClient.run('INSERT INTO users (id, username, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5)', [id, username, password_hash, 'superadmin', new Date().toISOString()]);
  console.log(`Created initial superadmin account: ${username}`);
}
const ready = (async () => {
  if (!isPostgres) await dbClient.run("UPDATE users SET role = 'superadmin' WHERE role = 'owner'");
  await bootstrapSuperadmin();
})();
module.exports = { db: dbClient, isPostgres, ready };
