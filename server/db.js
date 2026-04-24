import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'database.sqlite');

const SQL = await initSqlJs();
let _db;

if (fs.existsSync(DB_PATH)) {
  const buf = fs.readFileSync(DB_PATH);
  _db = new SQL.Database(buf);
} else {
  _db = new SQL.Database();
}

function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
}

// Create table only if it doesn't exist — preserves data across restarts
_db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    Row_ID       INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_ID     TEXT,
    Order_Date   TEXT,
    Product_Name TEXT,
    Sales        REAL,
    Category     TEXT,
    type         TEXT NOT NULL DEFAULT 'expense'
  )
`);
save();

// Track whether we're inside a transaction (to batch saves)
let _inTransaction = false;

// Compatibility wrapper that mimics better-sqlite3 API
function prepare(sql) {
  return {
    all: (...args) => {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const stmt = _db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const results = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    },
    run: (...args) => {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      _db.run(sql, params.length > 0 ? params : undefined);
      if (!_inTransaction) save();
      const rows = _db.exec('SELECT last_insert_rowid()');
      const lastId = rows[0]?.values[0][0] ?? null;
      return { lastInsertRowid: lastId };
    },
    get: (...args) => {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const stmt = _db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      if (!stmt.step()) { stmt.free(); return undefined; }
      const obj = stmt.getAsObject();
      stmt.free();
      return obj;
    },
  };
}

function transaction(fn) {
  return (...args) => {
    _inTransaction = true;
    _db.run('BEGIN');
    try {
      fn(...args);
      _db.run('COMMIT');
    } catch (e) {
      _db.run('ROLLBACK');
      throw e;
    } finally {
      _inTransaction = false;
    }
    save();
  };
}

const db = { prepare, transaction };
export default db;
